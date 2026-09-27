use base64::{engine::general_purpose::STANDARD, Engine as _};
use clipboard_rs::common::RustImage;
use clipboard_rs::{
    Clipboard, ClipboardContext, ClipboardHandler, ClipboardWatcher, ClipboardWatcherContext,
    ContentFormat, RustImageData, WatcherShutdown,
};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const CLIPBOARD_HISTORY_ACTION: &str = "clipboard_history";
pub const CLIPBOARD_HISTORY_CHANGED_EVENT: &str = "clipboard-history-changed";
const MAX_HISTORY_ENTRIES: usize = 50;
const MAX_TEXT_ENTRY_BYTES: usize = 64 * 1024;
const MAX_TEXT_HISTORY_BYTES: usize = 1024 * 1024;
const MAX_IMAGE_ENTRIES: usize = 10;
const MAX_IMAGE_ENTRY_BYTES: usize = 8 * 1024 * 1024;
const MAX_IMAGE_HISTORY_BYTES: usize = 32 * 1024 * 1024;
const THUMBNAIL_WIDTH: u32 = 200;
const THUMBNAIL_HEIGHT: u32 = 140;
const PREVIEW_CHARACTERS: usize = 220;
// Windows can notify listeners before the new owner has finished publishing its formats. Starting
// immediately can therefore return the previous clipboard value successfully, which is worse than
// a transient error because it looks valid and gets deduplicated. Let the clipboard settle first.
const CAPTURE_RETRY_DELAYS_MS: [u64; 5] = [40, 80, 160, 300, 500];
const WATCHER_RESTART_DELAY: Duration = Duration::from_millis(500);
#[cfg(target_os = "windows")]
const WINDOWS_WATCHDOG_INTERVAL: Duration = Duration::from_millis(250);

#[cfg(target_os = "windows")]
fn windows_clipboard_sequence_number() -> u32 {
    // Windows increments this only when the clipboard contents change, so the watchdog does no
    // decoding or image work while the clipboard is idle.
    unsafe { windows::Win32::System::DataExchange::GetClipboardSequenceNumber() }
}

#[derive(Debug, Clone)]
enum ClipboardEntryContent {
    Text(String),
    Image {
        png: Vec<u8>,
        thumbnail_png: Vec<u8>,
        width: u32,
        height: u32,
    },
}

#[derive(Debug, Clone)]
struct ClipboardEntry {
    id: u64,
    content: ClipboardEntryContent,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ClipboardHistoryPreview {
    Text {
        id: u64,
        preview: String,
    },
    Image {
        id: u64,
        thumbnail_data: String,
        width: u32,
        height: u32,
    },
}

enum CapturedClipboardContent {
    Text(String),
    Image {
        png: Vec<u8>,
        thumbnail_png: Vec<u8>,
        width: u32,
        height: u32,
    },
}

#[derive(Debug, Default)]
struct ClipboardHistory {
    entries: VecDeque<ClipboardEntry>,
    next_id: u64,
    text_bytes: usize,
    image_bytes: usize,
    image_count: usize,
}

impl ClipboardHistory {
    fn next_id(&mut self) -> u64 {
        self.next_id = self.next_id.saturating_add(1).max(1);
        self.next_id
    }

    fn record_text(&mut self, text: String) -> bool {
        if text.trim().is_empty() || text.len() > MAX_TEXT_ENTRY_BYTES {
            return false;
        }

        if let Some(index) = self.entries.iter().position(
            |entry| matches!(&entry.content, ClipboardEntryContent::Text(existing) if existing == &text),
        ) {
            return self.move_to_front(index);
        }

        self.text_bytes += text.len();
        let id = self.next_id();
        self.entries.push_front(ClipboardEntry {
            id,
            content: ClipboardEntryContent::Text(text),
        });
        self.enforce_limits();
        true
    }

    fn record_image(
        &mut self,
        png: Vec<u8>,
        thumbnail_png: Vec<u8>,
        width: u32,
        height: u32,
    ) -> bool {
        if png.is_empty() || png.len() > MAX_IMAGE_ENTRY_BYTES {
            return false;
        }

        if let Some(index) = self.entries.iter().position(|entry| {
            matches!(&entry.content, ClipboardEntryContent::Image { png: existing, .. } if existing == &png)
        }) {
            return self.move_to_front(index);
        }

        self.image_bytes += png.len() + thumbnail_png.len();
        self.image_count += 1;
        let id = self.next_id();
        self.entries.push_front(ClipboardEntry {
            id,
            content: ClipboardEntryContent::Image {
                png,
                thumbnail_png,
                width,
                height,
            },
        });
        self.enforce_limits();
        true
    }

    fn move_to_front(&mut self, index: usize) -> bool {
        if index == 0 {
            return false;
        }
        if let Some(entry) = self.entries.remove(index) {
            self.entries.push_front(entry);
            return true;
        }
        false
    }

    fn touch(&mut self, id: u64) -> bool {
        self.entries
            .iter()
            .position(|entry| entry.id == id)
            .is_some_and(|index| self.move_to_front(index))
    }

    fn remove_at(&mut self, index: usize) -> Option<ClipboardEntry> {
        let entry = self.entries.remove(index)?;
        match &entry.content {
            ClipboardEntryContent::Text(text) => {
                self.text_bytes = self.text_bytes.saturating_sub(text.len());
            }
            ClipboardEntryContent::Image {
                png, thumbnail_png, ..
            } => {
                self.image_bytes = self
                    .image_bytes
                    .saturating_sub(png.len() + thumbnail_png.len());
                self.image_count = self.image_count.saturating_sub(1);
            }
        }
        Some(entry)
    }

    fn enforce_limits(&mut self) {
        while self.text_bytes > MAX_TEXT_HISTORY_BYTES {
            let Some(index) = self
                .entries
                .iter()
                .rposition(|entry| matches!(&entry.content, ClipboardEntryContent::Text(_)))
            else {
                break;
            };
            self.remove_at(index);
        }
        while self.image_count > MAX_IMAGE_ENTRIES || self.image_bytes > MAX_IMAGE_HISTORY_BYTES {
            let Some(index) = self
                .entries
                .iter()
                .rposition(|entry| matches!(&entry.content, ClipboardEntryContent::Image { .. }))
            else {
                break;
            };
            self.remove_at(index);
        }
        while self.entries.len() > MAX_HISTORY_ENTRIES {
            self.remove_at(self.entries.len() - 1);
        }
    }

    fn search(&self, query: &str) -> Vec<ClipboardHistoryPreview> {
        let normalized_query = query.trim().to_lowercase();
        self.entries
            .iter()
            .filter_map(|entry| match &entry.content {
                ClipboardEntryContent::Text(text)
                    if normalized_query.is_empty()
                        || text.to_lowercase().contains(&normalized_query) =>
                {
                    Some(ClipboardHistoryPreview::Text {
                        id: entry.id,
                        preview: preview_text(text),
                    })
                }
                ClipboardEntryContent::Image {
                    thumbnail_png,
                    width,
                    height,
                    ..
                } if normalized_query.is_empty() => Some(ClipboardHistoryPreview::Image {
                    id: entry.id,
                    thumbnail_data: format!(
                        "data:image/png;base64,{}",
                        STANDARD.encode(thumbnail_png)
                    ),
                    width: *width,
                    height: *height,
                }),
                _ => None,
            })
            .collect()
    }

    fn content_for_id(&self, id: u64) -> Option<ClipboardEntryContent> {
        self.entries
            .iter()
            .find(|entry| entry.id == id)
            .map(|entry| entry.content.clone())
    }

    fn clear(&mut self) -> bool {
        let changed = !self.entries.is_empty();
        self.entries.clear();
        self.text_bytes = 0;
        self.image_bytes = 0;
        self.image_count = 0;
        changed
    }
}

fn preview_text(text: &str) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut characters = collapsed.chars();
    let mut preview: String = characters.by_ref().take(PREVIEW_CHARACTERS).collect();
    if characters.next().is_some() {
        if let Some(last_space) = preview.rfind(' ') {
            preview.truncate(last_space);
        }
        preview.push('…');
    }
    preview
}

fn lock_error(name: &str) -> String {
    format!("The {name} became unavailable.")
}

fn with_clipboard<T>(
    clipboard: &Arc<Mutex<Option<ClipboardContext>>>,
    operation: impl FnOnce(&ClipboardContext) -> clipboard_rs::Result<T>,
) -> Result<T, String> {
    let mut context = clipboard
        .lock()
        .map_err(|_| lock_error("clipboard service"))?;
    if context.is_none() {
        *context = Some(
            ClipboardContext::new()
                .map_err(|error| format!("Could not access the system clipboard: {error}"))?,
        );
    }
    operation(
        context
            .as_ref()
            .expect("the clipboard context was initialized above"),
    )
    .map_err(|error| format!("Could not access the system clipboard: {error}"))
}

fn capture_current_content(
    clipboard: &Arc<Mutex<Option<ClipboardContext>>>,
) -> Result<Option<CapturedClipboardContent>, String> {
    with_clipboard(clipboard, |clipboard| {
        if clipboard.has(ContentFormat::Image) {
            let image = clipboard
                .get_image()
                .map_err(|error| format!("Could not read the clipboard image: {error}"))?;
            let (width, height) = image.get_size();
            let png = image
                .to_png()
                .map_err(|error| format!("Could not encode the clipboard image: {error}"))?
                .get_bytes()
                .to_vec();
            if png.len() > MAX_IMAGE_ENTRY_BYTES {
                return Ok(None);
            }
            let thumbnail_png = image
                .thumbnail(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
                .map_err(|error| {
                    format!("Could not resize the clipboard image thumbnail: {error}")
                })?
                .to_png()
                .map_err(|error| {
                    format!("Could not encode the clipboard image thumbnail: {error}")
                })?
                .get_bytes()
                .to_vec();
            return Ok(Some(CapturedClipboardContent::Image {
                png,
                thumbnail_png,
                width,
                height,
            }));
        }
        if clipboard.has(ContentFormat::Text) {
            return clipboard
                .get_text()
                .map_err(|error| format!("Could not read clipboard text: {error}").into())
                .map(CapturedClipboardContent::Text)
                .map(Some);
        }
        Ok(None)
    })
}

fn retry_capture<T>(
    delays_ms: &[u64],
    mut capture: impl FnMut() -> Result<Option<T>, String>,
) -> Result<Option<T>, String> {
    let mut last_error = None;
    for delay_ms in delays_ms {
        if *delay_ms > 0 {
            std::thread::sleep(Duration::from_millis(*delay_ms));
        }
        match capture() {
            Ok(Some(content)) => return Ok(Some(content)),
            Ok(None) => {}
            Err(error) => last_error = Some(error),
        }
    }
    match last_error {
        Some(error) => Err(error),
        None => Ok(None),
    }
}

fn capture_current_content_with_retry(
    clipboard: &Arc<Mutex<Option<ClipboardContext>>>,
) -> Result<Option<CapturedClipboardContent>, String> {
    retry_capture(&CAPTURE_RETRY_DELAYS_MS, || {
        capture_current_content(clipboard)
    })
}

fn record_shared_content(
    history: &Arc<Mutex<ClipboardHistory>>,
    app: &AppHandle,
    content: CapturedClipboardContent,
) -> bool {
    let changed_and_count = history.lock().ok().and_then(|mut history| {
        let changed = match content {
            CapturedClipboardContent::Text(text) => history.record_text(text),
            CapturedClipboardContent::Image {
                png,
                thumbnail_png,
                width,
                height,
            } => history.record_image(png, thumbnail_png, width, height),
        };
        changed.then_some(history.entries.len())
    });
    if let Some(count) = changed_and_count {
        let _ = app.emit(CLIPBOARD_HISTORY_CHANGED_EVENT, count);
        true
    } else {
        false
    }
}

fn capture_and_record_with_retry(
    clipboard: &Arc<Mutex<Option<ClipboardContext>>>,
    history: &Arc<Mutex<ClipboardHistory>>,
    app: &AppHandle,
) -> Result<(), String> {
    let mut last_error = None;
    for delay_ms in CAPTURE_RETRY_DELAYS_MS {
        std::thread::sleep(Duration::from_millis(delay_ms));
        match capture_current_content(clipboard) {
            Ok(Some(content)) => {
                if record_shared_content(history, app, content) {
                    return Ok(());
                }
            }
            Ok(None) => {}
            Err(error) => last_error = Some(error),
        }
    }
    match last_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

struct HistoryHandler {
    app: AppHandle,
    clipboard: Arc<Mutex<Option<ClipboardContext>>>,
    history: Arc<Mutex<ClipboardHistory>>,
    enabled: Arc<AtomicBool>,
}

impl ClipboardHandler for HistoryHandler {
    fn on_clipboard_change(&mut self) {
        if !self.enabled.load(Ordering::Acquire) {
            return;
        }
        if let Err(error) = capture_and_record_with_retry(&self.clipboard, &self.history, &self.app)
        {
            eprintln!("Clipboard history capture failed after retries: {error}");
        }
    }
}

pub struct ClipboardService {
    clipboard: Arc<Mutex<Option<ClipboardContext>>>,
    history: Arc<Mutex<ClipboardHistory>>,
    watcher: Mutex<Option<WatcherShutdown>>,
    enabled: Arc<AtomicBool>,
    monitor_generation: Arc<AtomicU64>,
}

impl Default for ClipboardService {
    fn default() -> Self {
        Self {
            clipboard: Arc::new(Mutex::new(None)),
            history: Arc::new(Mutex::new(ClipboardHistory::default())),
            watcher: Mutex::new(None),
            enabled: Arc::new(AtomicBool::new(false)),
            monitor_generation: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl ClipboardService {
    pub fn set_monitoring(&self, app: &AppHandle, should_monitor: bool) -> Result<(), String> {
        let mut watcher_slot = self
            .watcher
            .lock()
            .map_err(|_| lock_error("clipboard monitor"))?;
        if should_monitor {
            if watcher_slot.is_some() {
                return Ok(());
            }

            with_clipboard(&self.clipboard, |_| Ok(()))?;
            self.enabled.store(true, Ordering::Release);
            let generation = self.monitor_generation.fetch_add(1, Ordering::AcqRel) + 1;

            self.capture_now(app)?;

            let handler = HistoryHandler {
                app: app.clone(),
                clipboard: Arc::clone(&self.clipboard),
                history: Arc::clone(&self.history),
                enabled: Arc::clone(&self.enabled),
            };
            let mut watcher = ClipboardWatcherContext::new()
                .map_err(|error| format!("Could not start clipboard monitoring: {error}"))?;
            watcher.add_handler(handler);
            let shutdown = watcher.get_shutdown_channel();
            *watcher_slot = Some(shutdown);
            let enabled = Arc::clone(&self.enabled);

            if let Err(error) = std::thread::Builder::new()
                .name("arky-clipboard-history".into())
                .spawn(move || {
                    while enabled.load(Ordering::Acquire) {
                        watcher.start_watch();
                        if enabled.load(Ordering::Acquire) {
                            eprintln!(
                                "Clipboard history watcher stopped unexpectedly; restarting."
                            );
                            std::thread::sleep(WATCHER_RESTART_DELAY);
                        }
                    }
                })
            {
                watcher_slot.take();
                self.enabled.store(false, Ordering::Release);
                return Err(format!("Could not start clipboard monitoring: {error}"));
            }

            #[cfg(target_os = "windows")]
            if let Err(error) = self.spawn_windows_watchdog(app, generation) {
                self.enabled.store(false, Ordering::Release);
                self.monitor_generation.fetch_add(1, Ordering::AcqRel);
                watcher_slot.take();
                return Err(error);
            }
        } else {
            self.enabled.store(false, Ordering::Release);
            self.monitor_generation.fetch_add(1, Ordering::AcqRel);
            watcher_slot.take();
            let cleared = self
                .history
                .lock()
                .map_err(|_| lock_error("clipboard history"))?
                .clear();
            if cleared {
                let _ = app.emit(CLIPBOARD_HISTORY_CHANGED_EVENT, 0usize);
            }
        }
        Ok(())
    }

    pub fn capture_now(&self, app: &AppHandle) -> Result<(), String> {
        if let Some(content) = capture_current_content_with_retry(&self.clipboard)? {
            record_shared_content(&self.history, app, content);
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn spawn_windows_watchdog(&self, app: &AppHandle, generation: u64) -> Result<(), String> {
        let app = app.clone();
        let clipboard = Arc::clone(&self.clipboard);
        let history = Arc::clone(&self.history);
        let enabled = Arc::clone(&self.enabled);
        let monitor_generation = Arc::clone(&self.monitor_generation);
        std::thread::Builder::new()
            .name("arky-clipboard-watchdog".into())
            .spawn(move || {
                let mut last_sequence = windows_clipboard_sequence_number();
                if let Ok(Some(content)) = capture_current_content_with_retry(&clipboard) {
                    record_shared_content(&history, &app, content);
                }
                while enabled.load(Ordering::Acquire)
                    && monitor_generation.load(Ordering::Acquire) == generation
                {
                    std::thread::sleep(WINDOWS_WATCHDOG_INTERVAL);
                    let sequence = windows_clipboard_sequence_number();
                    if sequence == 0 || sequence == last_sequence {
                        continue;
                    }
                    last_sequence = sequence;
                    if let Err(error) = capture_and_record_with_retry(&clipboard, &history, &app) {
                        eprintln!("Clipboard watchdog capture failed after retries: {error}");
                    }
                }
            })
            .map(|_| ())
            .map_err(|error| format!("Could not start clipboard monitoring watchdog: {error}"))
    }

    pub fn search(&self, query: &str) -> Result<Vec<ClipboardHistoryPreview>, String> {
        self.history
            .lock()
            .map_err(|_| lock_error("clipboard history"))
            .map(|history| history.search(query))
    }

    pub fn copy_entry(&self, app: &AppHandle, id: u64) -> Result<(), String> {
        let content = self
            .history
            .lock()
            .map_err(|_| lock_error("clipboard history"))?
            .content_for_id(id)
            .ok_or_else(|| "That clipboard history entry is no longer available.".to_string())?;

        match content {
            ClipboardEntryContent::Text(text) => self.set_text(app, text),
            ClipboardEntryContent::Image { png, .. } => {
                let image = RustImageData::from_bytes(&png)
                    .map_err(|error| format!("Could not restore the clipboard image: {error}"))?;
                with_clipboard(&self.clipboard, |clipboard| clipboard.set_image(image))?;
                let changed_and_count = self
                    .history
                    .lock()
                    .ok()
                    .and_then(|mut history| history.touch(id).then_some(history.entries.len()));
                if let Some(count) = changed_and_count {
                    let _ = app.emit(CLIPBOARD_HISTORY_CHANGED_EVENT, count);
                }
                Ok(())
            }
        }
    }

    pub fn set_text(&self, app: &AppHandle, text: String) -> Result<(), String> {
        with_clipboard(&self.clipboard, |clipboard| {
            clipboard.set_text(text.clone())
        })?;
        if self.enabled.load(Ordering::Acquire) {
            record_shared_content(&self.history, app, CapturedClipboardContent::Text(text));
        }
        Ok(())
    }
}

impl Drop for ClipboardService {
    fn drop(&mut self) {
        self.enabled.store(false, Ordering::Release);
        self.monitor_generation.fetch_add(1, Ordering::AcqRel);
        if let Ok(watcher) = self.watcher.get_mut() {
            watcher.take();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image_bytes(marker: u8, size: usize) -> Vec<u8> {
        vec![marker; size]
    }

    #[test]
    fn text_history_is_unique_newest_first_and_capped_at_fifty() {
        let mut history = ClipboardHistory::default();
        for index in 0..55 {
            assert!(history.record_text(format!("entry {index}")));
        }
        assert_eq!(history.entries.len(), MAX_HISTORY_ENTRIES);
        assert!(matches!(
            &history.entries.front().unwrap().content,
            ClipboardEntryContent::Text(text) if text == "entry 54"
        ));
        assert!(matches!(
            &history.entries.back().unwrap().content,
            ClipboardEntryContent::Text(text) if text == "entry 5"
        ));

        let duplicate = match &history.entries[10].content {
            ClipboardEntryContent::Text(text) => text.clone(),
            _ => unreachable!(),
        };
        let prior_id = history.entries[10].id;
        assert!(history.record_text(duplicate.clone()));
        assert_eq!(history.entries.front().unwrap().id, prior_id);
        assert!(!history.record_text(duplicate));
    }

    #[test]
    fn history_enforces_image_count_and_memory_limits() {
        let mut history = ClipboardHistory::default();
        for marker in 0..12 {
            assert!(history.record_image(
                image_bytes(marker, 16),
                image_bytes(marker, 4),
                640,
                480,
            ));
        }
        assert_eq!(history.image_count, MAX_IMAGE_ENTRIES);
        assert_eq!(history.entries.len(), MAX_IMAGE_ENTRIES);
        assert_eq!(history.entries.front().unwrap().id, 12);

        let mut limited = ClipboardHistory::default();
        for marker in 1..=5 {
            assert!(limited.record_image(
                image_bytes(marker, MAX_IMAGE_ENTRY_BYTES - 1),
                Vec::new(),
                1,
                1,
            ));
        }
        assert_eq!(limited.image_count, 4);
        assert!(limited.image_bytes <= MAX_IMAGE_HISTORY_BYTES);
    }

    #[test]
    fn history_ignores_empty_oversized_text_and_images() {
        let mut history = ClipboardHistory::default();
        assert!(!history.record_text(" \n\t ".into()));
        assert!(!history.record_text("x".repeat(MAX_TEXT_ENTRY_BYTES + 1)));
        assert!(!history.record_image(Vec::new(), Vec::new(), 1, 1));
        assert!(!history.record_image(image_bytes(1, MAX_IMAGE_ENTRY_BYTES + 1), Vec::new(), 1, 1,));
        assert!(history.entries.is_empty());
    }

    #[test]
    fn search_matches_full_text_and_excludes_images_when_querying() {
        let mut history = ClipboardHistory::default();
        history.record_text("First line\nsecond line with Search Needle and a long ending".into());
        history.record_image(image_bytes(7, 8), image_bytes(8, 4), 800, 600);
        history.record_text("unrelated".into());

        let all_results = history.search("");
        assert_eq!(all_results.len(), 3);
        assert!(matches!(
            &all_results[1],
            ClipboardHistoryPreview::Image { .. }
        ));

        let results = history.search("search needle");
        assert_eq!(results.len(), 1);
        assert!(matches!(
            &results[0],
            ClipboardHistoryPreview::Text { preview, .. }
                if preview == "First line second line with Search Needle and a long ending"
        ));
    }

    #[test]
    fn duplicate_images_move_to_the_front_without_using_more_memory() {
        let mut history = ClipboardHistory::default();
        history.record_image(image_bytes(1, 8), image_bytes(2, 4), 10, 10);
        history.record_text("newer".into());
        let bytes_before = history.image_bytes;
        let image_id = history.entries.back().unwrap().id;

        assert!(history.record_image(image_bytes(1, 8), image_bytes(9, 4), 10, 10,));
        assert_eq!(history.entries.front().unwrap().id, image_id);
        assert_eq!(history.image_bytes, bytes_before);
        assert_eq!(history.image_count, 1);
    }

    #[test]
    fn capture_retry_recovers_after_transient_clipboard_errors() {
        let mut attempts = 0;
        let captured = retry_capture(&[0, 0, 0], || {
            attempts += 1;
            if attempts < 3 {
                Err("clipboard is temporarily busy".to_string())
            } else {
                Ok(Some("latest clipboard value"))
            }
        })
        .expect("the final capture attempt should succeed");

        assert_eq!(captured, Some("latest clipboard value"));
        assert_eq!(attempts, 3);
    }
}

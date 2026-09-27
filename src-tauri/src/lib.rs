mod clipboard_history;

use clipboard_history::{ClipboardHistoryPreview, ClipboardService, CLIPBOARD_HISTORY_ACTION};
use mouse_position::mouse_position::Mouse;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, State};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use xcap::Window;

#[cfg(target_os = "macos")]
fn default_shortcut() -> String {
    "Alt+Shift+Space".into()
}

#[cfg(not(target_os = "macos"))]
fn default_shortcut() -> String {
    "Ctrl+Shift+Space".into()
}

fn default_show_in_tray() -> bool {
    true
}

fn default_spawn_at_cursor() -> bool {
    true
}

fn default_cancel_by_center() -> bool {
    true
}

fn default_cancel_with_escape() -> bool {
    true
}

fn default_wheel_scale() -> u16 {
    DEFAULT_WHEEL_SCALE
}

fn default_wheel_opacity() -> u8 {
    DEFAULT_WHEEL_OPACITY
}

const MAIN_TRAY_ID: &str = "arky-main-tray";
const CLIPBOARD_PANEL_LABEL: &str = "clipboard-history";
const MAX_IMPORT_BYTES: u64 = 50 * 1024 * 1024;
const BASE_WHEEL_SIZE: f64 = 620.0;
const DEFAULT_WHEEL_SCALE: u16 = 100;
const MIN_WHEEL_SCALE: u16 = 70;
const MAX_WHEEL_SCALE: u16 = 150;
const DEFAULT_WHEEL_OPACITY: u8 = 58;
const MIN_WHEEL_OPACITY: u8 = 20;
const MAX_WHEEL_OPACITY: u8 = 100;
const CONFIG_SCHEMA_VERSION: u8 = 2;
const DEFAULT_PROFILE_ID: &str = "default";
const ACTIVE_PROFILE_CHANGED_EVENT: &str = "active-profile-changed";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Segment {
    id: String,
    label: String,
    icon: String,
    #[serde(default)]
    app_icon: Option<String>,
    action_type: String,
    payload: String,
    quick_key: String,
    #[serde(default)]
    children: Vec<Segment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WheelProfile {
    id: String,
    name: String,
    segments: Vec<Segment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppConfig {
    schema_version: u8,
    active_profile_id: String,
    profiles: Vec<WheelProfile>,
    #[serde(default = "default_shortcut")]
    shortcut: String,
    #[serde(default)]
    launch_at_login: bool,
    #[serde(default = "default_show_in_tray")]
    show_in_tray: bool,
    #[serde(default = "default_spawn_at_cursor")]
    spawn_at_cursor: bool,
    #[serde(default = "default_cancel_by_center")]
    cancel_by_center: bool,
    #[serde(default = "default_cancel_with_escape")]
    cancel_with_escape: bool,
    #[serde(default = "default_wheel_scale")]
    wheel_scale: u16,
    #[serde(default = "default_wheel_opacity")]
    wheel_opacity: u8,
}

#[derive(Debug, Clone, Deserialize)]
struct LegacyWheelConfig {
    segments: Vec<Segment>,
    #[serde(default = "default_shortcut")]
    shortcut: String,
    #[serde(default)]
    launch_at_login: bool,
    #[serde(default = "default_show_in_tray")]
    show_in_tray: bool,
    #[serde(default = "default_spawn_at_cursor")]
    spawn_at_cursor: bool,
    #[serde(default = "default_cancel_by_center")]
    cancel_by_center: bool,
    #[serde(default = "default_cancel_with_escape")]
    cancel_with_escape: bool,
    #[serde(default = "default_wheel_scale")]
    wheel_scale: u16,
    #[serde(default = "default_wheel_opacity")]
    wheel_opacity: u8,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum StoredConfig {
    Current(AppConfig),
    Legacy(LegacyWheelConfig),
}

fn default_segments() -> Vec<Segment> {
    vec![
        Segment {
            id: "1".into(),
            label: "Search".into(),
            icon: "Search".into(),
            app_icon: None,
            action_type: "open_url_or_file".into(),
            payload: "https://google.com".into(),
            quick_key: "1".into(),
            children: vec![],
        },
        Segment {
            id: "2".into(),
            label: "Sign-off".into(),
            icon: "NotebookPen".into(),
            app_icon: None,
            action_type: "snippet".into(),
            payload: "Best,\n".into(),
            quick_key: "2".into(),
            children: vec![],
        },
    ]
}

fn default_config() -> AppConfig {
    AppConfig {
        schema_version: CONFIG_SCHEMA_VERSION,
        active_profile_id: DEFAULT_PROFILE_ID.into(),
        profiles: vec![WheelProfile {
            id: DEFAULT_PROFILE_ID.into(),
            name: "Default".into(),
            segments: default_segments(),
        }],
        shortcut: default_shortcut(),
        launch_at_login: false,
        show_in_tray: true,
        spawn_at_cursor: true,
        cancel_by_center: true,
        cancel_with_escape: true,
        wheel_scale: DEFAULT_WHEEL_SCALE,
        wheel_opacity: DEFAULT_WHEEL_OPACITY,
    }
}

fn segment_uses_clipboard_history(segment: &Segment) -> bool {
    segment.action_type == CLIPBOARD_HISTORY_ACTION
        || segment.children.iter().any(segment_uses_clipboard_history)
}

fn config_uses_clipboard_history(config: &AppConfig) -> bool {
    config
        .profiles
        .iter()
        .any(|profile| profile.segments.iter().any(segment_uses_clipboard_history))
}

fn migrate_legacy_config(legacy: LegacyWheelConfig) -> AppConfig {
    AppConfig {
        schema_version: CONFIG_SCHEMA_VERSION,
        active_profile_id: DEFAULT_PROFILE_ID.into(),
        profiles: vec![WheelProfile {
            id: DEFAULT_PROFILE_ID.into(),
            name: "Default".into(),
            segments: legacy.segments,
        }],
        shortcut: legacy.shortcut,
        launch_at_login: legacy.launch_at_login,
        show_in_tray: legacy.show_in_tray,
        spawn_at_cursor: legacy.spawn_at_cursor,
        cancel_by_center: legacy.cancel_by_center,
        cancel_with_escape: legacy.cancel_with_escape,
        wheel_scale: legacy.wheel_scale,
        wheel_opacity: legacy.wheel_opacity,
    }
}

fn parse_stored_config(text: &str) -> Result<(AppConfig, bool), serde_json::Error> {
    match serde_json::from_str::<StoredConfig>(text)? {
        StoredConfig::Current(config) => Ok((config, false)),
        StoredConfig::Legacy(config) => Ok((migrate_legacy_config(config), true)),
    }
}

fn config_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("config.json")
}

fn legacy_config_backup_path(app: &AppHandle) -> PathBuf {
    config_path(app).with_file_name("config.v1.backup.json")
}

#[cfg(target_os = "windows")]
fn replace_file_atomically(source: &Path, destination: &Path) -> Result<(), String> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::Storage::FileSystem::{ReplaceFileW, REPLACEFILE_WRITE_THROUGH};

    let source = HSTRING::from(source.as_os_str().to_string_lossy().as_ref());
    let destination = HSTRING::from(destination.as_os_str().to_string_lossy().as_ref());
    unsafe {
        ReplaceFileW(
            &destination,
            &source,
            PCWSTR::null(),
            REPLACEFILE_WRITE_THROUGH,
            None,
            None,
        )
    }
    .map_err(|error| format!("Could not replace the configuration file: {error}"))
}

#[cfg(not(target_os = "windows"))]
fn replace_file_atomically(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination)
        .map_err(|error| format!("Could not replace the configuration file: {error}"))
}

fn write_text_atomically(path: &Path, text: &str) -> Result<(), String> {
    let temporary = path.with_file_name(format!(".config-{}.tmp", uuid::Uuid::new_v4().simple()));
    fs::write(&temporary, text)
        .map_err(|error| format!("Could not write the configuration: {error}"))?;
    let result = if path.exists() {
        replace_file_atomically(&temporary, path)
    } else {
        fs::rename(&temporary, path)
            .map_err(|error| format!("Could not save the configuration: {error}"))
    };
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn load_config_from_disk(app: &AppHandle) -> AppConfig {
    let path = config_path(app);
    match fs::read_to_string(&path) {
        Ok(text) => {
            let Ok((mut config, migrated)) = parse_stored_config(&text) else {
                return default_config();
            };
            let mut should_save = migrated;
            if migrated {
                let backup_path = legacy_config_backup_path(app);
                if !backup_path.exists() {
                    let _ = fs::write(backup_path, &text);
                }
            }
            #[cfg(target_os = "macos")]
            let raw_trigger_default = config.shortcut == "Alt+Shift";
            #[cfg(not(target_os = "macos"))]
            let raw_trigger_default = config.shortcut == "Ctrl+Shift";

            if raw_trigger_default {
                config.shortcut = default_shortcut();
                should_save = true;
            }
            if should_save && validate_config(&config).is_ok() {
                let _ = save_config_to_disk(app, &config);
            }
            config
        }
        Err(_) => {
            let cfg = default_config();
            let _ = save_config_to_disk(app, &cfg);
            cfg
        }
    }
}

fn save_config_to_disk(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app);
    let text = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Could not serialize the configuration: {error}"))?;
    write_text_atomically(&path, &text)
}

#[tauri::command]
fn get_config(app: AppHandle) -> AppConfig {
    load_config_from_disk(&app)
}

fn set_launch_at_login(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|error| format!("Could not update launch-at-login: {error}"))
}

fn set_tray_visibility(app: &AppHandle, visible: bool) -> Result<(), String> {
    app.tray_by_id(MAIN_TRAY_ID)
        .ok_or_else(|| "The system tray icon is not available.".to_string())?
        .set_visible(visible)
        .map_err(|error| format!("Could not update system tray visibility: {error}"))
}

fn validate_config(config: &AppConfig) -> Result<(), String> {
    if config.schema_version != CONFIG_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported configuration schema version {}.",
            config.schema_version
        ));
    }
    if config.profiles.is_empty() {
        return Err("Keep at least one wheel profile.".into());
    }
    let mut profile_ids = HashSet::new();
    let mut profile_names = HashSet::new();
    for profile in &config.profiles {
        if profile.id.trim().is_empty() || !profile_ids.insert(profile.id.as_str()) {
            return Err("Every wheel profile must have a unique ID.".into());
        }
        let name = profile.name.trim();
        if name.is_empty() {
            return Err("Every wheel profile must have a name.".into());
        }
        if name.chars().count() > 50 {
            return Err("Wheel profile names can contain up to 50 characters.".into());
        }
        if !profile_names.insert(name.to_lowercase()) {
            return Err("Wheel profile names must be unique.".into());
        }
    }
    if !profile_ids.contains(config.active_profile_id.as_str()) {
        return Err("The active wheel profile does not exist.".into());
    }
    if config.shortcut.trim().is_empty() {
        return Err("The global shortcut cannot be empty.".into());
    }
    if !config.cancel_by_center && !config.cancel_with_escape {
        return Err("Keep at least one wheel cancellation method enabled.".into());
    }
    if !(MIN_WHEEL_SCALE..=MAX_WHEEL_SCALE).contains(&config.wheel_scale) {
        return Err(format!(
            "Wheel size must be between {MIN_WHEEL_SCALE}% and {MAX_WHEEL_SCALE}%."
        ));
    }
    if !(MIN_WHEEL_OPACITY..=MAX_WHEEL_OPACITY).contains(&config.wheel_opacity) {
        return Err(format!(
            "Wheel opacity must be between {MIN_WHEEL_OPACITY}% and {MAX_WHEEL_OPACITY}%."
        ));
    }
    Ok(())
}

fn update_active_profile(config: &mut AppConfig, profile_id: &str) -> Result<bool, String> {
    if !config
        .profiles
        .iter()
        .any(|profile| profile.id == profile_id)
    {
        return Err("The selected wheel profile does not exist.".into());
    }
    if config.active_profile_id == profile_id {
        return Ok(false);
    }
    config.active_profile_id = profile_id.into();
    Ok(true)
}

fn parse_config_backup(text: &str) -> Result<AppConfig, String> {
    let (config, _) = parse_stored_config(text)
        .map_err(|error| format!("The selected file is not a valid Arky configuration: {error}"))?;
    validate_config(&config)?;
    Ok(config)
}

fn rollback_runtime_settings(app: &AppHandle, previous: &AppConfig, attempted: &AppConfig) {
    if previous.shortcut != attempted.shortcut {
        let _ = app
            .global_shortcut()
            .unregister(attempted.shortcut.as_str());
        let _ = app.global_shortcut().register(previous.shortcut.as_str());
    }
    if previous.show_in_tray != attempted.show_in_tray {
        let _ = set_tray_visibility(app, previous.show_in_tray);
    }
    if previous.launch_at_login != attempted.launch_at_login {
        let _ = set_launch_at_login(app, previous.launch_at_login);
    }
}

#[tauri::command]
fn save_config(
    app: AppHandle,
    clipboard: State<'_, ClipboardService>,
    config: AppConfig,
) -> Result<(), String> {
    validate_config(&config)?;

    let previous = load_config_from_disk(&app);
    if previous.launch_at_login != config.launch_at_login {
        set_launch_at_login(&app, config.launch_at_login)?;
    }
    if previous.show_in_tray != config.show_in_tray {
        if let Err(error) = set_tray_visibility(&app, config.show_in_tray) {
            if previous.launch_at_login != config.launch_at_login {
                let _ = set_launch_at_login(&app, previous.launch_at_login);
            }
            return Err(error);
        }
    }
    if previous.shortcut != config.shortcut {
        if let Err(error) = app.global_shortcut().unregister(previous.shortcut.as_str()) {
            if previous.show_in_tray != config.show_in_tray {
                let _ = set_tray_visibility(&app, previous.show_in_tray);
            }
            if previous.launch_at_login != config.launch_at_login {
                let _ = set_launch_at_login(&app, previous.launch_at_login);
            }
            return Err(format!(
                "Could not unregister the previous shortcut: {error}"
            ));
        }

        if let Err(error) = app.global_shortcut().register(config.shortcut.as_str()) {
            if previous.launch_at_login != config.launch_at_login {
                let _ = set_launch_at_login(&app, previous.launch_at_login);
            }
            if previous.show_in_tray != config.show_in_tray {
                let _ = set_tray_visibility(&app, previous.show_in_tray);
            }
            return match app.global_shortcut().register(previous.shortcut.as_str()) {
                Ok(()) => Err(format!(
                    "Could not register {}. The previous shortcut is still active: {error}",
                    config.shortcut
                )),
                Err(rollback_error) => Err(format!(
                    "Could not register {} and could not restore the previous shortcut ({rollback_error}): {error}",
                    config.shortcut
                )),
            };
        }
    }

    if let Err(error) = save_config_to_disk(&app, &config) {
        rollback_runtime_settings(&app, &previous, &config);
        return Err(error);
    }
    if let Err(error) = clipboard.set_monitoring(&app, config_uses_clipboard_history(&config)) {
        eprintln!("{error}");
    }
    app.emit("config-updated", ()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_active_profile(app: AppHandle, profile_id: String) -> Result<(), String> {
    let mut config = load_config_from_disk(&app);
    if !update_active_profile(&mut config, &profile_id)? {
        return Ok(());
    }
    validate_config(&config)?;
    save_config_to_disk(&app, &config)?;
    app.emit(ACTIVE_PROFILE_CHANGED_EVENT, profile_id)
        .map_err(|error| format!("Could not notify windows of the active profile change: {error}"))
}

#[tauri::command]
fn export_config(config: AppConfig, path: String) -> Result<String, String> {
    validate_config(&config)?;
    let mut destination = PathBuf::from(path);
    if !destination.is_absolute() {
        return Err("Choose an absolute path for the configuration backup.".into());
    }
    if destination.extension().is_none() {
        destination.set_extension("json");
    }
    let text = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Could not serialize the configuration backup: {error}"))?;
    fs::write(&destination, text)
        .map_err(|error| format!("Could not export the configuration: {error}"))?;
    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
fn import_config(
    app: AppHandle,
    clipboard: State<'_, ClipboardService>,
    path: String,
) -> Result<AppConfig, String> {
    let source = PathBuf::from(path);
    if !source.is_absolute() {
        return Err("Choose an absolute path to a configuration backup.".into());
    }
    let metadata = fs::metadata(&source)
        .map_err(|error| format!("Could not open the configuration backup: {error}"))?;
    if !metadata.is_file() {
        return Err("The selected configuration backup is not a file.".into());
    }
    if metadata.len() > MAX_IMPORT_BYTES {
        return Err("The selected configuration backup is larger than 50 MB.".into());
    }
    let text = fs::read_to_string(&source)
        .map_err(|error| format!("Could not read the configuration backup: {error}"))?;
    let config = parse_config_backup(&text)?;
    save_config(app, clipboard, config.clone())?;
    Ok(config)
}

#[tauri::command]
fn get_platform() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "linux")]
    {
        "linux"
    }
}

fn checked_application_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    if !candidate.is_absolute() {
        return Err("Choose an application using the native file picker.".into());
    }
    if !candidate.exists() {
        return Err("The selected application no longer exists.".into());
    }

    #[cfg(target_os = "windows")]
    {
        let is_executable = candidate
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"));
        if !candidate.is_file() || !is_executable {
            return Err("Choose a Windows .exe file.".into());
        }
    }

    #[cfg(target_os = "macos")]
    {
        let is_app_bundle = candidate
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("app"));
        if !candidate.is_dir() || !is_app_bundle {
            return Err("Choose a macOS .app application bundle.".into());
        }
    }

    #[cfg(target_os = "linux")]
    {
        if !candidate.is_file() {
            return Err("Choose an executable file.".into());
        }
    }

    Ok(candidate)
}

#[derive(Serialize)]
struct PreparedApplication {
    path: String,
    icon_base64: Option<String>,
    icon_error: Option<String>,
}

#[derive(Serialize)]
struct InstalledApplication {
    name: String,
    path: String,
    icon_base64: Option<String>,
}

fn application_name_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("Application")
        .to_string()
}

fn collect_files_with_extension(
    directory: &Path,
    extension: &str,
    depth: usize,
    matches: &mut Vec<PathBuf>,
) {
    if depth == 0 {
        return;
    }

    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_files_with_extension(&path, extension, depth - 1, matches);
        } else if file_type.is_file()
            && path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case(extension))
        {
            matches.push(path);
        }
    }
}

#[cfg(target_os = "windows")]
fn windows_known_folder_path(folder_id: &windows::core::GUID) -> Result<PathBuf, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::UI::Shell::{SHGetKnownFolderPath, KF_FLAG_DEFAULT};

    let raw_path = unsafe { SHGetKnownFolderPath(folder_id, KF_FLAG_DEFAULT, None) }
        .map_err(|error| format!("Could not locate a Windows Start Menu folder: {error}"))?;
    let path = unsafe {
        let mut length = 0;
        while *raw_path.0.add(length) != 0 {
            length += 1;
        }
        let value = OsString::from_wide(std::slice::from_raw_parts(raw_path.0, length));
        CoTaskMemFree(Some(raw_path.0.cast()));
        PathBuf::from(value)
    };
    Ok(path)
}

#[cfg(target_os = "windows")]
fn resolve_windows_shortcut(shortcut_path: &Path) -> Result<PathBuf, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::ffi::OsStringExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, IPersistFile, CLSCTX_INPROC_SERVER, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

    let shortcut: IShellLinkW = unsafe {
        CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
            .map_err(|error| format!("Could not open the shortcut: {error}"))?
    };
    let persisted: IPersistFile = shortcut
        .cast()
        .map_err(|error| format!("Could not read the shortcut: {error}"))?;
    let shortcut_wide: Vec<u16> = shortcut_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    unsafe { persisted.Load(PCWSTR(shortcut_wide.as_ptr()), STGM_READ) }
        .map_err(|error| format!("Could not load the shortcut: {error}"))?;

    let mut target = vec![0u16; 32_768];
    unsafe { shortcut.GetPath(&mut target, std::ptr::null_mut(), 0) }
        .map_err(|error| format!("Could not resolve the shortcut target: {error}"))?;
    let length = target
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(target.len());
    if length == 0 {
        return Err("The shortcut does not point to a filesystem application.".into());
    }
    Ok(PathBuf::from(OsString::from_wide(&target[..length])))
}

#[cfg(target_os = "windows")]
fn installed_applications() -> Result<Vec<InstalledApplication>, String> {
    use std::collections::HashSet;
    use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{FOLDERID_CommonPrograms, FOLDERID_Programs};

    let com_status = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    let uninitialize_com = com_status.is_ok();
    if com_status.is_err() && com_status != RPC_E_CHANGED_MODE {
        return Err(format!(
            "Could not initialize Windows shortcut discovery: {}",
            com_status.message()
        ));
    }

    let result = (|| {
        let roots = [
            windows_known_folder_path(&FOLDERID_Programs),
            windows_known_folder_path(&FOLDERID_CommonPrograms),
        ];
        let mut shortcuts = Vec::new();
        let mut located_root = false;
        for root in roots.into_iter().flatten() {
            located_root = true;
            collect_files_with_extension(&root, "lnk", 12, &mut shortcuts);
        }
        if !located_root {
            return Err("Could not locate either Windows Start Menu Programs folder.".into());
        }

        let mut seen_paths = HashSet::new();
        let mut applications = Vec::new();
        for shortcut in shortcuts {
            let Ok(target) = resolve_windows_shortcut(&shortcut) else {
                continue;
            };
            let Ok(application) = checked_application_path(&target.to_string_lossy()) else {
                continue;
            };
            let key = comparable_path(&application)
                .to_string_lossy()
                .to_lowercase();
            if !seen_paths.insert(key) {
                continue;
            }
            applications.push(InstalledApplication {
                name: application_name_from_path(&shortcut),
                icon_base64: extract_application_icon(&application).ok(),
                path: application.to_string_lossy().into_owned(),
            });
        }
        Ok(applications)
    })();

    if uninitialize_com {
        unsafe { CoUninitialize() };
    }
    result
}

#[cfg(target_os = "macos")]
fn macos_application_name(path: &Path) -> String {
    use plist::Value;

    Value::from_file(path.join("Contents").join("Info.plist"))
        .ok()
        .and_then(|plist| {
            let dictionary = plist.as_dictionary()?;
            ["CFBundleDisplayName", "CFBundleName"]
                .into_iter()
                .find_map(|key| dictionary.get(key).and_then(Value::as_string))
                .filter(|name| !name.trim().is_empty())
                .map(str::to_string)
        })
        .unwrap_or_else(|| application_name_from_path(path))
}

#[cfg(target_os = "macos")]
fn collect_macos_applications(directory: &Path, depth: usize, matches: &mut Vec<PathBuf>) {
    if depth == 0 {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let is_application = path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("app"));
        if is_application && path.is_dir() {
            matches.push(path);
        } else if file_type.is_dir() && !file_type.is_symlink() {
            collect_macos_applications(&path, depth - 1, matches);
        }
    }
}

#[cfg(target_os = "macos")]
fn installed_applications() -> Result<Vec<InstalledApplication>, String> {
    use std::collections::HashSet;

    let mut roots = vec![
        PathBuf::from("/Applications"),
        PathBuf::from("/System/Applications"),
    ];
    if let Some(home) = std::env::var_os("HOME") {
        roots.push(PathBuf::from(home).join("Applications"));
    }

    let mut bundles = Vec::new();
    for root in roots {
        collect_macos_applications(&root, 6, &mut bundles);
    }
    let mut seen_paths = HashSet::new();
    let mut applications = Vec::new();
    for application in bundles {
        let key = comparable_path(&application);
        if !seen_paths.insert(key) {
            continue;
        }
        applications.push(InstalledApplication {
            name: macos_application_name(&application),
            icon_base64: extract_application_icon(&application).ok(),
            path: application.to_string_lossy().into_owned(),
        });
    }
    Ok(applications)
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn installed_applications() -> Result<Vec<InstalledApplication>, String> {
    Ok(Vec::new())
}

#[tauri::command]
async fn list_installed_applications() -> Result<Vec<InstalledApplication>, String> {
    tauri::async_runtime::spawn_blocking(installed_applications)
        .await
        .map_err(|error| format!("Installed-app discovery stopped unexpectedly: {error}"))?
        .map(|mut applications| {
            applications.sort_by(|left, right| {
                left.name
                    .to_lowercase()
                    .cmp(&right.name.to_lowercase())
                    .then_with(|| left.path.cmp(&right.path))
            });
            applications
        })
}

#[cfg(target_os = "windows")]
fn extract_application_icon(path: &Path) -> Result<String, String> {
    windows_icons::get_icon_base64_by_path(path)
        .map_err(|error| format!("Windows could not extract this application icon: {error}"))
}

#[cfg(target_os = "macos")]
fn extract_application_icon(path: &Path) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use plist::Value;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    let contents = path.join("Contents");
    let info_path = contents.join("Info.plist");
    let plist = Value::from_file(&info_path)
        .map_err(|error| format!("Could not read {}: {error}", info_path.display()))?;
    let icon_name = plist
        .as_dictionary()
        .and_then(|dictionary| dictionary.get("CFBundleIconFile"))
        .and_then(Value::as_string)
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| "The application does not define CFBundleIconFile.".to_string())?;

    let mut icon_path = contents.join("Resources").join(icon_name);
    if icon_path.extension().is_none() {
        icon_path.set_extension("icns");
    }
    if !icon_path.is_file() {
        return Err(format!(
            "The application icon does not exist at {}.",
            icon_path.display()
        ));
    }

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Could not create a temporary icon name: {error}"))?
        .as_nanos();
    let output_path =
        std::env::temp_dir().join(format!("arky-app-icon-{}-{unique}.png", std::process::id()));
    let output = Command::new("sips")
        .args(["-s", "format", "png"])
        .arg(&icon_path)
        .arg("--out")
        .arg(&output_path)
        .output()
        .map_err(|error| format!("Could not start sips: {error}"))?;

    if !output.status.success() {
        let _ = fs::remove_file(&output_path);
        let details = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "sips could not convert the application icon: {details}"
        ));
    }

    let png = fs::read(&output_path)
        .map_err(|error| format!("Could not read the converted application icon: {error}"));
    let _ = fs::remove_file(&output_path);
    png.map(|bytes| STANDARD.encode(bytes))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn extract_application_icon(_path: &Path) -> Result<String, String> {
    Err("Application icon extraction is not supported on this platform.".into())
}

#[tauri::command]
fn prepare_application(path: String) -> Result<PreparedApplication, String> {
    let application = checked_application_path(&path)?;
    let icon = extract_application_icon(&application);
    let (icon_base64, icon_error) = match icon {
        Ok(icon_base64) => (Some(icon_base64), None),
        Err(error) => (None, Some(error)),
    };

    Ok(PreparedApplication {
        path: application.to_string_lossy().into_owned(),
        icon_base64,
        icon_error,
    })
}

#[derive(Serialize)]
struct RunningWindowState {
    window_id: Option<u32>,
    window_title: Option<String>,
    preview_data: Option<String>,
    preview_error: Option<String>,
}

#[derive(Serialize)]
struct RunningAppState {
    running: bool,
    windows: Vec<RunningWindowState>,
}

#[cfg(target_os = "macos")]
fn application_executable_path(application: &Path) -> Result<PathBuf, String> {
    use plist::Value;

    let info_path = application.join("Contents").join("Info.plist");
    let plist = Value::from_file(&info_path)
        .map_err(|error| format!("Could not read {}: {error}", info_path.display()))?;
    let executable = plist
        .as_dictionary()
        .and_then(|dictionary| dictionary.get("CFBundleExecutable"))
        .and_then(Value::as_string)
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| "The application does not define CFBundleExecutable.".to_string())?;
    Ok(application.join("Contents").join("MacOS").join(executable))
}

#[cfg(not(target_os = "macos"))]
fn application_executable_path(application: &Path) -> Result<PathBuf, String> {
    Ok(application.to_path_buf())
}

fn comparable_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn application_paths_match(left: &Path, right: &Path) -> bool {
    let left = comparable_path(left);
    let right = comparable_path(right);

    #[cfg(target_os = "windows")]
    {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    }
    #[cfg(not(target_os = "windows"))]
    {
        left == right
    }
}

fn matching_application_process_ids(application: &Path) -> Result<Vec<u32>, String> {
    let executable = application_executable_path(application)?;
    let system = sysinfo::System::new_all();
    Ok(system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            process
                .exe()
                .filter(|path| application_paths_match(path, &executable))
                .map(|_| pid.as_u32())
        })
        .collect())
}

#[cfg(target_os = "windows")]
fn is_user_facing_windows_window(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetAncestor, GetWindow, GetWindowLongPtrW, IsWindow, IsWindowVisible, GA_ROOT, GWL_EXSTYLE,
        GW_OWNER, WINDOW_EX_STYLE, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    unsafe {
        if !IsWindow(Some(hwnd)).as_bool()
            || !IsWindowVisible(hwnd).as_bool()
            || GetAncestor(hwnd, GA_ROOT) != hwnd
        {
            return false;
        }

        let extended_style = WINDOW_EX_STYLE(GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32);
        if extended_style.contains(WS_EX_TOOLWINDOW) || extended_style.contains(WS_EX_NOACTIVATE) {
            return false;
        }

        let has_owner = GetWindow(hwnd, GW_OWNER).is_ok();
        !has_owner || extended_style.contains(WS_EX_APPWINDOW)
    }
}

#[cfg(target_os = "windows")]
fn is_user_facing_window(window: &Window) -> bool {
    use std::ffi::c_void;
    use windows::Win32::Foundation::HWND;

    window.id().is_ok_and(|window_id| {
        is_user_facing_windows_window(HWND(window_id as usize as *mut c_void))
    })
}

#[cfg(not(target_os = "windows"))]
fn is_user_facing_window(_window: &Window) -> bool {
    // xcap's macOS and Linux enumerators already expose their platforms'
    // visible, shareable top-level window lists. Windows needs the extra
    // task-switcher-style filtering above because its enumerator admits
    // titled tool and owned helper windows.
    true
}

fn app_windows(process_ids: &[u32]) -> Result<Vec<Window>, String> {
    let mut windows = Window::all()
        .map_err(|error| format!("Could not enumerate application windows: {error}"))?
        .into_iter()
        .filter(|window| {
            window.pid().is_ok_and(|pid| process_ids.contains(&pid))
                && is_user_facing_window(window)
        })
        .collect::<Vec<_>>();

    // xcap's enumeration order can follow z-order and change as focus moves.
    // A stable ID order prevents preview wedges from jumping between refreshes.
    windows.sort_by_key(|window| window.id().unwrap_or(u32::MAX));
    Ok(windows)
}

fn capture_window_preview(window: &Window) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::{DynamicImage, ImageFormat};

    if window.is_minimized().unwrap_or(false) {
        return Err("The application window is minimized.".into());
    }

    let image = window
        .capture_image()
        .map_err(|error| format!("Could not capture the application window: {error}"))?;
    let thumbnail = DynamicImage::ImageRgba8(image).thumbnail(360, 220);
    let mut output = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|error| format!("Could not encode the application preview: {error}"))?;
    Ok(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(output.into_inner())
    ))
}

#[tauri::command]
fn get_running_app_state(path: String, include_preview: bool) -> Result<RunningAppState, String> {
    let application = checked_application_path(&path)?;
    let process_ids = matching_application_process_ids(&application)?;
    if process_ids.is_empty() {
        return Ok(RunningAppState {
            running: false,
            windows: Vec::new(),
        });
    }

    let windows = app_windows(&process_ids)?
        .iter()
        .map(|window| {
            let window_id = window.id().ok();
            let window_title = window.title().ok().filter(|title| !title.trim().is_empty());
            let (preview_data, preview_error) = if include_preview {
                match capture_window_preview(window) {
                    Ok(preview) => (Some(preview), None),
                    Err(error) => (None, Some(error)),
                }
            } else {
                (None, None)
            };

            RunningWindowState {
                window_id,
                window_title,
                preview_data,
                preview_error,
            }
        })
        .collect();

    Ok(RunningAppState {
        running: true,
        windows,
    })
}

#[cfg(target_os = "windows")]
fn focus_windows_process(
    process_ids: &[u32],
    requested_window_id: Option<u32>,
) -> Result<(), String> {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowThreadProcessId, IsIconic, SetForegroundWindow, ShowWindowAsync,
        SW_RESTORE,
    };

    struct WindowSearch<'a> {
        process_ids: &'a [u32],
        requested_window_id: Option<u32>,
        fallback: Option<HWND>,
        selected: Option<HWND>,
    }

    unsafe extern "system" fn find_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam.0 as *mut WindowSearch<'_>);
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if !search.process_ids.contains(&pid) || !is_user_facing_windows_window(hwnd) {
            return BOOL(1);
        }

        if search.fallback.is_none() {
            search.fallback = Some(hwnd);
        }
        let window_id = hwnd.0 as usize as u32;
        if search
            .requested_window_id
            .is_some_and(|requested| requested == window_id)
        {
            search.selected = Some(hwnd);
            return BOOL(0);
        }
        BOOL(1)
    }

    let mut search = WindowSearch {
        process_ids,
        requested_window_id,
        fallback: None,
        selected: None,
    };
    unsafe {
        let _ = EnumWindows(
            Some(find_window),
            LPARAM(&mut search as *mut WindowSearch<'_> as isize),
        );
    }
    let hwnd = search
        .selected
        .or(search.fallback)
        .ok_or_else(|| "The application has no visible window to focus.".to_string())?;

    unsafe {
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindowAsync(hwnd, SW_RESTORE);
        }
        if !SetForegroundWindow(hwnd).as_bool() {
            return Err("Windows did not allow Arky to move that window to the foreground.".into());
        }
    }
    Ok(())
}

#[tauri::command]
fn focus_running_app(app: AppHandle, path: String, window_id: Option<u32>) -> Result<(), String> {
    let application = checked_application_path(&path)?;
    let process_ids = matching_application_process_ids(&application)?;
    if process_ids.is_empty() {
        return Err("The application is no longer running.".into());
    }
    let _ = hide_wheel(app);

    #[cfg(target_os = "windows")]
    {
        focus_windows_process(&process_ids, window_id)
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(application)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not activate the running application: {error}"))
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new(application)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not activate the running application: {error}"))
    }
}

#[tauri::command]
fn launch_new_app_instance(app: AppHandle, path: String) -> Result<(), String> {
    let application = checked_application_path(&path)?;
    let _ = hide_wheel(app);

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-n")
            .arg(application)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not request a new application instance: {error}"))
    }
    #[cfg(not(target_os = "macos"))]
    {
        std::process::Command::new(application)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not request a new application instance: {error}"))
    }
}

#[tauri::command]
fn hide_wheel(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("wheel") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Clipboard access can block inside platform APIs. Keep it off Tauri's event-loop thread so a
// slow or unavailable clipboard cannot make the rest of the application unresponsive.
#[tauri::command(async)]
fn get_clipboard_history(
    app: AppHandle,
    clipboard: State<'_, ClipboardService>,
    query: String,
) -> Result<Vec<ClipboardHistoryPreview>, String> {
    clipboard.set_monitoring(&app, true)?;
    clipboard.search(&query)
}

#[tauri::command(async)]
fn copy_clipboard_history_entry(
    app: AppHandle,
    clipboard: State<'_, ClipboardService>,
    id: u64,
) -> Result<(), String> {
    clipboard.copy_entry(&app, id)
}

fn hide_clipboard_history_panel_inner(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(CLIPBOARD_PANEL_LABEL) {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_clipboard_history_panel(app: AppHandle) -> Result<(), String> {
    hide_clipboard_history_panel_inner(&app)
}

fn centered_over_anchor_position(
    anchor_position: PhysicalPosition<i32>,
    anchor_size: PhysicalSize<u32>,
    panel_size: PhysicalSize<u32>,
    monitor_position: PhysicalPosition<i32>,
    monitor_size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let centered_and_clamped = |anchor_origin: i32,
                                anchor_extent: u32,
                                panel_extent: u32,
                                monitor_origin: i32,
                                monitor_extent: u32| {
        let target =
            i64::from(anchor_origin) + (i64::from(anchor_extent) - i64::from(panel_extent)) / 2;
        let minimum = i64::from(monitor_origin);
        let maximum = (minimum + i64::from(monitor_extent) - i64::from(panel_extent)).max(minimum);
        target.clamp(minimum, maximum) as i32
    };

    PhysicalPosition::new(
        centered_and_clamped(
            anchor_position.x,
            anchor_size.width,
            panel_size.width,
            monitor_position.x,
            monitor_size.width,
        ),
        centered_and_clamped(
            anchor_position.y,
            anchor_size.height,
            panel_size.height,
            monitor_position.y,
            monitor_size.height,
        ),
    )
}

fn show_clipboard_history_panel_inner(app: &AppHandle) -> Result<(), String> {
    let wheel = app
        .get_webview_window("wheel")
        .ok_or_else(|| "The Wheel window is unavailable.".to_string())?;
    let anchor_position = wheel.outer_position().ok();
    let anchor_size = wheel.outer_size().ok();
    let anchor_monitor = wheel.current_monitor().ok().flatten();
    let panel = app
        .get_webview_window(CLIPBOARD_PANEL_LABEL)
        .ok_or_else(|| "The clipboard history panel is unavailable.".to_string())?;

    if let (Some(anchor_position), Some(anchor_size), Ok(panel_size), Some(monitor)) = (
        anchor_position,
        anchor_size,
        panel.outer_size(),
        anchor_monitor,
    ) {
        let target = centered_over_anchor_position(
            anchor_position,
            anchor_size,
            panel_size,
            *monitor.position(),
            *monitor.size(),
        );
        panel
            .set_position(target)
            .map_err(|error| format!("Could not position the clipboard history panel: {error}"))?;
    }

    wheel.hide().map_err(|error| error.to_string())?;
    panel.show().map_err(|error| error.to_string())?;
    panel.set_focus().map_err(|error| error.to_string())?;
    let _ = app.emit_to(CLIPBOARD_PANEL_LABEL, "clipboard-panel-opened", ());
    Ok(())
}

fn has_uri_scheme(target: &str) -> bool {
    let Some(separator) = target.find(':') else {
        return false;
    };
    let scheme = &target[..separator];
    let remainder = &target[separator + 1..];
    let port_end = remainder.find(['/', '?', '#']).unwrap_or(remainder.len());
    if scheme.contains('.')
        && port_end > 0
        && remainder[..port_end]
            .bytes()
            .all(|byte| byte.is_ascii_digit())
    {
        return false;
    }

    let mut characters = scheme.chars();
    characters
        .next()
        .is_some_and(|first| first.is_ascii_alphabetic())
        && characters.all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '+' | '-' | '.')
        })
}

fn is_explicit_local_path(target: &str) -> bool {
    let bytes = target.as_bytes();
    let has_windows_drive = bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':';

    has_windows_drive
        || target.starts_with('/')
        || target.starts_with('\\')
        || target.starts_with("./")
        || target.starts_with("../")
        || target.starts_with(".\\")
        || target.starts_with("..\\")
        || target.contains('\\')
}

fn looks_like_bare_domain(target: &str) -> bool {
    if target.is_empty() || target.chars().any(char::is_whitespace) {
        return false;
    }

    let authority_end = target.find(['/', '?', '#']).unwrap_or(target.len());
    let authority = &target[..authority_end];
    if authority.is_empty() || authority.contains('@') {
        return false;
    }

    let host = match authority.rsplit_once(':') {
        Some((host, port))
            if !host.contains(':')
                && !port.is_empty()
                && port.bytes().all(|b| b.is_ascii_digit()) =>
        {
            host
        }
        _ => authority,
    };

    if host.parse::<std::net::Ipv4Addr>().is_ok() {
        return true;
    }

    let labels: Vec<_> = host.split('.').collect();
    if labels.len() < 2
        || labels.iter().any(|label| {
            label.is_empty()
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .chars()
                    .all(|character| character.is_alphanumeric() || character == '-')
        })
    {
        return false;
    }

    let suffix = labels.last().expect("a dotted host has a suffix");
    (suffix.len() >= 2 && suffix.chars().all(char::is_alphabetic))
        || suffix.to_ascii_lowercase().starts_with("xn--")
}

fn normalize_open_target(target: &str) -> String {
    let is_existing_path = Path::new(target).exists();
    if is_existing_path
        || has_uri_scheme(target)
        || is_explicit_local_path(target)
        || !looks_like_bare_domain(target)
    {
        target.to_owned()
    } else {
        format!("https://{target}")
    }
}

// `run_action` may call platform APIs and manipulate windows. A synchronous Tauri command runs
// on the event-loop path; creating or dispatching a window from there can self-deadlock on Windows.
#[tauri::command(async)]
fn run_action(
    app: AppHandle,
    clipboard: State<'_, ClipboardService>,
    action_type: String,
    payload: String,
) -> Result<(), String> {
    match action_type.as_str() {
        "launch_app" => {
            let application = checked_application_path(&payload)?;
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .arg(application)
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string())
            }
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new(application)
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string())
            }
            #[cfg(target_os = "linux")]
            {
                std::process::Command::new(application)
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string())
            }
        }
        "open_url_or_file" => {
            let target = normalize_open_target(&payload);
            open::that(target).map_err(|e| e.to_string())
        }
        "shell" => {
            #[cfg(target_os = "windows")]
            let result = std::process::Command::new("cmd")
                .args(["/C", &payload])
                .spawn();
            #[cfg(not(target_os = "windows"))]
            let result = std::process::Command::new("sh")
                .args(["-c", &payload])
                .spawn();
            result.map(|_| ()).map_err(|e| e.to_string())
        }
        "snippet" => clipboard.set_text(&app, payload),
        CLIPBOARD_HISTORY_ACTION => {
            clipboard.capture_now(&app)?;
            show_clipboard_history_panel_inner(&app)
        }
        "submenu" | "folder" => Ok(()),
        other => Err(format!("Unknown action type: {other}")),
    }
}

fn centered_window_position(
    monitor_position: PhysicalPosition<i32>,
    monitor_size: PhysicalSize<u32>,
    window_size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let centered_axis = |origin: i32, available: u32, occupied: u32| {
        (i64::from(origin) + (i64::from(available) - i64::from(occupied)) / 2)
            .clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32
    };
    PhysicalPosition::new(
        centered_axis(monitor_position.x, monitor_size.width, window_size.width),
        centered_axis(monitor_position.y, monitor_size.height, window_size.height),
    )
}

fn show_wheel_at_configured_position(app: &AppHandle) {
    let Some(window) = app.get_webview_window("wheel") else {
        return;
    };
    let config = load_config_from_disk(app);
    let logical_size = BASE_WHEEL_SIZE * f64::from(config.wheel_scale) / 100.0;
    let _ = window.set_size(LogicalSize::new(logical_size, logical_size));
    if let Ok(size) = window.outer_size() {
        if config.spawn_at_cursor {
            if let Mouse::Position { x, y } = Mouse::get_mouse_position() {
                let target_x = x - (size.width as i32 / 2);
                let target_y = y - (size.height as i32 / 2);
                let _ = window.set_position(PhysicalPosition::new(target_x, target_y));
            }
        } else if let Ok(Some(monitor)) = window.primary_monitor() {
            let target = centered_window_position(*monitor.position(), *monitor.size(), size);
            let _ = window.set_position(target);
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
}

fn toggle_wheel(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window(CLIPBOARD_PANEL_LABEL) {
        if panel.is_visible().unwrap_or(false) {
            let _ = panel.hide();
            return;
        }
    }
    let Some(window) = app.get_webview_window("wheel") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        show_wheel_at_configured_position(app);
    }
}

#[cfg(test)]
mod config_tests {
    use super::*;

    #[test]
    fn older_configs_ignore_retired_blur_settings_and_receive_safe_defaults() {
        let (config, migrated) = parse_stored_config(
            r#"{"segments":[],"shortcut":"Ctrl+Shift+Space","background_blur":true,"blur_intensity":95}"#,
        )
        .expect("legacy config with retired blur settings should remain readable");

        assert!(migrated);
        assert_eq!(config.schema_version, CONFIG_SCHEMA_VERSION);
        assert_eq!(config.active_profile_id, DEFAULT_PROFILE_ID);
        assert_eq!(config.profiles.len(), 1);
        assert_eq!(config.profiles[0].name, "Default");
        assert!(config.profiles[0].segments.is_empty());
        assert!(!config.launch_at_login);
        assert!(config.show_in_tray);
        assert!(config.spawn_at_cursor);
        assert!(config.cancel_by_center);
        assert!(config.cancel_with_escape);
        assert_eq!(config.wheel_scale, DEFAULT_WHEEL_SCALE);
        assert_eq!(config.wheel_opacity, DEFAULT_WHEEL_OPACITY);
        assert!(validate_config(&config).is_ok());

        let saved = serde_json::to_string(&config).expect("config should serialize");
        assert!(!saved.contains("background_blur"));
        assert!(!saved.contains("blur_intensity"));

        let imported = parse_config_backup(
            r#"{"segments":[],"shortcut":"Ctrl+Shift+Space","background_blur":true,"blur_intensity":95}"#,
        )
        .expect("backup with retired blur settings should remain importable");
        assert_eq!(imported.wheel_scale, DEFAULT_WHEEL_SCALE);
    }

    #[test]
    fn legacy_migration_preserves_segments_and_global_settings() {
        let (config, migrated) = parse_stored_config(
            r#"{
                "segments":[{
                    "id":"legacy-segment",
                    "label":"Legacy action",
                    "icon":"Search",
                    "action_type":"snippet",
                    "payload":"kept",
                    "quick_key":"K",
                    "children":[]
                }],
                "shortcut":"Ctrl+Alt+K",
                "launch_at_login":true,
                "show_in_tray":false,
                "spawn_at_cursor":false,
                "cancel_by_center":false,
                "cancel_with_escape":true,
                "wheel_scale":125,
                "wheel_opacity":71
            }"#,
        )
        .expect("legacy config should migrate");

        assert!(migrated);
        assert_eq!(config.active_profile_id, DEFAULT_PROFILE_ID);
        assert_eq!(config.profiles.len(), 1);
        assert_eq!(config.profiles[0].id, DEFAULT_PROFILE_ID);
        assert_eq!(config.profiles[0].name, "Default");
        assert_eq!(config.profiles[0].segments.len(), 1);
        assert_eq!(config.profiles[0].segments[0].id, "legacy-segment");
        assert_eq!(config.profiles[0].segments[0].payload, "kept");
        assert_eq!(config.shortcut, "Ctrl+Alt+K");
        assert!(config.launch_at_login);
        assert!(!config.show_in_tray);
        assert!(!config.spawn_at_cursor);
        assert!(!config.cancel_by_center);
        assert!(config.cancel_with_escape);
        assert_eq!(config.wheel_scale, 125);
        assert_eq!(config.wheel_opacity, 71);
        assert!(validate_config(&config).is_ok());
    }

    #[test]
    fn current_profile_config_round_trips_without_migration() {
        let config = default_config();
        let text = serde_json::to_string(&config).expect("current config should serialize");
        let (restored, migrated) =
            parse_stored_config(&text).expect("current config should deserialize");

        assert!(!migrated);
        assert_eq!(restored.schema_version, CONFIG_SCHEMA_VERSION);
        assert_eq!(restored.active_profile_id, DEFAULT_PROFILE_ID);
        assert_eq!(restored.profiles.len(), 1);
        assert_eq!(
            restored.profiles[0].segments.len(),
            default_segments().len()
        );
    }

    #[test]
    fn rejects_disabling_every_cancellation_method() {
        let mut config = default_config();
        config.cancel_by_center = false;
        config.cancel_with_escape = false;

        assert_eq!(
            validate_config(&config),
            Err("Keep at least one wheel cancellation method enabled.".into())
        );
    }

    #[test]
    fn rejects_malformed_backup_json_with_a_clear_error() {
        let error = parse_config_backup("{not valid json}").expect_err("JSON should be rejected");

        assert!(error.starts_with("The selected file is not a valid Arky configuration:"));
    }

    #[test]
    fn exports_and_parses_the_complete_configuration() {
        let config = default_config();
        let destination = std::env::temp_dir().join(format!(
            "arky-config-export-test-{}.json",
            uuid::Uuid::new_v4()
        ));

        let exported = export_config(config.clone(), destination.to_string_lossy().into_owned())
            .expect("configuration should export");
        let text = fs::read_to_string(&exported).expect("export should be readable");
        let restored = parse_config_backup(&text).expect("export should import cleanly");
        let _ = fs::remove_file(&destination);

        assert_eq!(restored.shortcut, config.shortcut);
        assert_eq!(restored.schema_version, config.schema_version);
        assert_eq!(restored.active_profile_id, config.active_profile_id);
        assert_eq!(restored.profiles.len(), config.profiles.len());
        assert_eq!(
            restored.profiles[0].segments.len(),
            config.profiles[0].segments.len()
        );
        assert_eq!(restored.launch_at_login, config.launch_at_login);
        assert_eq!(restored.show_in_tray, config.show_in_tray);
        assert_eq!(restored.spawn_at_cursor, config.spawn_at_cursor);
        assert_eq!(restored.cancel_by_center, config.cancel_by_center);
        assert_eq!(restored.cancel_with_escape, config.cancel_with_escape);
        assert_eq!(restored.wheel_scale, config.wheel_scale);
        assert_eq!(restored.wheel_opacity, config.wheel_opacity);
        assert!(!text.contains("background_blur"));
        assert!(!text.contains("blur_intensity"));
    }

    #[test]
    fn rejects_missing_active_profile_and_duplicate_profile_names() {
        let mut config = default_config();
        config.active_profile_id = "missing".into();
        assert_eq!(
            validate_config(&config),
            Err("The active wheel profile does not exist.".into())
        );

        config = default_config();
        config.profiles.push(WheelProfile {
            id: "second".into(),
            name: " default ".into(),
            segments: vec![],
        });
        assert_eq!(
            validate_config(&config),
            Err("Wheel profile names must be unique.".into())
        );
    }

    #[test]
    fn active_profile_updates_only_to_an_existing_profile() {
        let mut config = default_config();
        config.profiles.push(WheelProfile {
            id: "second".into(),
            name: "Second".into(),
            segments: vec![],
        });
        let original_shortcut = config.shortcut.clone();
        let original_profiles = config.profiles.len();

        assert_eq!(update_active_profile(&mut config, "second"), Ok(true));
        assert_eq!(config.active_profile_id, "second");
        assert_eq!(config.shortcut, original_shortcut);
        assert_eq!(config.profiles.len(), original_profiles);
        assert_eq!(update_active_profile(&mut config, "second"), Ok(false));
        assert_eq!(
            update_active_profile(&mut config, "missing"),
            Err("The selected wheel profile does not exist.".into())
        );
        assert_eq!(config.active_profile_id, "second");
    }

    #[test]
    fn open_targets_add_https_only_to_bare_domains() {
        assert_eq!(normalize_open_target("google.com"), "https://google.com");
        assert_eq!(
            normalize_open_target("www.example.com"),
            "https://www.example.com"
        );
        assert_eq!(
            normalize_open_target("example.com:8443/docs?mode=compact#top"),
            "https://example.com:8443/docs?mode=compact#top"
        );
        assert_eq!(
            normalize_open_target("192.168.1.20"),
            "https://192.168.1.20"
        );
    }

    #[test]
    fn open_targets_preserve_schemes_and_clear_file_paths() {
        for target in [
            "http://example.com",
            "https://example.com/docs",
            "file:///Users/example/document.txt",
            "mailto:hello@example.com",
            r"C:\Users\example\document.txt",
            "C:/Users/example/document.txt",
            "/Users/example/document.txt",
            r"\\server\share\document.txt",
            "./document.txt",
            "../document.txt",
            "assets/document.txt",
            "localhost",
            "not a domain.com",
        ] {
            assert_eq!(normalize_open_target(target), target);
        }
    }

    #[test]
    fn rejects_out_of_range_appearance_settings() {
        let mut config = default_config();
        config.wheel_scale = MIN_WHEEL_SCALE - 1;
        assert!(validate_config(&config)
            .expect_err("undersized wheel should be rejected")
            .contains("Wheel size"));

        config = default_config();
        config.wheel_opacity = MAX_WHEEL_OPACITY + 1;
        assert!(validate_config(&config)
            .expect_err("excessive opacity should be rejected")
            .contains("Wheel opacity"));
    }

    #[test]
    fn centers_a_window_within_monitor_coordinates() {
        let centered = centered_window_position(
            PhysicalPosition::new(-1920, 0),
            PhysicalSize::new(1920, 1080),
            PhysicalSize::new(620, 620),
        );

        assert_eq!(centered, PhysicalPosition::new(-1270, 230));
    }

    #[test]
    fn centers_clipboard_panel_over_the_wheel_anchor() {
        let centered = centered_over_anchor_position(
            PhysicalPosition::new(-1920, 0),
            PhysicalSize::new(620, 620),
            PhysicalSize::new(360, 420),
            PhysicalPosition::new(-1920, 0),
            PhysicalSize::new(1920, 1080),
        );

        assert_eq!(centered, PhysicalPosition::new(-1790, 100));
    }

    #[test]
    fn clipboard_panel_position_stays_inside_the_monitor() {
        let centered = centered_over_anchor_position(
            PhysicalPosition::new(1700, 900),
            PhysicalSize::new(620, 620),
            PhysicalSize::new(360, 420),
            PhysicalPosition::new(0, 0),
            PhysicalSize::new(1920, 1080),
        );

        assert_eq!(centered, PhysicalPosition::new(1560, 660));
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    #[test]
    fn detects_the_current_executable_as_running() {
        let executable = std::env::current_exe().expect("test executable path");
        let state = get_running_app_state(executable.to_string_lossy().into_owned(), false)
            .expect("running app state");
        assert!(state.running);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ClipboardService::default())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_wheel(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let config = load_config_from_disk(app.handle());
            if let Err(error) = app
                .state::<ClipboardService>()
                .set_monitoring(app.handle(), config_uses_clipboard_history(&config))
            {
                eprintln!("{error}");
            }
            if let Err(error) = set_launch_at_login(app.handle(), config.launch_at_login) {
                eprintln!("{error}");
            }
            let shortcut = config.shortcut;
            app.global_shortcut().register(shortcut.as_str())?;

            let open_builder =
                MenuItem::with_id(app, "open_builder", "Open Builder", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_builder, &quit])?;

            let tray = TrayIconBuilder::with_id(MAIN_TRAY_ID)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_builder" => {
                        if let Some(w) = app.get_webview_window("builder") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            tray.set_visible(config.show_in_tray)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            set_active_profile,
            export_config,
            import_config,
            get_platform,
            prepare_application,
            list_installed_applications,
            get_running_app_state,
            focus_running_app,
            launch_new_app_instance,
            hide_wheel,
            get_clipboard_history,
            copy_clipboard_history_entry,
            hide_clipboard_history_panel,
            run_action
        ])
        .on_window_event(|window, event| {
            if window.label() == CLIPBOARD_PANEL_LABEL {
                match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    tauri::WindowEvent::Focused(false) => {
                        let _ = window.hide();
                    }
                    _ => {}
                }
                return;
            }
            if window.label() != "builder" {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if load_config_from_disk(window.app_handle()).show_in_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

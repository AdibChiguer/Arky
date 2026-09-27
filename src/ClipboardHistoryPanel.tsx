import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Clipboard, Image as ImageIcon, Search, X } from "lucide-react";
import { commands } from "./lib/tauri";
import type { ClipboardHistoryEntry } from "./types/wheel";

const SEARCH_DELAY_MS = 75;
const FOCUSED_REFRESH_INTERVAL_MS = 1000;

function entryLabel(entry: ClipboardHistoryEntry) {
  return entry.kind === "text"
    ? `Copy text: ${entry.preview}`
    : `Copy image, ${entry.width} by ${entry.height} pixels`;
}

function ClipboardHistoryPanel() {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<ClipboardHistoryEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const entriesRef = useRef<ClipboardHistoryEntry[]>([]);
  const activeIndexRef = useRef(-1);
  const queryRef = useRef("");
  const requestRef = useRef(0);
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);
  useEffect(() => { queryRef.current = query; }, [query]);

  async function refresh(searchQuery: string) {
    const request = requestRef.current + 1;
    requestRef.current = request;
    try {
      const nextEntries = await commands.getClipboardHistory(searchQuery);
      if (request !== requestRef.current) return;
      entriesRef.current = nextEntries;
      activeIndexRef.current = -1;
      setEntries(nextEntries);
      setActiveIndex(-1);
      setError("");
    } catch (reason) {
      if (request !== requestRef.current) return;
      entriesRef.current = [];
      activeIndexRef.current = -1;
      setEntries([]);
      setActiveIndex(-1);
      setError(
        reason instanceof Error ? reason.message : "Clipboard history is unavailable.",
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      void refresh(query);
    }, query ? SEARCH_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    function refreshForOpenPanel() {
      if (disposed) return;
      queryRef.current = "";
      setQuery("");
      setError("");
      setLoading(true);
      void refresh("");
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }

    void listen<number>("clipboard-history-changed", () => {
      if (!disposed) void refresh(queryRef.current);
    }).then((unlisten) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    });

    void listen("clipboard-panel-opened", () => {
      refreshForOpenPanel();
    }).then((unlisten) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    });

    window.addEventListener("focus", refreshForOpenPanel);
    const focusedRefresh = window.setInterval(() => {
      if (!disposed && document.hasFocus()) void refresh(queryRef.current);
    }, FOCUSED_REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      requestRef.current += 1;
      window.removeEventListener("focus", refreshForOpenPanel);
      window.clearInterval(focusedRefresh);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  async function selectEntry(entry: ClipboardHistoryEntry) {
    if (copyingId !== null) return;
    setCopyingId(entry.id);
    setError("");
    try {
      await commands.copyClipboardHistoryEntry(entry.id);
      await commands.hideClipboardHistoryPanel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restore that clipboard item.");
      setCopyingId(null);
    }
  }

  function setKeyboardSelection(index: number) {
    if (entriesRef.current.length === 0) return;
    const nextIndex = (index + entriesRef.current.length) % entriesRef.current.length;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    buttonRefs.current.get(entriesRef.current[nextIndex].id)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      void commands.hideClipboardHistoryPanel();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setKeyboardSelection(activeIndexRef.current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setKeyboardSelection(activeIndexRef.current <= 0
        ? entriesRef.current.length - 1
        : activeIndexRef.current - 1);
    } else if (event.key === "Enter" && activeIndexRef.current >= 0) {
      event.preventDefault();
      void selectEntry(entriesRef.current[activeIndexRef.current]);
    }
  }

  const emptyTitle = query ? "No matching text" : "Nothing copied yet";
  const emptyMessage = query
    ? "Images are hidden while searching."
    : "Text and images copied while Arky is running will appear here.";

  return (
    <main className="clipboard-panel" onKeyDown={onKeyDown}>
      <header className="clipboard-panel-header">
        <div>
          <span className="clipboard-panel-kicker">Arky</span>
          <h1>Clipboard history</h1>
        </div>
        <button
          type="button"
          className="clipboard-panel-close"
          aria-label="Close clipboard history"
          onClick={() => void commands.hideClipboardHistoryPanel()}
        >
          <X size={16} />
        </button>
      </header>

      <label className="clipboard-search">
        <Search size={15} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          aria-label="Search clipboard history"
          placeholder="Search copied text"
          spellCheck={false}
          onChange={(event) => {
            queryRef.current = event.target.value;
            setQuery(event.target.value);
            setLoading(true);
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear clipboard search"
            onClick={() => {
              queryRef.current = "";
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X size={13} />
          </button>
        )}
      </label>

      <div className="clipboard-panel-status" aria-live="polite">
        {error || (loading ? "Updating clipboard history" : `${entries.length} clipboard ${entries.length === 1 ? "item" : "items"}`)}
      </div>

      <section className="clipboard-entry-list" aria-label="Recent clipboard items">
        {!loading && !error && entries.length === 0 ? (
          <div className="clipboard-empty-state">
            <Clipboard size={24} aria-hidden="true" />
            <strong>{emptyTitle}</strong>
            <p>{emptyMessage}</p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <button
              key={entry.id}
              ref={(element) => {
                if (element) buttonRefs.current.set(entry.id, element);
                else buttonRefs.current.delete(entry.id);
              }}
              type="button"
              className={`clipboard-entry${index === activeIndex ? " is-active" : ""}`}
              aria-label={entryLabel(entry)}
              disabled={copyingId !== null}
              onMouseEnter={() => {
                activeIndexRef.current = index;
                setActiveIndex(index);
              }}
              onFocus={() => {
                activeIndexRef.current = index;
                setActiveIndex(index);
              }}
              onClick={() => void selectEntry(entry)}
            >
              {entry.kind === "text" ? (
                <>
                  <span className="clipboard-entry-icon"><Clipboard size={16} /></span>
                  <span className="clipboard-entry-copy">
                    <span className="clipboard-entry-type">Text</span>
                    <span className="clipboard-entry-text">{entry.preview}</span>
                  </span>
                </>
              ) : (
                <>
                  <img
                    className="clipboard-entry-thumbnail"
                    src={entry.thumbnail_data}
                    alt={`Clipboard image, ${entry.width} by ${entry.height} pixels`}
                  />
                  <span className="clipboard-entry-copy image-copy">
                    <span className="clipboard-entry-type"><ImageIcon size={12} /> Image</span>
                    <span className="clipboard-entry-dimensions">{entry.width} × {entry.height}</span>
                  </span>
                </>
              )}
            </button>
          ))
        )}
      </section>
    </main>
  );
}

export default ClipboardHistoryPanel;

import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

type DesktopPlatform = "macos" | "windows";

function desktopPlatform(): DesktopPlatform {
  return /Macintosh|Mac OS X/i.test(navigator.userAgent) ? "macos" : "windows";
}

export function BuilderTitleBar() {
  const platform = desktopPlatform();

  function run(action: () => Promise<void>) {
    void action().catch((error) => console.error("Window control failed", error));
  }

  const minimize = () => run(() => getCurrentWindow().minimize());
  const maximize = () => run(() => getCurrentWindow().toggleMaximize());
  const close = () => run(() => getCurrentWindow().close());

  const controls = platform === "macos" ? <>
    <button className="title-bar-control mac-close" aria-label="Close window" onClick={close}><X size={8} strokeWidth={2.4} /></button>
    <button className="title-bar-control mac-minimize" aria-label="Minimize window" onClick={minimize}><Minus size={8} strokeWidth={2.4} /></button>
    <button className="title-bar-control mac-maximize" aria-label="Zoom window" onClick={maximize}><Square size={6} strokeWidth={2.2} /></button>
  </> : <>
    <button className="title-bar-control windows-minimize" aria-label="Minimize window" onClick={minimize}><Minus size={16} strokeWidth={1.5} /></button>
    <button className="title-bar-control windows-maximize" aria-label="Maximize or restore window" onClick={maximize}><Square size={12} strokeWidth={1.5} /></button>
    <button className="title-bar-control windows-close" aria-label="Close window" onClick={close}><X size={16} strokeWidth={1.5} /></button>
  </>;

  return <header className={`builder-title-bar is-${platform}`} aria-label="Window controls">
    <div className="title-bar-drag-region" data-tauri-drag-region onDoubleClick={maximize} />
    <div className="title-bar-controls">{controls}</div>
  </header>;
}

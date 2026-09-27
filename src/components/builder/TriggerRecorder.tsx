import { Keyboard, RotateCcw } from "lucide-react";
import type { Platform } from "../../types/wheel";

type Props = { platform: Platform; recording: boolean; parts: string[]; onRecord: () => void; onRestore: () => void };

export function TriggerRecorder({ platform, recording, parts, onRecord, onRestore }: Props) {
  return <article className="settings-card">
    <div className="settings-card-heading"><span className="settings-icon"><Keyboard size={19} /></span><div><h2>Summon wheel</h2><p>Choose the global shortcut that opens Arky from anywhere.</p></div></div>
    <button className={`shortcut-recorder${recording ? " is-recording" : ""}`} onClick={onRecord}><span className="shortcut-recorder-label">{recording ? "Recording shortcut" : "Current shortcut"}</span><span className="keycap-row">{parts.map((part) => <kbd key={part}>{part}</kbd>)}{recording && <kbd className="waiting-key">…</kbd>}</span><span className="shortcut-recorder-action">{recording ? "Press a modifier + key" : "Click to record a new shortcut"}</span></button>
    <div className="shortcut-help"><p>{platform === "macos" ? "The reliable macOS default is Option + Shift + Space." : "The reliable Windows default is Ctrl + Shift + Space."}</p><button className="button text-button" onClick={onRestore}><RotateCcw size={14} />Restore default</button></div>
  </article>;
}

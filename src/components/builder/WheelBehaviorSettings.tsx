import { MousePointer2 } from "lucide-react";
import { SettingsToggle } from "./SettingsToggle";

type Props = {
  spawnAtCursor: boolean;
  onSpawnAtCursorChange: (enabled: boolean) => void;
  cancelByCenter: boolean;
  onCancelByCenterChange: (enabled: boolean) => void;
  cancelWithEscape: boolean;
  onCancelWithEscapeChange: (enabled: boolean) => void;
};

export function WheelBehaviorSettings({ spawnAtCursor, onSpawnAtCursorChange, cancelByCenter, onCancelByCenterChange, cancelWithEscape, onCancelWithEscapeChange }: Props) {
  const centerIsRequired = cancelByCenter && !cancelWithEscape;
  const escapeIsRequired = cancelWithEscape && !cancelByCenter;
  return <article className="settings-card">
    <div className="settings-card-heading"><span className="settings-icon"><MousePointer2 size={19} /></span><div><h2>Wheel behavior</h2><p>Choose where and how the action wheel appears.</p></div></div>
    <div className="settings-toggle-list">
      <SettingsToggle label="Spawn wheel at cursor position" description="When off, Arky opens the wheel at the center of your primary display." checked={spawnAtCursor} onChange={onSpawnAtCursorChange} />
      <SettingsToggle label="Cancel by returning to center" description={centerIsRequired ? "This is your only enabled cancellation method." : "Return to the hub and release to close the wheel without firing an action."} checked={cancelByCenter} disabled={centerIsRequired} onChange={onCancelByCenterChange} />
      <SettingsToggle label="Cancel with Escape key" description={escapeIsRequired ? "This is your only enabled cancellation method." : "Press Escape while the wheel is open to close it without firing an action."} checked={cancelWithEscape} disabled={escapeIsRequired} onChange={onCancelWithEscapeChange} />
    </div>
  </article>;
}

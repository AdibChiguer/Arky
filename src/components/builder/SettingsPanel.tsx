import { Settings2 } from "lucide-react";
import type { Platform } from "../../types/wheel";
import { TriggerRecorder } from "./TriggerRecorder";

type Props = {
  platform: Platform;
  recording: boolean;
  shortcutParts: string[];
  onRecord: () => void;
  onRestore: () => void;
  children?: React.ReactNode;
};

export function SettingsPanel({
  platform,
  recording,
  shortcutParts,
  onRecord,
  onRestore,
  children,
}: Props) {
  return (
    <section className="settings-panel">
      <div className="editor-heading">
        <span className="editor-icon">
          <Settings2 size={22} />
        </span>
        <div>
          <span className="eyebrow">Application preferences</span>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings-content">
        <TriggerRecorder
          platform={platform}
          recording={recording}
          parts={shortcutParts}
          onRecord={onRecord}
          onRestore={onRestore}
        />
        {children}
        <div className="settings-note">
          <strong>Runtime updates</strong>
          <p>
            Saving unregisters the previous shortcut and activates the new one
            immediately - no restart required.
          </p>
        </div>
      </div>
    </section>
  );
}

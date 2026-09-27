import { Download, Upload } from "lucide-react";

type Props = {
  transferring: "export" | "import" | null;
  onExport: () => void;
  onImport: () => void;
};

export function BackupRestoreSettings({ transferring, onExport, onImport }: Props) {
  return <article className="settings-card">
    <div className="settings-card-heading"><span className="settings-icon"><Download size={19} /></span><div><h2>Backup &amp; restore</h2><p>Move your complete wheel setup between installations.</p></div></div>
    <div className="backup-actions">
      <button className="button secondary" onClick={onExport} disabled={transferring !== null}><Download size={16} />{transferring === "export" ? "Exporting…" : "Export config"}</button>
      <button className="button secondary" onClick={onImport} disabled={transferring !== null}><Upload size={16} />{transferring === "import" ? "Importing…" : "Import config"}</button>
    </div>
    <p className="backup-note">Backups include segments, folders, cached application icons, the trigger shortcut, and all settings.</p>
  </article>;
}

import { Power } from "lucide-react";
import { SettingsToggle } from "./SettingsToggle";

type Props = {
  launchAtLogin: boolean;
  onLaunchAtLoginChange: (enabled: boolean) => void;
  showInTray: boolean;
  onShowInTrayChange: (enabled: boolean) => void;
};

export function StartupSettings({ launchAtLogin, onLaunchAtLoginChange, showInTray, onShowInTrayChange }: Props) {
  return <article className="settings-card">
    <div className="settings-card-heading"><span className="settings-icon"><Power size={19} /></span><div><h2>Startup &amp; background</h2><p>Control how Arky starts and stays available.</p></div></div>
    <div className="settings-toggle-list">
      <SettingsToggle label="Launch at login" description="Start Arky automatically when you sign in. Applies when settings are saved." checked={launchAtLogin} onChange={onLaunchAtLoginChange} />
      <SettingsToggle label="Show in menu bar / system tray" description="Keep Arky available after closing the Builder. When off, closing the Builder quits Arky." checked={showInTray} onChange={onShowInTrayChange} />
    </div>
  </article>;
}

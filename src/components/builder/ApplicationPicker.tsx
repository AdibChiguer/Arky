import { AppWindow, Check, FolderOpen, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import type { InstalledApplication, Platform, WheelSegment } from "../../types/wheel";
import { cachedAppIcon } from "../../lib/segments";

export type AppCatalogStatus = "idle" | "loading" | "loaded" | "error";
type Props = { segment: WheelSegment; platform: Platform; applications: InstalledApplication[]; status: AppCatalogStatus; error: string; query: string; preparingPath: string; onQueryChange: (query: string) => void; onBrowse: () => void; onClear: () => void; onRetry: () => void; onSelect: (path: string) => void };

export function ApplicationPicker(props: Props) {
  const appIcon = cachedAppIcon(props.segment);
  const normalized = props.query.trim().toLocaleLowerCase();
  const applications = normalized ? props.applications.filter((app) => app.name.toLocaleLowerCase().includes(normalized) || app.path.toLocaleLowerCase().includes(normalized)) : props.applications;
  const validPath = !props.segment.payload || (props.platform === "macos" ? props.segment.payload.toLowerCase().endsWith(".app") : props.platform === "windows" ? props.segment.payload.toLowerCase().endsWith(".exe") : true);
  return <div className="field">
    <span>Application</span>
    <div className={`selected-path${!validPath ? " is-invalid" : ""}`}><span className="path-icon">{appIcon ? <img src={appIcon} alt="" /> : <FolderOpen size={16} />}</span><span className={props.segment.payload ? "" : "placeholder"}>{props.segment.payload || (props.platform === "macos" ? "No .app bundle selected" : "No .exe selected")}</span>{props.segment.payload && <button aria-label="Clear selected application" onClick={props.onClear}><X size={14} /></button>}</div>
    {props.platform === "linux" ? <button className="button secondary browse-manually" onClick={props.onBrowse}><FolderOpen size={16} />Browse manually…</button> : <section className="installed-app-picker" aria-label="Installed applications">
      <div className="installed-app-heading"><div><strong>Installed apps</strong><span>Choose an application detected on this computer.</span></div><button className="button secondary" onClick={props.onBrowse}><FolderOpen size={15} />Browse manually…</button></div>
      <div className="installed-app-search"><Search size={15} /><input aria-label="Search installed applications" value={props.query} placeholder="Search installed apps…" onChange={(event) => props.onQueryChange(event.target.value)} />{props.query && <button type="button" aria-label="Clear application search" onClick={() => props.onQueryChange("")}><X size={13} /></button>}</div>
      {props.status === "loading" ? <div className="app-catalog-message"><LoaderCircle className="spin" size={20} /><span>Finding installed applications and loading their icons…</span></div> : props.status === "error" ? <div className="app-catalog-message is-error"><span>Could not load installed apps: {props.error}</span><button className="button secondary" onClick={props.onRetry}><RefreshCw size={14} />Retry</button></div> : applications.length > 0 ? <div className="installed-app-grid">{applications.map((application) => {
        const selected = props.platform === "windows" ? props.segment.payload.toLocaleLowerCase() === application.path.toLocaleLowerCase() : props.segment.payload === application.path;
        const preparing = props.preparingPath === application.path;
        const icon = application.icon_base64 ? (application.icon_base64.startsWith("data:") ? application.icon_base64 : `data:image/png;base64,${application.icon_base64}`) : null;
        return <button key={application.path} className={`installed-app${selected ? " is-selected" : ""}`} title={application.path} disabled={Boolean(props.preparingPath)} onClick={() => props.onSelect(application.path)}><span className="installed-app-icon">{preparing ? <LoaderCircle className="spin" size={19} /> : icon ? <img src={icon} alt="" /> : <AppWindow size={19} />}</span><span>{application.name}</span>{selected && <Check size={14} />}</button>;
      })}</div> : props.status === "loaded" ? <div className="app-catalog-message"><AppWindow size={20} /><span>{props.query ? `No installed apps match “${props.query}”.` : "No traditional desktop applications were found."}</span></div> : null}
    </section>}
    <small className={!validPath ? "field-error" : ""}>{!validPath ? `Choose a real ${props.platform === "macos" ? ".app bundle" : ".exe"} to replace this legacy app name.` : props.platform === "macos" ? "Arky stores the full path to the selected macOS application bundle." : "Arky stores the full path to the selected Windows executable."}</small>
  </div>;
}

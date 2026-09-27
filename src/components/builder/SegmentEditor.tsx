import {
  AppWindow,
  Clipboard,
  ExternalLink,
  Folder,
  History,
  SquareTerminal,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import { getSegmentIcon } from "../../icons";
import { ACTION_TYPES, CHILD_ACTION_TYPES } from "../../lib/constants";
import { cachedAppIcon } from "../../lib/segments";
import type {
  InstalledApplication,
  Platform,
  WheelSegment,
} from "../../types/wheel";
import { ApplicationPicker, type AppCatalogStatus } from "./ApplicationPicker";
import { FolderEditor } from "./FolderEditor";
import { IconPicker } from "./IconPicker";

const ACTION_TYPE_PRESENTATION = {
  launch_app: { label: "Launch app", Icon: AppWindow },
  open_url_or_file: { label: "URL or file", Icon: ExternalLink },
  shell: { label: "Shell command", Icon: SquareTerminal },
  snippet: { label: "Text snippet", Icon: Clipboard },
  // clipboard_history: { label: "Clipboard history", Icon: History },
  folder: { label: "Folder", Icon: Folder },
};

type Props = {
  segment: WheelSegment;
  index: number;
  parent?: WheelSegment;
  quickKeyError?: string;
  platform: Platform;
  iconPickerOpen: boolean;
  iconQuery: string;
  applications: InstalledApplication[];
  appStatus: AppCatalogStatus;
  appError: string;
  appQuery: string;
  preparingPath: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (patch: Partial<WheelSegment>) => void;
  onIconOpenChange: (open: boolean) => void;
  onIconQueryChange: (query: string) => void;
  onMoveChild: (index: number, direction: -1 | 1) => void;
  onAddChild: () => void;
  onAppQueryChange: (query: string) => void;
  onBrowseApp: () => void;
  onRetryApps: () => void;
  onSelectApp: (path: string) => void;
};

export function SegmentEditor(props: Props) {
  const Icon = getSegmentIcon(props.segment.icon || "Sparkles");
  const appIcon = cachedAppIcon(props.segment);
  return (
    <section className="editor-panel">
      <div className="editor-heading">
        <span className="editor-icon">
          {appIcon ? <img src={appIcon} alt="" /> : <Icon size={22} />}
        </span>
        <div>
          {props.parent ? (
            <button
              className="editor-breadcrumb"
              onClick={() => props.onSelect(props.parent!.id)}
            >
              <ChevronLeft size={13} />
              {props.parent.label || "Untitled folder"}
              <span>/ Action {String(props.index + 1).padStart(2, "0")}</span>
            </button>
          ) : (
            <span className="eyebrow">
              Editing{" "}
              {props.segment.action_type === "folder" ? "folder" : "action"}{" "}
              {String(props.index + 1).padStart(2, "0")}
            </span>
          )}
          <h1>{props.segment.label || "Untitled action"}</h1>
        </div>
        <button
          className="button danger-ghost editor-remove"
          onClick={() => props.onRemove(props.segment.id)}
        >
          <Trash2 size={15} />
          Remove
        </button>
      </div>
      <div className="editor-form">
        <div className="form-grid two-column">
          <label className="field">
            <span>Label</span>
            <input
              value={props.segment.label}
              placeholder="Action label"
              onChange={(event) =>
                props.onUpdate({ label: event.target.value })
              }
            />
            <small className="field-help-slot" aria-hidden="true">&nbsp;</small>
          </label>
          <label className="field">
            <span>Quick key</span>
            <input
              className={`quick-key-input${props.quickKeyError ? " is-invalid" : ""}`}
              value={props.segment.quick_key}
              maxLength={1}
              placeholder="—"
              aria-invalid={Boolean(props.quickKeyError)}
              aria-describedby={
                props.quickKeyError ? "quick-key-error" : "quick-key-help"
              }
              onChange={(event) =>
                props.onUpdate({ quick_key: event.target.value })
              }
            />
            {props.quickKeyError ? (
              <small className="field-error" id="quick-key-error" role="alert">
                {props.quickKeyError}
              </small>
            ) : (
              <small id="quick-key-help">
                Press this key while the wheel is open.
              </small>
            )}
          </label>
        </div>
        <div className="field action-type-field">
          <span id="action-type-label">Action type</span>
          <div
            className="action-type-board"
            role="group"
            aria-labelledby="action-type-label"
          >
            {(props.parent ? CHILD_ACTION_TYPES : ACTION_TYPES).map((action) => {
              const presentation = ACTION_TYPE_PRESENTATION[action.value as keyof typeof ACTION_TYPE_PRESENTATION];
              const selected = props.segment.action_type === action.value;
              return <button
                type="button"
                className={`action-type-card${selected ? " is-selected" : ""}`}
                key={action.value}
                aria-pressed={selected}
                aria-label={action.label}
                onClick={() => props.onUpdate({
                  action_type: action.value,
                  ...(action.value === "folder" || action.value === "clipboard_history"
                    ? { payload: "", app_icon: null }
                    : {}),
                })}
              >
                <span className="action-type-card-icon"><presentation.Icon size={19} /></span>
                <span>{presentation.label}</span>
              </button>;
            })}
          </div>
        </div>
        <div className="form-grid">
          <IconPicker
            icon={props.segment.icon}
            open={props.iconPickerOpen}
            query={props.iconQuery}
            onOpenChange={props.onIconOpenChange}
            onQueryChange={props.onIconQueryChange}
            onSelect={(icon) => props.onUpdate({ icon })}
          />
        </div>
        {props.segment.action_type === "folder" ? (
          <FolderEditor
            folder={props.segment}
            onSelect={props.onSelect}
            onMove={props.onMoveChild}
            onRemove={props.onRemove}
            onAdd={props.onAddChild}
          />
        ) : props.segment.action_type === "launch_app" ? (
          <ApplicationPicker
            segment={props.segment}
            platform={props.platform}
            applications={props.applications}
            status={props.appStatus}
            error={props.appError}
            query={props.appQuery}
            preparingPath={props.preparingPath}
            onQueryChange={props.onAppQueryChange}
            onBrowse={props.onBrowseApp}
            onClear={() => props.onUpdate({ payload: "", app_icon: null })}
            onRetry={props.onRetryApps}
            onSelect={props.onSelectApp}
          />
        ) : props.segment.action_type === "open_url_or_file" ? (
          <label className="field">
            <span>Destination</span>
            <input
              value={props.segment.payload}
              placeholder="https://example.com or C:\path\to\file"
              onChange={(event) =>
                props.onUpdate({ payload: event.target.value })
              }
            />
            <small>Enter a URL or a full file/folder path.</small>
          </label>
        ) : props.segment.action_type === "shell" ? (
          <label className="field">
            <span>Shell command</span>
            <textarea
              value={props.segment.payload}
              placeholder="Enter a command…"
              onChange={(event) =>
                props.onUpdate({ payload: event.target.value })
              }
            />
            <small className="field-help-slot" aria-hidden="true">&nbsp;</small>
          </label>
        ) : props.segment.action_type === "clipboard_history" ? (
          <div className="clipboard-history-info">
            <History size={18} aria-hidden="true" />
            <div>
              <strong>Recent clipboard items</strong>
              <p>
                Arky keeps up to 50 recent text and image items in memory while
                the app is running, with at most 10 images. Nothing is written
                to disk, and the history is cleared when Arky exits.
              </p>
            </div>
          </div>
        ) : (
          <label className="field">
            <span>Text to copy</span>
            <textarea
              value={props.segment.payload}
              placeholder="Enter the text Arky should copy…"
              onChange={(event) =>
                props.onUpdate({ payload: event.target.value })
              }
            />
            <small className="field-help-slot" aria-hidden="true">&nbsp;</small>
          </label>
        )}
      </div>
    </section>
  );
}

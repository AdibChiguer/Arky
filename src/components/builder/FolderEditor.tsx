import { ArrowDown, ArrowUp, FolderOpen, Plus, Trash2 } from "lucide-react";
import { getSegmentIcon } from "../../icons";
import { MAX_SUBMENU_ITEMS } from "../../lib/constants";
import { actionLabel, cachedAppIcon } from "../../lib/segments";
import type { WheelSegment } from "../../types/wheel";

type Props = { folder: WheelSegment; onSelect: (id: string) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: (id: string) => void; onAdd: () => void };

export function FolderEditor({ folder, onSelect, onMove, onRemove, onAdd }: Props) {
  const visibleChildren = folder.children.slice(0, MAX_SUBMENU_ITEMS);
  const hiddenChildCount = folder.children.length - visibleChildren.length;
  return <section className="folder-children">
    <div className="folder-children-heading"><div><span className="eyebrow">Second ring</span><h2>Folder actions</h2><p>Dwelling on this folder opens these actions in an outer ring.</p></div><span className="count-badge">{visibleChildren.length} / {MAX_SUBMENU_ITEMS}</span></div>
    {hiddenChildCount > 0 && <p className="field-warning" role="status">{hiddenChildCount} legacy {hiddenChildCount === 1 ? "action is" : "actions are"} preserved in the config but hidden from the eight-item submenu.</p>}
    <div className="folder-child-list">
      {visibleChildren.map((child, index) => {
        const Icon = getSegmentIcon(child.icon); const appIcon = cachedAppIcon(child);
        return <article className="folder-child-row" key={child.id}>
          <button className="folder-child-select" onClick={() => onSelect(child.id)}><span className="segment-list-icon">{appIcon ? <img src={appIcon} alt="" /> : <Icon size={17} />}</span><span className="segment-list-copy"><strong>{child.label || "Untitled action"}</strong><span>{actionLabel(child.action_type)}</span></span></button>
          <div className="folder-child-actions">
            <button aria-label={`Move ${child.label || "action"} up`} disabled={index === 0} onClick={() => onMove(index, -1)}><ArrowUp size={13} /></button>
            <button aria-label={`Move ${child.label || "action"} down`} disabled={index === visibleChildren.length - 1} onClick={() => onMove(index, 1)}><ArrowDown size={13} /></button>
            <button className="remove-child" aria-label={`Remove ${child.label || "action"}`} onClick={() => onRemove(child.id)}><Trash2 size={13} /></button>
          </div>
        </article>;
      })}
      {folder.children.length === 0 && <div className="folder-children-empty"><FolderOpen size={22} /><strong>This folder is empty</strong><span>Add an action to build its second ring.</span></div>}
    </div>
    <button className="add-folder-child" onClick={onAdd} disabled={folder.children.length >= MAX_SUBMENU_ITEMS}><Plus size={15} />Add action to folder</button>
  </section>;
}

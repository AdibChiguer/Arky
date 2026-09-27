import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { getSegmentIcon } from "../../icons";
import { actionLabel, cachedAppIcon } from "../../lib/segments";
import type { WheelSegment } from "../../types/wheel";

type Props = { segment: WheelSegment; index: number; count: number; selected: boolean; dragging: boolean; onSelect: () => void; onMove: (direction: -1 | 1) => void; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void };

export function SegmentListItem({ segment, index, count, selected, dragging, onSelect, onMove, onDragStart, onDragEnd, onDrop }: Props) {
  const Icon = getSegmentIcon(segment.icon);
  const appIcon = cachedAppIcon(segment);
  return <article className={`segment-row${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <GripVertical className="drag-handle" size={15} aria-hidden="true" />
    <button className="segment-select" onClick={onSelect}>
      <span className="segment-list-icon">{appIcon ? <img src={appIcon} alt="" /> : <Icon size={17} />}</span>
      <span className="segment-list-copy"><strong>{segment.label || "Untitled action"}</strong><span>{segment.action_type === "folder" ? `Folder · ${segment.children.length} ${segment.children.length === 1 ? "action" : "actions"}` : actionLabel(segment.action_type)}</span></span>
    </button>
    <div className="segment-order-actions">
      <button aria-label={`Move ${segment.label || "action"} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={13} /></button>
      <button aria-label={`Move ${segment.label || "action"} down`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={13} /></button>
    </div>
  </article>;
}

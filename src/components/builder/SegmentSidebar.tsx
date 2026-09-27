import { FolderPlus, Plus } from "lucide-react";
import { MAX_SEGMENTS } from "../../lib/constants";
import type { WheelProfile, WheelSegment } from "../../types/wheel";
import { ProfileSelector } from "./ProfileSelector";
import { SegmentListItem } from "./SegmentListItem";

type Props = { profiles: WheelProfile[]; profileId: string; activeProfileId: string; segments: WheelSegment[]; selectedId: string; draggedId: string; onProfileSelect: (id: string) => void; onProfileCreate: (name: string) => boolean; onProfileRename: (id: string, name: string) => boolean; onProfileDuplicate: (id: string) => boolean; onProfileDelete: (id: string) => boolean; onSelect: (id: string) => void; onDragChange: (id: string) => void; onDrop: (id: string) => void; onMove: (index: number, direction: -1 | 1) => void; onAddAction: () => void; onAddFolder: () => void };

export function SegmentSidebar(props: Props) {
  return <aside className="segment-sidebar">
    <ProfileSelector profiles={props.profiles} selectedId={props.profileId} activeId={props.activeProfileId} onSelect={props.onProfileSelect} onCreate={props.onProfileCreate} onRename={props.onProfileRename} onDuplicate={props.onProfileDuplicate} onDelete={props.onProfileDelete} />
    <div className="sidebar-heading"><h2>Actions</h2><span className="count-badge">{props.segments.length} / {MAX_SEGMENTS}</span></div>
    <div className="segment-list">{props.segments.map((segment, index) => <SegmentListItem key={segment.id} segment={segment} index={index} count={props.segments.length} selected={segment.id === props.selectedId || segment.children.some((child) => child.id === props.selectedId)} dragging={props.draggedId === segment.id} onSelect={() => props.onSelect(segment.id)} onMove={(direction) => props.onMove(index, direction)} onDragStart={() => props.onDragChange(segment.id)} onDragEnd={() => props.onDragChange("")} onDrop={() => props.onDrop(segment.id)} />)}</div>
    <div className="sidebar-add-actions">
      <button className="add-action" onClick={props.onAddAction} disabled={props.segments.length >= MAX_SEGMENTS}><Plus size={16} />Add action</button>
      <button className="add-action" onClick={props.onAddFolder} disabled={props.segments.length >= MAX_SEGMENTS}><FolderPlus size={16} />Add folder</button>
    </div>
  </aside>;
}

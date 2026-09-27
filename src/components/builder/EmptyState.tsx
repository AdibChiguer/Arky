import { Plus } from "lucide-react";
import { getSegmentIcon } from "../../icons";

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  const Sparkles = getSegmentIcon("Sparkles");
  return <section className="empty-state"><span><Sparkles size={24} /></span><h1>Build your first action</h1><p>Add an action to start composing the wheel.</p><button className="button primary" onClick={onAdd}><Plus size={16} />Add action</button></section>;
}

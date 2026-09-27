import { Check } from "lucide-react";
import { MAX_SEGMENTS } from "../../lib/constants";
import type { WheelSegment } from "../../types/wheel";
import { WheelRenderer } from "../wheel/WheelRenderer";

type Props = {
  segments: WheelSegment[];
  opacity: number;
  saving: boolean;
  onSave: () => void;
};

export function LivePreview({ segments, opacity, saving, onSave }: Props) {
  return (
    <aside className="wheel-preview-pane" aria-label="Live wheel preview">
      <div className="preview-pane-heading">
        <div>
          <span className="eyebrow">Shape preview</span>
          <h2>Live wheel</h2>
        </div>
        <span className="count-badge">
          {segments.length} / {MAX_SEGMENTS}
        </span>
      </div>
      <div className="wheel-preview-stage">
        <WheelRenderer
          segments={segments}
          opacity={opacity}
          variant="preview"
          ariaLabel="Live preview of the top-level wheel segments"
          hub={{
            eyebrow: "Live preview",
            label: "Arky",
            position:
              segments.length === 0
                ? "No actions"
                : `${segments.length} ${segments.length === 1 ? "action" : "actions"}`,
            active: false,
          }}
        />
      </div>
      <div className="preview-pane-actions">
        <button className="button primary" onClick={onSave} disabled={saving}>
          <Check size={16} />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </aside>
  );
}

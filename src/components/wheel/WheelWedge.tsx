import { getSegmentIcon } from "../../icons";
import { cachedAppIcon } from "../../lib/segments";
import {
  CENTER,
  INNER_R,
  OUTER_R,
  polar,
  slicePath,
  sliceStartAngle,
} from "../../lib/wheelGeometry";
import type { WheelSegment } from "../../types/wheel";

type Props = {
  segment: WheelSegment;
  index: number;
  count: number;
  active: boolean;
  expanded: boolean;
  activeGlowId: string;
};

export function WheelWedge({
  segment,
  index,
  count,
  active,
  expanded,
  activeGlowId,
}: Props) {
  const anglePerSlice = 360 / Math.max(count, 1);
  const [labelX, labelY] = polar(
    CENTER,
    CENTER,
    (OUTER_R + INNER_R) / 2,
    sliceStartAngle(index, count) + anglePerSlice / 2,
  );
  const visibleLabel =
    segment.label.length > 18
      ? `${segment.label.slice(0, 16)}…`
      : segment.label;
  const SegmentIcon = getSegmentIcon(segment.icon);
  const appIcon = cachedAppIcon(segment);
  return (
    <g
      className={`wheel-segment${active ? " is-active" : ""}${segment.action_type === "folder" ? " is-folder" : ""}${expanded ? " is-expanded" : ""}`}
      filter={active ? `url(#${activeGlowId})` : undefined}
    >
      <path
        className="segment-surface"
        d={slicePath(index, count, INNER_R, OUTER_R)}
      />
      <g className="segment-content">
        {appIcon ? (
          <image
            className="segment-app-icon"
            href={appIcon}
            x={labelX - 15}
            y={labelY - 32}
            width="30"
            height="30"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          />
        ) : (
          <g
            className="segment-icon"
            transform={`translate(${labelX - 13} ${labelY - 30})`}
          >
            <SegmentIcon size={26} strokeWidth={1.8} aria-hidden="true" />
          </g>
        )}
        <text
          className="segment-label"
          x={labelX}
          y={labelY + 17}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {visibleLabel}
        </text>
      </g>
    </g>
  );
}

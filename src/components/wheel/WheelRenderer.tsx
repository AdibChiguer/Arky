import { useId, type CSSProperties } from "react";
import {
  DEFAULT_WHEEL_OPACITY,
  MAX_SUBMENU_ITEMS,
  MAX_WHEEL_OPACITY,
  MIN_WHEEL_OPACITY,
} from "../../lib/constants";
import {
  CENTER,
  OUTER_R,
  PREVIEW_PADDING,
  WHEEL_SIZE,
} from "../../lib/wheelGeometry";
import type {
  RadialSubmenuConfig,
  WheelHubContent,
  WheelSegment,
} from "../../types/wheel";
import { RadialSubmenu } from "./RadialSubmenu";
import { WheelHub, type WheelHubProfileControls } from "./WheelHub";
import { WheelWedge } from "./WheelWedge";
import "../../WheelRenderer.css";

type Props = {
  segments: WheelSegment[];
  activeIndex?: number;
  expandedSegmentId?: string | null;
  submenu?: RadialSubmenuConfig | null;
  hub: WheelHubContent;
  ariaLabel?: string;
  variant?: "interactive" | "preview";
  opacity?: number;
  profileControls?: WheelHubProfileControls;
};

export function WheelRenderer({
  segments,
  activeIndex = -1,
  expandedSegmentId = null,
  submenu = null,
  hub,
  ariaLabel = "Arky action wheel",
  variant = "interactive",
  opacity = DEFAULT_WHEEL_OPACITY,
  profileControls,
}: Props) {
  const instanceId = useId().replace(/:/g, "");
  const shadowId = `${instanceId}-wheel-shadow`;
  const activeGlowId = `${instanceId}-active-glow`;
  const expandedSegmentIndex = expandedSegmentId
    ? segments.findIndex((segment) => segment.id === expandedSegmentId)
    : -1;
  const visibleSubmenu = submenu
    ? {
        ...submenu,
        items: submenu.items.slice(0, MAX_SUBMENU_ITEMS),
        activeIndex:
          submenu.activeIndex < MAX_SUBMENU_ITEMS ? submenu.activeIndex : -1,
      }
    : null;
  const previewViewStart = CENTER - OUTER_R - PREVIEW_PADDING;
  const previewSize = (OUTER_R + PREVIEW_PADDING) * 2;
  const viewBox =
    variant === "preview"
      ? `${previewViewStart} ${previewViewStart} ${previewSize} ${previewSize}`
      : `0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`;
  const fillOpacity =
    Math.min(MAX_WHEEL_OPACITY, Math.max(MIN_WHEEL_OPACITY, opacity)) / 100;
  const style = { "--wheel-fill-opacity": fillOpacity } as CSSProperties;
  return (
    <div
      className={`wheel-renderer${variant === "preview" ? " is-preview" : ""}`}
      style={style}
    >
      <svg
        className="wheel"
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        viewBox={viewBox}
        role={variant === "preview" ? "img" : undefined}
        aria-label={ariaLabel}
      >
        <defs>
          <filter id={shadowId} x="-24%" y="-24%" width="148%" height="158%">
            <feDropShadow
              dx="0"
              dy="11"
              stdDeviation="10"
              floodColor="#000000"
              floodOpacity="0.58"
            />
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2"
              floodColor="#000000"
              floodOpacity="0.5"
            />
          </filter>
          <filter
            id={activeGlowId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="4"
              floodColor="#000000"
              floodOpacity="0.24"
            />
          </filter>
        </defs>
        <g className="wheel-slices" filter={`url(#${shadowId})`}>
          {segments.map((segment, index) => (
            <WheelWedge
              key={segment.id}
              segment={segment}
              index={index}
              count={segments.length}
              active={index === activeIndex}
              expanded={expandedSegmentId === segment.id}
              activeGlowId={activeGlowId}
            />
          ))}
        </g>
        {visibleSubmenu &&
          visibleSubmenu.items.length > 0 &&
          expandedSegmentIndex >= 0 && (
            <RadialSubmenu
              config={visibleSubmenu}
              parentIndex={expandedSegmentIndex}
              parentCount={segments.length}
              shadowId={shadowId}
              activeGlowId={activeGlowId}
              instanceId={instanceId}
            />
          )}
      </svg>
      <WheelHub hub={hub} live={variant === "interactive"} profileControls={profileControls} />
    </div>
  );
}

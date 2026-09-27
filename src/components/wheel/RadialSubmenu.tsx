import {
  CENTER,
  FOLDER_INNER_R,
  FOLDER_OUTER_R,
  polar,
  submenuArcGeometry,
  submenuSlicePath,
} from "../../lib/wheelGeometry";
import type { RadialSubmenuConfig } from "../../types/wheel";

type Props = {
  config: RadialSubmenuConfig;
  parentIndex: number;
  parentCount: number;
  shadowId: string;
  activeGlowId: string;
  instanceId: string;
};

export function RadialSubmenu({
  config,
  parentIndex,
  parentCount,
  shadowId,
  activeGlowId,
  instanceId,
}: Props) {
  const arc = submenuArcGeometry(parentIndex, parentCount, config.items.length);
  return (
    <g
      className="submenu-ring"
      filter={`url(#${shadowId})`}
      role="menu"
      aria-label={config.ariaLabel}
    >
      {config.items.map((item, index) => {
        const [x, y] = polar(
          CENTER,
          CENTER,
          (FOLDER_OUTER_R + FOLDER_INNER_R) / 2,
          arc.start + (index + 0.5) * arc.itemSpan,
        );
        const active = index === config.activeIndex;
        const label =
          item.label.length > 15 ? `${item.label.slice(0, 13)}…` : item.label;
        const previewId = `${instanceId}-submenu-preview-${index}`;
        const isPreview = item.imageKind === "preview";
        const width = isPreview ? 34 : 26;
        const height = isPreview ? 24 : 26;
        const imageX = x - width / 2;
        const imageY = y - (isPreview ? 27 : 26);
        return (
          <g
            className={`wheel-segment submenu-segment${active ? " is-active" : ""}`}
            key={item.id}
            filter={active ? `url(#${activeGlowId})` : undefined}
            role="menuitem"
            aria-label={item.ariaLabel || item.label}
          >
            {isPreview && (
              <clipPath id={previewId}>
                <rect
                  x={imageX}
                  y={imageY}
                  width={width}
                  height={height}
                  rx="5"
                />
              </clipPath>
            )}
            <path
              className="segment-surface"
              d={submenuSlicePath(
                index,
                config.items.length,
                parentIndex,
                parentCount,
                FOLDER_INNER_R,
                FOLDER_OUTER_R,
              )}
            />
            <g className="segment-content">
              {item.imageSrc ? (
                <image
                  className={
                    isPreview ? "submenu-preview-image" : "segment-app-icon"
                  }
                  href={item.imageSrc}
                  x={imageX}
                  y={imageY}
                  width={width}
                  height={height}
                  preserveAspectRatio={
                    isPreview ? "xMidYMid slice" : "xMidYMid meet"
                  }
                  clipPath={isPreview ? `url(#${previewId})` : undefined}
                  aria-hidden="true"
                />
              ) : (
                <g
                  className="segment-icon"
                  transform={`translate(${x - 11} ${y - 26})`}
                >
                  <item.Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                </g>
              )}
              <text
                className="segment-label"
                x={x}
                y={y + 14}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

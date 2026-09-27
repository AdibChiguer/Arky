import { MAX_SUBMENU_ITEMS } from "./constants";

export const WHEEL_SIZE = 620;
export const CENTER = WHEEL_SIZE / 2;
export const OUTER_R = 186;
export const INNER_R = 91;
export const FOLDER_INNER_R = 206;
export const FOLDER_OUTER_R = FOLDER_INNER_R + (OUTER_R - INNER_R);
export const PREVIEW_PADDING = 24;

const SLICE_GAP_DEG = 1.8;
export const SUBMENU_ITEM_DEG = 360 / MAX_SUBMENU_ITEMS;

export function polar(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  const radians = (angleDeg * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

export function sliceStartAngle(index: number, count: number) {
  const anglePerSlice = 360 / Math.max(count, 1);
  return -90 - anglePerSlice / 2 + index * anglePerSlice;
}

function ringSlicePath(start: number, end: number, innerRadius: number, outerRadius: number) {
  const [x1, y1] = polar(CENTER, CENTER, outerRadius, start);
  const [x2, y2] = polar(CENTER, CENTER, outerRadius, end);
  const [x3, y3] = polar(CENTER, CENTER, innerRadius, end);
  const [x4, y4] = polar(CENTER, CENTER, innerRadius, start);
  const sweep = end - start;
  const largeArc = sweep > 180 ? 1 : 0;
  if (sweep >= 359.9) {
    const [outerMidX, outerMidY] = polar(CENTER, CENTER, outerRadius, start + 180);
    const [innerMidX, innerMidY] = polar(CENTER, CENTER, innerRadius, start + 180);
    return [`M ${x1} ${y1}`, `A ${outerRadius} ${outerRadius} 0 1 1 ${outerMidX} ${outerMidY}`, `A ${outerRadius} ${outerRadius} 0 1 1 ${x2} ${y2}`, `L ${x3} ${y3}`, `A ${innerRadius} ${innerRadius} 0 1 0 ${innerMidX} ${innerMidY}`, `A ${innerRadius} ${innerRadius} 0 1 0 ${x4} ${y4}`, "Z"].join(" ");
  }
  return [`M ${x1} ${y1}`, `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`, `L ${x3} ${y3}`, `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`, "Z"].join(" ");
}

export function slicePath(index: number, count: number, innerRadius: number, outerRadius: number) {
  const anglePerSlice = 360 / Math.max(count, 1);
  const gap = count > 1 ? Math.min(SLICE_GAP_DEG, anglePerSlice * 0.08) : 0;
  const start = sliceStartAngle(index, count) + gap / 2;
  return ringSlicePath(start, sliceStartAngle(index, count) + anglePerSlice - gap / 2, innerRadius, outerRadius);
}

export function submenuArcGeometry(parentIndex: number, parentCount: number, itemCount: number) {
  const safeParentCount = Math.max(parentCount, 1);
  const safeItemCount = Math.min(Math.max(itemCount, 1), MAX_SUBMENU_ITEMS);
  const parentSpan = 360 / safeParentCount;
  const parentStart = sliceStartAngle(parentIndex, safeParentCount);
  const parentCenter = parentStart + parentSpan / 2;
  const arcSpan = safeItemCount * SUBMENU_ITEM_DEG;
  return { start: parentCenter - arcSpan / 2, end: parentCenter + arcSpan / 2, span: arcSpan, itemSpan: SUBMENU_ITEM_DEG };
}

export function submenuSlicePath(index: number, itemCount: number, parentIndex: number, parentCount: number, innerRadius: number, outerRadius: number) {
  const arc = submenuArcGeometry(parentIndex, parentCount, itemCount);
  const gap = itemCount > 1 ? Math.min(SLICE_GAP_DEG, arc.itemSpan * 0.08) : 0;
  return ringSlicePath(arc.start + index * arc.itemSpan + gap / 2, arc.start + (index + 1) * arc.itemSpan - gap / 2, innerRadius, outerRadius);
}

export function angleToIndex(dx: number, dy: number, count: number, innerRadius: number, outerRadius: number) {
  if (count === 0) return -1;
  const distance = Math.hypot(dx, dy);
  if (distance < innerRadius || distance > outerRadius + 6) return -1;
  const anglePerSlice = 360 / count;
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  const index = Math.floor(((degrees + 90 + anglePerSlice / 2 + 360) % 360) / anglePerSlice);
  return index < count ? index : -1;
}

export function angleToSubmenuIndex(dx: number, dy: number, parentIndex: number, parentCount: number, itemCount: number, innerRadius: number, outerRadius: number) {
  if (itemCount === 0 || parentIndex < 0) return -1;
  const distance = Math.hypot(dx, dy);
  if (distance < innerRadius || distance > outerRadius + 6) return -1;
  const arc = submenuArcGeometry(parentIndex, parentCount, itemCount);
  const pointerAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const relativeAngle = ((pointerAngle - arc.start) % 360 + 360) % 360;
  if (relativeAngle >= arc.span) return -1;
  const index = Math.floor(relativeAngle / arc.itemSpan);
  return index < itemCount ? index : -1;
}

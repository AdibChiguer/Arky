import { normalizeIconName } from "../icons";
import { ACTION_TYPES } from "./constants";
import type { WheelSegment } from "../types/wheel";

export type SegmentLocation = {
  segment: WheelSegment;
  index: number;
  parent?: WheelSegment;
};

export type QuickKeyConflict = { key: string; segments: WheelSegment[] };

export function createSegment(quickKey: string): WheelSegment {
  return {
    id: crypto.randomUUID(), label: "New action", icon: "Sparkles", app_icon: null,
    action_type: "open_url_or_file", payload: "", quick_key: quickKey, children: [],
  };
}

export function createFolder(quickKey: string): WheelSegment {
  return {
    id: crypto.randomUUID(), label: "New folder", icon: "FolderOpen", app_icon: null,
    action_type: "folder", payload: "", quick_key: quickKey, children: [],
  };
}

export function actionLabel(actionType: string) {
  return ACTION_TYPES.find((action) => action.value === actionType)?.label || "Custom action";
}

export function normalizeSegment(segment: WheelSegment): WheelSegment {
  return { ...segment, icon: normalizeIconName(segment.icon), children: (segment.children || []).map(normalizeSegment) };
}

export function findSegment(segments: WheelSegment[], id: string): SegmentLocation | undefined {
  const topIndex = segments.findIndex((segment) => segment.id === id);
  if (topIndex >= 0) return { segment: segments[topIndex], index: topIndex };
  for (const parent of segments) {
    const childIndex = parent.children.findIndex((child) => child.id === id);
    if (childIndex >= 0) return { segment: parent.children[childIndex], index: childIndex, parent };
  }
}

const normalizeQuickKey = (key: string) => key.toLocaleLowerCase();

export function findQuickKeyConflicts(segments: WheelSegment[]): QuickKeyConflict[] {
  const segmentsByKey = new Map<string, WheelSegment[]>();
  const visit = (items: WheelSegment[]) => items.forEach((segment) => {
    if (segment.quick_key) {
      const key = normalizeQuickKey(segment.quick_key);
      segmentsByKey.set(key, [...(segmentsByKey.get(key) || []), segment]);
    }
    visit(segment.children || []);
  });
  visit(segments);
  return Array.from(segmentsByKey, ([key, matching]) => ({ key, segments: matching }))
    .filter((conflict) => conflict.segments.length > 1);
}

export function nextAvailableQuickKey(segments: WheelSegment[]) {
  const usedKeys = new Set<string>();
  const visit = (items: WheelSegment[]) => items.forEach((segment) => {
    if (segment.quick_key) usedKeys.add(normalizeQuickKey(segment.quick_key));
    visit(segment.children || []);
  });
  visit(segments);
  for (let key = 1; key <= 9; key += 1) if (!usedKeys.has(String(key))) return String(key);
  return "";
}

export function cachedAppIcon(segment?: WheelSegment) {
  if (segment?.action_type !== "launch_app" || !segment.app_icon) return null;
  return segment.app_icon.startsWith("data:") ? segment.app_icon : `data:image/png;base64,${segment.app_icon}`;
}

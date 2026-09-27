import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Plus } from "lucide-react";
import { getSegmentIcon } from "./icons";
import { WheelRenderer } from "./components/wheel/WheelRenderer";
import { DEFAULT_WHEEL_OPACITY, MAX_SUBMENU_ITEMS } from "./lib/constants";
import { cachedAppIcon } from "./lib/segments";
import { commands } from "./lib/tauri";
import { angleToIndex, angleToSubmenuIndex, CENTER, FOLDER_INNER_R, FOLDER_OUTER_R, INNER_R, OUTER_R, WHEEL_SIZE } from "./lib/wheelGeometry";
import type { AppConfig, RadialSubmenuItem, RunningAppState, WheelProfile, WheelSegment as Segment } from "./types/wheel";

type RunningAppAction =
  | { kind: "window"; windowId: number | null; fallbackIndex: number }
  | { kind: "new_instance" }
  | null;

const FOLDER_HOVER_DELAY_MS = 70;
const RUNNING_APP_DWELL_MS = 700;
const MAX_VISIBLE_APP_WINDOWS = MAX_SUBMENU_ITEMS - 1;
const ACTION_TIMEOUT_MS = 4000;
const ACTION_ERROR_DISPLAY_MS = 3000;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

function visibleAppWindows(state: RunningAppState | null) {
  return state?.windows.slice(0, MAX_VISIBLE_APP_WINDOWS) || [];
}

function appActionAtIndex(state: RunningAppState | null, index: number): RunningAppAction {
  const windows = visibleAppWindows(state);
  if (index < 0 || index > windows.length) return null;
  if (index === windows.length) return { kind: "new_instance" };
  return {
    kind: "window",
    windowId: windows[index].window_id,
    fallbackIndex: index,
  };
}

function appActionsMatch(left: RunningAppAction, right: RunningAppAction) {
  if (left?.kind !== right?.kind) return false;
  if (left?.kind !== "window" || right?.kind !== "window") return true;
  return left.windowId !== null && right.windowId !== null
    ? left.windowId === right.windowId
    : left.fallbackIndex === right.fallbackIndex;
}

function windowForAction(state: RunningAppState | null, action: RunningAppAction) {
  if (action?.kind !== "window" || !state) return undefined;
  if (action.windowId !== null) {
    return state.windows.find((window) => window.window_id === action.windowId);
  }
  return state.windows[action.fallbackIndex];
}

function indexForAppAction(state: RunningAppState | null, action: RunningAppAction) {
  if (!action || !state) return -1;
  const windows = visibleAppWindows(state);
  if (action.kind === "new_instance") return windows.length;
  if (action.windowId !== null) {
    return windows.findIndex((window) => window.window_id === action.windowId);
  }
  return action.fallbackIndex < windows.length ? action.fallbackIndex : -1;
}

function Wheel() {
  const [profiles, setProfiles] = useState<WheelProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [profileSwitching, setProfileSwitching] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [activeChildIndex, setActiveChildIndex] = useState(-1);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [runningAppState, setRunningAppState] = useState<RunningAppState | null>(null);
  const [activeAppAction, setActiveAppAction] = useState<RunningAppAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [wheelOpacity, setWheelOpacity] = useState(DEFAULT_WHEEL_OPACITY);
  const segmentsRef = useRef<Segment[]>([]);
  const activeIndexRef = useRef(-1);
  const expandedFolderIdRef = useRef<string | null>(null);
  const activeChildIndexRef = useRef(-1);
  const expandedAppIdRef = useRef<string | null>(null);
  const runningAppStateRef = useRef<RunningAppState | null>(null);
  const activeAppActionRef = useRef<RunningAppAction>(null);
  const appProbeIdRef = useRef<string | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const cancelByCenterRef = useRef(true);
  const cancelWithEscapeRef = useRef(true);
  const activeProfileIdRef = useRef("");
  const profileGenerationRef = useRef(0);
  const profileSwitchingRef = useRef(false);
  const actionErrorTimerRef = useRef<number | null>(null);

  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);
  useEffect(() => { expandedFolderIdRef.current = expandedFolderId; }, [expandedFolderId]);
  useEffect(() => { activeChildIndexRef.current = activeChildIndex; }, [activeChildIndex]);
  useEffect(() => { expandedAppIdRef.current = expandedAppId; }, [expandedAppId]);
  useEffect(() => { runningAppStateRef.current = runningAppState; }, [runningAppState]);
  useEffect(() => { activeAppActionRef.current = activeAppAction; }, [activeAppAction]);

  useEffect(() => () => {
    if (actionErrorTimerRef.current !== null) {
      window.clearTimeout(actionErrorTimerRef.current);
    }
  }, []);

  function showActionError(message: string) {
    if (actionErrorTimerRef.current !== null) {
      window.clearTimeout(actionErrorTimerRef.current);
    }
    setActionError(message);
    actionErrorTimerRef.current = window.setTimeout(() => {
      actionErrorTimerRef.current = null;
      setActionError(null);
    }, ACTION_ERROR_DISPLAY_MS);
  }

  function applyConfigProfiles(config: AppConfig) {
    const activeProfile = config.profiles.find((profile) => profile.id === config.active_profile_id) ?? config.profiles[0];
    profileGenerationRef.current += 1;
    resetSelection();
    setProfiles(config.profiles);
    activeProfileIdRef.current = activeProfile?.id ?? "";
    setActiveProfileId(activeProfile?.id ?? "");
    segmentsRef.current = activeProfile?.segments ?? [];
    setSegments(activeProfile?.segments ?? []);
  }

  useEffect(() => {
    let disposed = false;
    let stopListening: (() => void) | undefined;

    async function loadConfig() {
      const config = await commands.getConfig();
      if (!disposed) {
        cancelByCenterRef.current = config.cancel_by_center ?? true;
        cancelWithEscapeRef.current = config.cancel_with_escape ?? true;
        setWheelOpacity(config.wheel_opacity ?? DEFAULT_WHEEL_OPACITY);
        applyConfigProfiles(config);
      }
    }

    async function subscribeToConfigChanges() {
      await loadConfig();
      const unlisten = await listen("config-updated", () => {
        void loadConfig();
      });
      if (disposed) unlisten();
      else stopListening = unlisten;
    }

    void subscribeToConfigChanges();
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, []);

  async function cycleProfile(direction: -1 | 1) {
    if (profileSwitchingRef.current || profiles.length <= 1) return;
    const currentIndex = profiles.findIndex((profile) => profile.id === activeProfileIdRef.current);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const targetIndex = (safeCurrentIndex + direction + profiles.length) % profiles.length;
    const targetProfile = profiles[targetIndex];
    const switchGeneration = profileGenerationRef.current + 1;
    profileGenerationRef.current = switchGeneration;
    resetSelection();
    profileSwitchingRef.current = true;
    setProfileSwitching(true);
    try {
      await commands.setActiveProfile(targetProfile.id);
      if (profileGenerationRef.current !== switchGeneration) return;
      activeProfileIdRef.current = targetProfile.id;
      setActiveProfileId(targetProfile.id);
      segmentsRef.current = targetProfile.segments;
      setSegments(targetProfile.segments);
    } catch (error) {
      console.error("Could not switch wheel profiles", error);
    } finally {
      profileSwitchingRef.current = false;
      setProfileSwitching(false);
    }
  }

  const expandedFolder = expandedFolderId
    ? segments.find((segment) => segment.id === expandedFolderId)
    : undefined;
  const folderChildren = expandedFolder?.children.slice(0, MAX_SUBMENU_ITEMS) || [];
  const expandedAppIndex = expandedAppId
    ? segments.findIndex((segment) => segment.id === expandedAppId)
    : -1;
  const expandedAppSegment = expandedAppIndex >= 0 ? segments[expandedAppIndex] : undefined;

  useEffect(() => {
    if (!expandedAppId) return;
    const segment = segments.find((candidate) => candidate.id === expandedAppId);
    if (!segment?.payload) return;
    const applicationPath = segment.payload;
    const refreshGeneration = profileGenerationRef.current;
    const refreshProfileId = activeProfileId;

    let disposed = false;
    async function refreshPreview() {
      try {
        const state = await commands.getRunningAppState(applicationPath, true);
        if (
          disposed
          || profileGenerationRef.current !== refreshGeneration
          || activeProfileIdRef.current !== refreshProfileId
        ) return;
        if (!state.running) {
          expandedAppIdRef.current = null;
          runningAppStateRef.current = null;
          activeAppActionRef.current = null;
          setExpandedAppId(null);
          setRunningAppState(null);
          setActiveAppAction(null);
          return;
        }
        runningAppStateRef.current = state;
        setRunningAppState(state);
        const currentAction = activeAppActionRef.current;
        if (currentAction?.kind === "window" && !windowForAction(state, currentAction)) {
          activeAppActionRef.current = null;
          setActiveAppAction(null);
        }
      } catch {
        // Keep the last good preview; the selected app may be between windows.
      }
    }

    const interval = window.setInterval(() => {
      void refreshPreview();
    }, 650);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [activeProfileId, expandedAppId, segments]);

  function clearDwellTimer() {
    if (dwellTimerRef.current !== null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }

  function selectTop(index: number) {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }

  function selectChild(index: number) {
    activeChildIndexRef.current = index;
    setActiveChildIndex(index);
  }

  function selectAppAction(action: RunningAppAction) {
    activeAppActionRef.current = action;
    setActiveAppAction(action);
  }

  function collapseFolder() {
    clearDwellTimer();
    expandedFolderIdRef.current = null;
    activeChildIndexRef.current = -1;
    setExpandedFolderId(null);
    setActiveChildIndex(-1);
  }

  function collapseAppMenu() {
    clearDwellTimer();
    expandedAppIdRef.current = null;
    runningAppStateRef.current = null;
    activeAppActionRef.current = null;
    setExpandedAppId(null);
    setRunningAppState(null);
    setActiveAppAction(null);
  }

  function resetSelection() {
    clearDwellTimer();
    activeIndexRef.current = -1;
    expandedFolderIdRef.current = null;
    activeChildIndexRef.current = -1;
    expandedAppIdRef.current = null;
    runningAppStateRef.current = null;
    activeAppActionRef.current = null;
    appProbeIdRef.current = null;
    setActiveIndex(-1);
    setExpandedFolderId(null);
    setActiveChildIndex(-1);
    setExpandedAppId(null);
    setRunningAppState(null);
    setActiveAppAction(null);
  }

  function scheduleFolderExpansion(folder: Segment, index: number) {
    if (
      folder.action_type !== "folder"
      || folder.children.length === 0
      || expandedFolderIdRef.current === folder.id
      || dwellTimerRef.current !== null
    ) {
      return;
    }

    const scheduledGeneration = profileGenerationRef.current;
    const scheduledProfileId = activeProfileIdRef.current;

    dwellTimerRef.current = window.setTimeout(() => {
      dwellTimerRef.current = null;
      if (
        profileGenerationRef.current !== scheduledGeneration
        || activeProfileIdRef.current !== scheduledProfileId
      ) return;
      const stillHovered = segmentsRef.current[activeIndexRef.current];
      if (activeIndexRef.current === index && stillHovered?.id === folder.id) {
        expandedFolderIdRef.current = folder.id;
        activeChildIndexRef.current = -1;
        setExpandedFolderId(folder.id);
        setActiveChildIndex(-1);
      }
    }, FOLDER_HOVER_DELAY_MS);
  }

  function scheduleRunningAppExpansion(segment: Segment, index: number) {
    if (
      segment.action_type !== "launch_app"
      || !segment.payload
      || expandedAppIdRef.current === segment.id
      || appProbeIdRef.current === segment.id
      || dwellTimerRef.current !== null
    ) {
      return;
    }

    const scheduledGeneration = profileGenerationRef.current;
    const scheduledProfileId = activeProfileIdRef.current;

    dwellTimerRef.current = window.setTimeout(() => {
      dwellTimerRef.current = null;
      if (
        profileGenerationRef.current !== scheduledGeneration
        || activeProfileIdRef.current !== scheduledProfileId
      ) return;
      appProbeIdRef.current = segment.id;
      void commands.getRunningAppState(segment.payload, true).then((state) => {
        if (
          profileGenerationRef.current !== scheduledGeneration
          || activeProfileIdRef.current !== scheduledProfileId
        ) return;
        const stillHovered = segmentsRef.current[activeIndexRef.current];
        if (
          state.running
          && activeIndexRef.current === index
          && stillHovered?.id === segment.id
        ) {
          if (expandedFolderIdRef.current) collapseFolder();
          expandedAppIdRef.current = segment.id;
          runningAppStateRef.current = state;
          activeAppActionRef.current = null;
          setExpandedAppId(segment.id);
          setRunningAppState(state);
          setActiveAppAction(null);
        }
      }).catch(() => {
        // Invalid or inaccessible legacy paths keep the segment's normal behavior.
      });
    }, RUNNING_APP_DWELL_MS);
  }

  async function fireSegment(seg: Segment) {
    if (seg.action_type === "folder" || seg.action_type === "submenu") {
      resetSelection();
      await commands.hideWheel();
      return;
    }
    setActionError(null);
    try {
      await withTimeout(
        commands.runAction(seg.action_type, seg.payload),
        ACTION_TIMEOUT_MS,
        "The action did not respond in time.",
      );
      resetSelection();
      await commands.hideWheel();
    } catch (error) {
      console.error(`Could not run ${seg.action_type} action`, error);
      resetSelection();
      showActionError(
        seg.action_type === "clipboard_history"
          ? "Clipboard history is unavailable"
          : "This action could not be completed",
      );
    }
  }

  async function fireActive() {
    const topSegment = segmentsRef.current[activeIndexRef.current];
    const openApp = segmentsRef.current.find(
      (segment) => segment.id === expandedAppIdRef.current,
    );
    const appAction = activeAppActionRef.current;
    const openFolder = segmentsRef.current.find(
      (segment) => segment.id === expandedFolderIdRef.current,
    );
    const child = openFolder?.children[activeChildIndexRef.current];
    const selectedWindow = windowForAction(runningAppStateRef.current, appAction);

    if (openApp && appAction?.kind === "window" && selectedWindow) {
      resetSelection();
      await commands.focusRunningApp(openApp.payload, selectedWindow.window_id);
    } else if (openApp && appAction?.kind === "new_instance") {
      resetSelection();
      await commands.launchNewAppInstance(openApp.payload);
    } else if (openApp) {
      if (cancelByCenterRef.current) {
        resetSelection();
        await commands.hideWheel();
      }
    } else if (child) await fireSegment(child);
    else if (openFolder) {
      if (cancelByCenterRef.current) {
        resetSelection();
        await commands.hideWheel();
      }
    } else if (topSegment) await fireSegment(topSegment);
    else if (cancelByCenterRef.current) {
      resetSelection();
      await commands.hideWheel();
    }
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const scaleX = window.innerWidth > 0 ? WHEEL_SIZE / window.innerWidth : 1;
      const scaleY = window.innerHeight > 0 ? WHEEL_SIZE / window.innerHeight : 1;
      const dx = e.clientX * scaleX - CENTER;
      const dy = e.clientY * scaleY - CENTER;
      const distance = Math.hypot(dx, dy);
      const currentSegments = segmentsRef.current;
      const openAppIndex = currentSegments.findIndex(
        (segment) => segment.id === expandedAppIdRef.current,
      );
      const openFolderIndex = currentSegments.findIndex(
        (segment) => segment.id === expandedFolderIdRef.current,
      );
      const openFolder = openFolderIndex >= 0 ? currentSegments[openFolderIndex] : undefined;
      const submenuOwnerIndex = openAppIndex >= 0
        ? openAppIndex
        : openFolderIndex;
      const submenuItemCount = openAppIndex >= 0
        ? visibleAppWindows(runningAppStateRef.current).length + 1
        : openFolder?.children.slice(0, MAX_SUBMENU_ITEMS).length || 0;

      if (submenuOwnerIndex >= 0 && submenuItemCount > 0) {
        const submenuIndex = angleToSubmenuIndex(
          dx,
          dy,
          submenuOwnerIndex,
          currentSegments.length,
          submenuItemCount,
          FOLDER_INNER_R,
          FOLDER_OUTER_R,
        );
        if (submenuIndex >= 0) {
          if (submenuOwnerIndex !== activeIndexRef.current) selectTop(submenuOwnerIndex);
          if (openAppIndex >= 0) {
            const action = appActionAtIndex(runningAppStateRef.current, submenuIndex);
            if (!appActionsMatch(action, activeAppActionRef.current)) selectAppAction(action);
            if (activeChildIndexRef.current !== -1) selectChild(-1);
          } else {
            if (submenuIndex !== activeChildIndexRef.current) selectChild(submenuIndex);
            if (activeAppActionRef.current !== null) selectAppAction(null);
          }
          clearDwellTimer();
          return;
        }

        if (distance > OUTER_R && distance < FOLDER_INNER_R) {
          if (openAppIndex >= 0) {
            if (activeAppActionRef.current !== null) selectAppAction(null);
          } else if (activeChildIndexRef.current !== -1) {
            selectChild(-1);
          }
          return;
        }
      }

      const index = angleToIndex(dx, dy, currentSegments.length, INNER_R, OUTER_R);
      if (index >= 0) {
        if (index !== activeIndexRef.current) {
          clearDwellTimer();
          appProbeIdRef.current = null;
          selectTop(index);
        }
        if (activeChildIndexRef.current !== -1) selectChild(-1);
        if (activeAppActionRef.current !== null) selectAppAction(null);

        const segment = currentSegments[index];
        if (segment.action_type === "folder" && segment.children.length > 0) {
          if (expandedAppIdRef.current) collapseAppMenu();
          if (expandedFolderIdRef.current !== segment.id) {
            if (expandedFolderIdRef.current) collapseFolder();
            scheduleFolderExpansion(segment, index);
          }
        } else if (segment.action_type === "launch_app") {
          if (expandedFolderIdRef.current) collapseFolder();
          if (expandedAppIdRef.current !== segment.id) {
            if (expandedAppIdRef.current) collapseAppMenu();
            scheduleRunningAppExpansion(segment, index);
          }
        } else {
          if (expandedFolderIdRef.current) collapseFolder();
          if (expandedAppIdRef.current) collapseAppMenu();
        }
        return;
      }

      if (cancelByCenterRef.current) resetSelection();
      else clearDwellTimer();
    }
    function onMouseUp() { fireActive(); }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (cancelWithEscapeRef.current) {
          resetSelection();
          void commands.hideWheel();
        }
        return;
      }
      const openFolder = segmentsRef.current.find(
        (segment) => segment.id === expandedFolderIdRef.current,
      );
      const child = openFolder?.children
        .slice(0, MAX_SUBMENU_ITEMS)
        .find((segment) => segment.quick_key === e.key);
      if (child) {
        fireSegment(child);
        return;
      }

      const index = segmentsRef.current.findIndex((segment) => segment.quick_key === e.key);
      const segment = segmentsRef.current[index];
      if (!segment) return;
      if (segment.action_type === "folder" && segment.children.length > 0) {
        clearDwellTimer();
        if (expandedAppIdRef.current) collapseAppMenu();
        selectTop(index);
        expandedFolderIdRef.current = segment.id;
        setExpandedFolderId(segment.id);
        selectChild(-1);
      } else {
        fireSegment(segment);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      clearDwellTimer();
    };
  }, []);

  const activeSegment = activeIndex >= 0 ? segments[activeIndex] : undefined;
  const activeProfileIndex = profiles.findIndex((profile) => profile.id === activeProfileId);
  const safeActiveProfileIndex = activeProfileIndex >= 0 ? activeProfileIndex : 0;
  const activeProfile = profiles[safeActiveProfileIndex];
  const previousProfile = profiles.length > 0
    ? profiles[(safeActiveProfileIndex - 1 + profiles.length) % profiles.length]
    : undefined;
  const nextProfile = profiles.length > 0
    ? profiles[(safeActiveProfileIndex + 1) % profiles.length]
    : undefined;
  const activeChild = activeChildIndex >= 0 ? folderChildren[activeChildIndex] : undefined;
  const activeWindow = windowForAction(runningAppState, activeAppAction);
  const activeLabel = actionError || (activeWindow
    ? activeWindow.window_title || `${expandedAppSegment?.label || "App"} window`
    : activeAppAction?.kind === "new_instance"
      ? `New ${expandedAppSegment?.label || "instance"}`
      : activeChild?.label || activeSegment?.label || "Arky");
  const activePosition = actionError
    ? "Wheel remains available"
    : activeWindow
    ? "Running window"
    : activeAppAction?.kind === "new_instance"
      ? "Best effort"
      : activeChild
    ? `${String(activeChildIndex + 1).padStart(2, "0")} / ${String(folderChildren.length).padStart(2, "0")}`
    : activeSegment
      ? `${String(activeIndex + 1).padStart(2, "0")} / ${String(segments.length).padStart(2, "0")}`
    : segments.length > 0
      ? `${String(segments.length).padStart(2, "0")} actions`
      : "No actions";
  const ExpandedAppIcon = getSegmentIcon(expandedAppSegment?.icon || "AppWindow");
  const expandedAppIcon = expandedAppSegment ? cachedAppIcon(expandedAppSegment) : null;
  const folderSubmenuItems: RadialSubmenuItem[] = folderChildren.map((child) => ({
    id: child.id,
    label: child.label,
    Icon: getSegmentIcon(child.icon),
    imageSrc: cachedAppIcon(child),
    imageKind: "icon",
  }));
  const appSubmenuItems: RadialSubmenuItem[] = expandedAppSegment && runningAppState?.running
    ? [
        ...visibleAppWindows(runningAppState).map((window, index) => {
          const windowLabel = window.window_title
            || `${expandedAppSegment.label || "App"} window ${index + 1}`;
          return {
            id: `${expandedAppSegment.id}-window-${window.window_id ?? index}`,
            label: windowLabel,
            ariaLabel: `Switch to ${windowLabel}`,
            Icon: ExpandedAppIcon,
            imageSrc: window.preview_data || expandedAppIcon,
            imageKind: window.preview_data ? "preview" as const : "icon" as const,
          };
        }),
        {
          id: `${expandedAppSegment.id}-new`,
          label: "New instance",
          ariaLabel: `Request a new ${expandedAppSegment.label} instance`,
          Icon: Plus,
        },
      ]
    : [];
  const activeAppActionIndex = indexForAppAction(runningAppState, activeAppAction);
  const submenu = expandedFolder && folderSubmenuItems.length > 0
    ? {
        items: folderSubmenuItems,
        activeIndex: activeChildIndex,
        ariaLabel: `${expandedFolder.label} folder`,
      }
    : expandedAppSegment && appSubmenuItems.length > 0
      ? {
          items: appSubmenuItems,
          activeIndex: activeAppActionIndex,
          ariaLabel: `${expandedAppSegment.label} is running`,
        }
      : null;

  return (
    <WheelRenderer
      segments={segments}
      opacity={wheelOpacity}
      activeIndex={activeIndex}
      expandedSegmentId={expandedFolderId || expandedAppId}
      submenu={submenu}
      profileControls={{
        disabled: profiles.length <= 1 || profileSwitching,
        previousName: previousProfile?.name ?? "No other profile",
        nextName: nextProfile?.name ?? "No other profile",
        onPrevious: () => { void cycleProfile(-1); },
        onNext: () => { void cycleProfile(1); },
      }}
      hub={{
        eyebrow: actionError
          ? "Action error"
          : activeAppAction
          ? "Running app"
          : activeChild
            ? expandedFolder?.label || "Folder"
            : activeSegment
              ? "Selected"
              : activeProfile?.name ?? "Action wheel",
        label: activeLabel,
        position: activePosition,
        active: Boolean(activeSegment || actionError),
      }}
    />
  );
}

export default Wheel;

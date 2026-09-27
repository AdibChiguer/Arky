import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { confirm as confirmDialog, open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { AppCatalogStatus } from "../components/builder/ApplicationPicker";
import { DEFAULT_WHEEL_OPACITY, DEFAULT_WHEEL_SCALE, MAX_PROFILE_NAME_LENGTH, MAX_SEGMENTS, MAX_SUBMENU_ITEMS } from "../lib/constants";
import { notify } from "../lib/notifications";
import { createFolder, createSegment, findQuickKeyConflicts, findSegment, nextAvailableQuickKey, normalizeSegment } from "../lib/segments";
import { defaultShortcut } from "../lib/shortcuts";
import { commands } from "../lib/tauri";
import type { AppConfig, BuilderView, InstalledApplication, Platform, WheelProfile, WheelSegment } from "../types/wheel";

function normalizeProfiles(profiles: WheelProfile[]) {
  return profiles.map((profile) => ({
    ...profile,
    segments: (profile.segments ?? []).map(normalizeSegment),
  }));
}

function newProfileId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `profile-${Date.now()}`;
}

function cloneSegments(segments: WheelSegment[]): WheelSegment[] {
  return segments.map((segment) => ({
    ...segment,
    children: cloneSegments(segment.children),
  }));
}

function duplicateProfileName(sourceName: string, profiles: WheelProfile[]) {
  const existingNames = new Set(profiles.map((profile) => profile.name.trim().toLocaleLowerCase()));
  const sourceCharacters = Array.from(sourceName.trim());
  for (let copyNumber = 1; ; copyNumber += 1) {
    const suffix = copyNumber === 1 ? " copy" : ` copy ${copyNumber}`;
    const availableCharacters = MAX_PROFILE_NAME_LENGTH - Array.from(suffix).length;
    const base = sourceCharacters.slice(0, availableCharacters).join("").trimEnd();
    const candidate = `${base}${suffix}`;
    if (!existingNames.has(candidate.toLocaleLowerCase())) return candidate;
  }
}

export function useBuilder() {
  const [profiles, setProfiles] = useState<WheelProfile[]>([]);
  const [editingProfileId, setEditingProfileId] = useState("");
  const [activeProfileId, setActiveProfileId] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [showInTray, setShowInTray] = useState(true);
  const [spawnAtCursor, setSpawnAtCursor] = useState(true);
  const [cancelByCenter, setCancelByCenterState] = useState(true);
  const [cancelWithEscape, setCancelWithEscapeState] = useState(true);
  const [wheelScale, setWheelScale] = useState(DEFAULT_WHEEL_SCALE);
  const [wheelOpacity, setWheelOpacity] = useState(DEFAULT_WHEEL_OPACITY);
  const [platform, setPlatform] = useState<Platform>(navigator.userAgent.includes("Mac") ? "macos" : "windows");
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<BuilderView>("actions");
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const [applications, setApplications] = useState<InstalledApplication[]>([]);
  const [appStatus, setAppStatus] = useState<AppCatalogStatus>("idle");
  const [appError, setAppError] = useState("");
  const [appQuery, setAppQuery] = useState("");
  const [preparingPath, setPreparingPath] = useState("");
  const [configTransfer, setConfigTransfer] = useState<"export" | "import" | null>(null);

  const editingProfile = profiles.find((profile) => profile.id === editingProfileId) ?? profiles[0];
  const segments = editingProfile?.segments ?? [];
  const selection = findSegment(segments, selectedId);
  const conflicts = useMemo(() => findQuickKeyConflicts(segments), [segments]);
  const selectedConflict = selection ? conflicts.find((conflict) => conflict.segments.some((segment) => segment.id === selection.segment.id)) : undefined;
  const conflictingLabels = selectedConflict?.segments.filter((segment) => segment.id !== selectedId).map((segment) => `“${segment.label || "Untitled action"}”`).join(", ");
  const quickKeyError = selectedConflict ? `Already assigned to ${conflictingLabels}. Quick keys must be unique across the wheel and folders.` : undefined;

  const setSegments = useCallback((next: WheelSegment[] | ((current: WheelSegment[]) => WheelSegment[])) => {
    setProfiles((currentProfiles) => currentProfiles.map((profile) => {
      if (profile.id !== editingProfileId) return profile;
      const segmentsForProfile = typeof next === "function" ? next(profile.segments) : next;
      return { ...profile, segments: segmentsForProfile };
    }));
  }, [editingProfileId]);

  useEffect(() => {
    let disposed = false;
    Promise.all([commands.getConfig(), commands.getPlatform()]).then(([config, currentPlatform]) => {
      if (disposed) return;
      const loadedProfiles = normalizeProfiles(config.profiles);
      const loadedActiveId = loadedProfiles.some((profile) => profile.id === config.active_profile_id)
        ? config.active_profile_id
        : loadedProfiles[0]?.id ?? "";
      const loadedActive = loadedProfiles.find((profile) => profile.id === loadedActiveId);
      setPlatform(currentPlatform);
      setProfiles(loadedProfiles);
      setEditingProfileId(loadedActiveId);
      setActiveProfileId(loadedActiveId);
      setShortcut(config.shortcut || defaultShortcut(currentPlatform));
      setLaunchAtLogin(config.launch_at_login ?? false);
      setShowInTray(config.show_in_tray ?? true);
      setSpawnAtCursor(config.spawn_at_cursor ?? true);
      setCancelByCenterState(config.cancel_by_center ?? true);
      setCancelWithEscapeState(config.cancel_with_escape ?? true);
      setWheelScale(config.wheel_scale ?? DEFAULT_WHEEL_SCALE);
      setWheelOpacity(config.wheel_opacity ?? DEFAULT_WHEEL_OPACITY);
      setSelectedId(loadedActive?.segments[0]?.id ?? "");
    }).catch((error) => {
      if (!disposed) notify({ tone: "error", message: `Could not load the wheel: ${String(error)}` });
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let disposed = false;
    let stopListening: (() => void) | undefined;
    void listen<string>("active-profile-changed", (event) => {
      if (!disposed) setActiveProfileId(event.payload);
    }).then((unlisten) => {
      if (disposed) unlisten();
      else stopListening = unlisten;
    });
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, []);

  const loadApplications = useCallback(async () => {
    setAppStatus("loading");
    setAppError("");
    try {
      setApplications(await commands.listInstalledApplications());
      setAppStatus("loaded");
    } catch (error) {
      setAppError(String(error));
      setAppStatus("error");
    }
  }, []);

  useEffect(() => {
    if (selection?.segment.action_type === "launch_app" && appStatus === "idle") void loadApplications();
  }, [selection?.segment.action_type, appStatus, loadApplications]);

  const updateSegment = useCallback((id: string, patch: Partial<WheelSegment>) => {
    setSegments((current) => current.map((segment) => segment.id === id
      ? { ...segment, ...patch }
      : !segment.children.some((child) => child.id === id)
        ? segment
        : { ...segment, children: segment.children.map((child) => child.id === id ? { ...child, ...patch } : child) }));
  }, [setSegments]);

  function select(id: string) {
    setSelectedId(id);
    setIconPickerOpen(false);
    setIconQuery("");
  }

  function selectProfile(id: string) {
    const profile = profiles.find((candidate) => candidate.id === id);
    if (!profile) return;
    setEditingProfileId(id);
    setSelectedId(profile.segments[0]?.id ?? "");
    setDraggedId("");
    setIconPickerOpen(false);
    setIconQuery("");
    setView("actions");
  }

  function createProfile(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      notify({ tone: "error", message: "Enter a profile name." });
      return false;
    }
    if (Array.from(trimmedName).length > MAX_PROFILE_NAME_LENGTH) {
      notify({ tone: "error", message: `Profile names can contain up to ${MAX_PROFILE_NAME_LENGTH} characters.` });
      return false;
    }
    if (profiles.some((profile) => profile.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
      notify({ tone: "error", message: "Choose a unique profile name." });
      return false;
    }
    const id = newProfileId();
    setProfiles((current) => [...current, { id, name: trimmedName, segments: [] }]);
    setEditingProfileId(id);
    setSelectedId("");
    setDraggedId("");
    setIconPickerOpen(false);
    setIconQuery("");
    setView("actions");
    notify({ tone: "info", message: `“${trimmedName}” created. Save to make it the active wheel.` });
    return true;
  }

  function renameProfile(id: string, name: string) {
    const profile = profiles.find((candidate) => candidate.id === id);
    if (!profile) return false;
    const trimmedName = name.trim();
    if (!trimmedName) {
      notify({ tone: "error", message: "Enter a profile name." });
      return false;
    }
    if (Array.from(trimmedName).length > MAX_PROFILE_NAME_LENGTH) {
      notify({ tone: "error", message: `Profile names can contain up to ${MAX_PROFILE_NAME_LENGTH} characters.` });
      return false;
    }
    if (profiles.some((candidate) => candidate.id !== id && candidate.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
      notify({ tone: "error", message: "Choose a unique profile name." });
      return false;
    }
    if (profile.name === trimmedName) return true;
    setProfiles((current) => current.map((candidate) => candidate.id === id ? { ...candidate, name: trimmedName } : candidate));
    notify({ tone: "info", message: `Profile renamed to “${trimmedName}”. Save to apply the change.` });
    return true;
  }

  function duplicateProfile(id: string) {
    const profile = profiles.find((candidate) => candidate.id === id);
    if (!profile) return false;
    const duplicate: WheelProfile = {
      id: newProfileId(),
      name: duplicateProfileName(profile.name, profiles),
      segments: cloneSegments(profile.segments),
    };
    setProfiles((current) => [...current, duplicate]);
    setEditingProfileId(duplicate.id);
    setSelectedId(duplicate.segments[0]?.id ?? "");
    setDraggedId("");
    setIconPickerOpen(false);
    setIconQuery("");
    setView("actions");
    notify({ tone: "info", message: `“${duplicate.name}” created from “${profile.name}”. Save to make it the active wheel.` });
    return true;
  }

  function deleteProfile(id: string) {
    if (profiles.length <= 1) {
      notify({ tone: "error", message: "Keep at least one wheel profile." });
      return false;
    }
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index < 0) return false;
    const deletedProfile = profiles[index];
    const remainingProfiles = profiles.filter((profile) => profile.id !== id);
    setProfiles(remainingProfiles);
    if (editingProfileId === id) {
      const nextProfile = remainingProfiles[Math.min(index, remainingProfiles.length - 1)];
      setEditingProfileId(nextProfile.id);
      setSelectedId(nextProfile.segments[0]?.id ?? "");
      setDraggedId("");
      setIconPickerOpen(false);
      setIconQuery("");
      setView("actions");
    }
    notify({ tone: "info", message: `“${deletedProfile.name}” removed. Save to apply the change.` });
    return true;
  }

  function setCancelByCenter(enabled: boolean) {
    if (!enabled && !cancelWithEscape) {
      notify({ tone: "error", message: "Keep at least one wheel cancellation method enabled." });
      return;
    }
    setCancelByCenterState(enabled);
  }

  function setCancelWithEscape(enabled: boolean) {
    if (!enabled && !cancelByCenter) {
      notify({ tone: "error", message: "Keep at least one wheel cancellation method enabled." });
      return;
    }
    setCancelWithEscapeState(enabled);
  }

  function currentConfig(): AppConfig {
    return {
      schema_version: 2,
      active_profile_id: editingProfileId,
      profiles,
      shortcut,
      launch_at_login: launchAtLogin,
      show_in_tray: showInTray,
      spawn_at_cursor: spawnAtCursor,
      cancel_by_center: cancelByCenter,
      cancel_with_escape: cancelWithEscape,
      wheel_scale: wheelScale,
      wheel_opacity: wheelOpacity,
    };
  }

  function addAction() {
    if (segments.length >= MAX_SEGMENTS) {
      notify({ tone: "error", message: `A wheel can contain up to ${MAX_SEGMENTS} actions.` });
      return;
    }
    const segment = createSegment(nextAvailableQuickKey(segments));
    setSegments((current) => [...current, segment]);
    setSelectedId(segment.id);
    setView("actions");
    notify({ tone: "info", message: "New action added." });
  }

  function addFolder() {
    if (segments.length >= MAX_SEGMENTS) {
      notify({ tone: "error", message: `A wheel can contain up to ${MAX_SEGMENTS} items.` });
      return;
    }
    const folder = createFolder(nextAvailableQuickKey(segments));
    setSegments((current) => [...current, folder]);
    setSelectedId(folder.id);
    setView("actions");
    notify({ tone: "info", message: "New folder added." });
  }

  function addChild(folderId: string) {
    const folder = segments.find((segment) => segment.id === folderId);
    if (!folder || folder.action_type !== "folder") return;
    if (folder.children.length >= MAX_SUBMENU_ITEMS) {
      notify({ tone: "error", message: `A folder can contain up to ${MAX_SUBMENU_ITEMS} actions.` });
      return;
    }
    const child = createSegment(nextAvailableQuickKey(segments));
    setSegments((current) => current.map((segment) => segment.id === folderId ? { ...segment, children: [...segment.children, child] } : segment));
    setSelectedId(child.id);
    setIconPickerOpen(false);
    notify({ tone: "info", message: "Folder action added." });
  }

  function remove(id: string) {
    const location = findSegment(segments, id);
    if (!location) return;
    if (location.parent) {
      const children = location.parent.children.filter((child) => child.id !== id);
      setSegments((current) => current.map((segment) => segment.id === location.parent?.id ? { ...segment, children } : segment));
      if (selectedId === id) setSelectedId(children[Math.min(location.index, children.length - 1)]?.id || location.parent.id);
    } else {
      const next = segments.filter((segment) => segment.id !== id);
      setSegments(next);
      if (selectedId === id || location.segment.children.some((child) => child.id === selectedId)) setSelectedId(next[Math.min(location.index, next.length - 1)]?.id || "");
    }
    setIconPickerOpen(false);
  }

  function move(index: number, direction: -1 | 1) {
    setSegments((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveChild(folderId: string, index: number, direction: -1 | 1) {
    setSegments((current) => current.map((segment) => {
      if (segment.id !== folderId) return segment;
      const target = index + direction;
      if (target < 0 || target >= segment.children.length) return segment;
      const children = [...segment.children];
      [children[index], children[target]] = [children[target], children[index]];
      return { ...segment, children };
    }));
  }

  function drop(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setSegments((current) => {
      const from = current.findIndex((segment) => segment.id === draggedId);
      const to = current.findIndex((segment) => segment.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedId("");
  }

  async function save() {
    const invalidProfile = profiles.map((profile) => ({
      profile,
      conflicts: findQuickKeyConflicts(profile.segments),
    })).find((candidate) => candidate.conflicts.length > 0);
    if (invalidProfile) {
      const conflict = invalidProfile.conflicts[0];
      selectProfile(invalidProfile.profile.id);
      setSelectedId(conflict.segments[0].id);
      notify({ tone: "error", message: `Quick key “${conflict.key.toLocaleUpperCase()}” is assigned more than once in “${invalidProfile.profile.name}”. Choose unique quick keys before saving.` });
      return false;
    }
    setSaving(true);
    try {
      await commands.saveConfig(currentConfig());
      setActiveProfileId(editingProfileId);
      notify({ tone: "success", message: `Profiles saved. “${editingProfile?.name ?? "Default"}” is now active.` });
      return true;
    } catch (error) {
      notify({ tone: "error", message: `Could not save: ${String(error)}` });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function exportConfiguration() {
    try {
      const destination = await saveDialog({ title: "Export Arky configuration", defaultPath: "arky-config.json", filters: [{ name: "Arky configuration", extensions: ["json"] }] });
      if (!destination) return;
      setConfigTransfer("export");
      await commands.exportConfig(currentConfig(), destination);
      notify({ tone: "success", message: "Configuration backup exported." });
    } catch (error) {
      notify({ tone: "error", message: `Could not export the configuration: ${String(error)}` });
    } finally {
      setConfigTransfer(null);
    }
  }

  async function importConfiguration() {
    try {
      const source = await open({ title: "Import Arky configuration", multiple: false, directory: false, fileAccessMode: "scoped", filters: [{ name: "Arky configuration", extensions: ["json"] }] });
      if (typeof source !== "string") return;
      const accepted = await confirmDialog("Importing will replace all profiles and global settings. Continue?", { title: "Import Arky configuration", kind: "warning", okLabel: "Import", cancelLabel: "Cancel" });
      if (!accepted) return;
      setConfigTransfer("import");
      const config = await commands.importConfig(source);
      const loadedProfiles = normalizeProfiles(config.profiles);
      const loadedActiveId = loadedProfiles.some((profile) => profile.id === config.active_profile_id)
        ? config.active_profile_id
        : loadedProfiles[0]?.id ?? "";
      const loadedActive = loadedProfiles.find((profile) => profile.id === loadedActiveId);
      setProfiles(loadedProfiles);
      setEditingProfileId(loadedActiveId);
      setActiveProfileId(loadedActiveId);
      setShortcut(config.shortcut || defaultShortcut(platform));
      setLaunchAtLogin(config.launch_at_login ?? false);
      setShowInTray(config.show_in_tray ?? true);
      setSpawnAtCursor(config.spawn_at_cursor ?? true);
      setCancelByCenterState(config.cancel_by_center ?? true);
      setCancelWithEscapeState(config.cancel_with_escape ?? true);
      setWheelScale(config.wheel_scale ?? DEFAULT_WHEEL_SCALE);
      setWheelOpacity(config.wheel_opacity ?? DEFAULT_WHEEL_OPACITY);
      setSelectedId(loadedActive?.segments[0]?.id ?? "");
      setIconPickerOpen(false);
      setIconQuery("");
      notify({ tone: "success", message: "All profiles and settings were imported and applied." });
    } catch (error) {
      notify({ tone: "error", message: `Could not import the configuration: ${String(error)}` });
    } finally {
      setConfigTransfer(null);
    }
  }

  async function prepareApplication(targetId: string, path: string) {
    setPreparingPath(path);
    try {
      const app = await commands.prepareApplication(path);
      updateSegment(targetId, { payload: app.path, app_icon: app.icon_base64 });
      notify(app.icon_base64
        ? { tone: "success", message: "Application selected and its icon was cached." }
        : { tone: "info", message: `Application selected. Arky will use the fallback icon because extraction failed${app.icon_error ? `: ${app.icon_error}` : "."}` });
    } catch (error) {
      notify({ tone: "error", message: `Could not use that application: ${String(error)}` });
    } finally {
      setPreparingPath("");
    }
  }

  async function browseApplication() {
    const targetId = selectedId;
    if (!targetId) return;
    try {
      const selected = await open({
        title: platform === "macos" ? "Choose a macOS application" : "Choose a Windows application",
        multiple: false,
        directory: false,
        filters: platform === "macos" ? [{ name: "macOS applications", extensions: ["app"] }] : platform === "windows" ? [{ name: "Windows applications", extensions: ["exe"] }] : undefined,
      });
      if (typeof selected === "string") await prepareApplication(targetId, selected);
    } catch (error) {
      notify({ tone: "error", message: `Could not use that application: ${String(error)}` });
    }
  }

  return {
    profiles,
    editingProfileId,
    activeProfileId,
    selectProfile,
    createProfile,
    renameProfile,
    duplicateProfile,
    deleteProfile,
    segments,
    shortcut,
    setShortcut,
    launchAtLogin,
    setLaunchAtLogin,
    showInTray,
    setShowInTray,
    spawnAtCursor,
    setSpawnAtCursor,
    cancelByCenter,
    setCancelByCenter,
    cancelWithEscape,
    setCancelWithEscape,
    wheelScale,
    setWheelScale,
    wheelOpacity,
    setWheelOpacity,
    configTransfer,
    exportConfiguration,
    importConfiguration,
    platform,
    selectedId,
    selection,
    view,
    setView,
    saving,
    draggedId,
    setDraggedId,
    iconPickerOpen,
    setIconPickerOpen,
    iconQuery,
    setIconQuery,
    applications,
    appStatus,
    setAppStatus,
    appError,
    appQuery,
    setAppQuery,
    preparingPath,
    quickKeyError,
    select,
    updateSegment,
    addAction,
    addFolder,
    addChild,
    remove,
    move,
    moveChild,
    drop,
    save,
    prepareApplication,
    browseApplication,
  };
}

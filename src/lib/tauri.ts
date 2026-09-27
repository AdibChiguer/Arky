import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, ClipboardHistoryEntry, InstalledApplication, Platform, PreparedApplication, RunningAppState } from "../types/wheel";

export const commands = {
  getConfig: () => invoke<AppConfig>("get_config"),
  setActiveProfile: (profileId: string) => invoke<void>("set_active_profile", { profileId }),
  getPlatform: () => invoke<Platform>("get_platform"),
  saveConfig: (config: AppConfig) => invoke<void>("save_config", { config }),
  exportConfig: (config: AppConfig, path: string) => invoke<string>("export_config", { config, path }),
  importConfig: (path: string) => invoke<AppConfig>("import_config", { path }),
  listInstalledApplications: () => invoke<InstalledApplication[]>("list_installed_applications"),
  prepareApplication: (path: string) => invoke<PreparedApplication>("prepare_application", { path }),
  getRunningAppState: (path: string, includePreview: boolean) => invoke<RunningAppState>("get_running_app_state", { path, includePreview }),
  runAction: (actionType: string, payload: string) => invoke<void>("run_action", { actionType, payload }),
  getClipboardHistory: (query: string) => invoke<ClipboardHistoryEntry[]>("get_clipboard_history", { query }),
  copyClipboardHistoryEntry: (id: number) => invoke<void>("copy_clipboard_history_entry", { id }),
  hideClipboardHistoryPanel: () => invoke<void>("hide_clipboard_history_panel"),
  hideWheel: () => invoke<void>("hide_wheel"),
  focusRunningApp: (path: string, windowId: number | null) => invoke<void>("focus_running_app", { path, windowId }),
  launchNewAppInstance: (path: string) => invoke<void>("launch_new_app_instance", { path }),
};

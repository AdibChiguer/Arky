import type { LucideIcon } from "lucide-react";

export type WheelSegment = {
  id: string;
  label: string;
  icon: string;
  app_icon?: string | null;
  action_type: string;
  payload: string;
  quick_key: string;
  children: WheelSegment[];
};

export type WheelProfile = {
  id: string;
  name: string;
  segments: WheelSegment[];
};

export type AppConfig = {
  schema_version: 2;
  active_profile_id: string;
  profiles: WheelProfile[];
  shortcut: string;
  launch_at_login: boolean;
  show_in_tray: boolean;
  spawn_at_cursor: boolean;
  cancel_by_center: boolean;
  cancel_with_escape: boolean;
  wheel_scale: number;
  wheel_opacity: number;
};

export type Platform = "windows" | "macos" | "linux";
export type BuilderView = "actions" | "settings";

export type RadialSubmenuItem = {
  id: string;
  label: string;
  ariaLabel?: string;
  Icon: LucideIcon;
  imageSrc?: string | null;
  imageKind?: "icon" | "preview";
};

export type RadialSubmenuConfig = {
  items: RadialSubmenuItem[];
  activeIndex: number;
  ariaLabel: string;
};

export type WheelHubContent = {
  eyebrow: string;
  label: string;
  position: string;
  active: boolean;
};

export type InstalledApplication = {
  name: string;
  path: string;
  icon_base64: string | null;
};

export type PreparedApplication = {
  path: string;
  icon_base64: string | null;
  icon_error: string | null;
};

export type RunningWindowState = {
  window_id: number | null;
  window_title: string | null;
  preview_data: string | null;
  preview_error: string | null;
};

export type RunningAppState = {
  running: boolean;
  windows: RunningWindowState[];
};

export type ClipboardHistoryEntry =
  | {
      kind: "text";
      id: number;
      preview: string;
    }
  | {
      kind: "image";
      id: number;
      thumbnail_data: string;
      width: number;
      height: number;
    };

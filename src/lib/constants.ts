export const MAX_SEGMENTS = 8;
export const MAX_SUBMENU_ITEMS = 8;
export const MAX_PROFILE_NAME_LENGTH = 50;

export const DEFAULT_WHEEL_SCALE = 100;
export const MIN_WHEEL_SCALE = 70;
export const MAX_WHEEL_SCALE = 150;
export const DEFAULT_WHEEL_OPACITY = 58;
export const MIN_WHEEL_OPACITY = 20;
export const MAX_WHEEL_OPACITY = 100;

export const ACTION_TYPES = [
  { value: "launch_app", label: "Launch app" },
  { value: "open_url_or_file", label: "Open URL or file" },
  { value: "shell", label: "Run shell command" },
  { value: "snippet", label: "Copy text snippet" },
  // { value: "clipboard_history", label: "Clipboard history" },
  { value: "folder", label: "Folder" },
];

export const CHILD_ACTION_TYPES = ACTION_TYPES.filter(
  (action) => action.value !== "folder" && action.value !== "clipboard_history",
);

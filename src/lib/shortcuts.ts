import type { Platform } from "../types/wheel";

const SUPPORTED_SHORTCUT_CODES = new Set([
  "Backquote", "Backslash", "BracketLeft", "BracketRight", "Comma", "Equal", "Minus",
  "Period", "Quote", "Semicolon", "Slash", "Backspace", "Enter", "Space", "Tab",
  "Delete", "End", "Home", "Insert", "PageDown", "PageUp", "PrintScreen", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowUp",
]);

export const defaultShortcut = (platform: Platform) => platform === "macos" ? "Alt+Shift+Space" : "Ctrl+Shift+Space";

export function shortcutModifiers(event: KeyboardEvent) {
  const modifiers: string[] = [];
  if (event.metaKey) modifiers.push("Super");
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  return modifiers;
}

export const isModifierKey = (code: string) => [
  "AltLeft", "AltRight", "ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "ShiftLeft", "ShiftRight",
].includes(code);

export function isSupportedShortcutCode(code: string) {
  return /^Key[A-Z]$/.test(code) || /^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code)
    || /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code) || SUPPORTED_SHORTCUT_CODES.has(code);
}

export function displayShortcutPart(part: string, platform: Platform) {
  if (part === "Alt") return platform === "macos" ? "Option" : "Alt";
  if (part === "Super") return platform === "macos" ? "Command" : "Win";
  if (part === "Ctrl") return platform === "macos" ? "Control" : "Ctrl";
  if (part.startsWith("Key")) return part.slice(3);
  if (part.startsWith("Digit")) return part.slice(5);
  if (part.startsWith("Numpad")) return `Num ${part.slice(6)}`;
  if (part.startsWith("Arrow")) return part.slice(5);
  return part;
}

export const shortcutParts = (shortcut: string, platform: Platform) =>
  shortcut.split("+").filter(Boolean).map((part) => displayShortcutPart(part, platform));

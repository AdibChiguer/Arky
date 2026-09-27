import { useEffect, useState } from "react";
import { notify } from "../lib/notifications";
import { displayShortcutPart, isModifierKey, isSupportedShortcutCode, shortcutModifiers, shortcutParts } from "../lib/shortcuts";
import type { Platform } from "../types/wheel";

export function useShortcutRecorder(shortcut: string, setShortcut: (shortcut: string) => void, platform: Platform) {
  const [recording, setRecording] = useState(false);
  const [heldModifiers, setHeldModifiers] = useState<string[]>([]);

  useEffect(() => {
    if (!recording) return;
    function onKeyDown(event: KeyboardEvent) {
      event.preventDefault(); event.stopPropagation();
      if (event.code === "Escape") { setRecording(false); setHeldModifiers([]); notify({ tone: "info", message: "Shortcut recording cancelled." }); return; }
      const modifiers = shortcutModifiers(event); setHeldModifiers(modifiers);
      if (isModifierKey(event.code)) return;
      if (!isSupportedShortcutCode(event.code)) { notify({ tone: "error", message: "That key is not supported as a global shortcut." }); return; }
      if (modifiers.length === 0) { notify({ tone: "error", message: "Include at least one modifier key in the shortcut." }); return; }
      setShortcut([...modifiers, event.code].join("+")); setRecording(false); setHeldModifiers([]);
      notify({ tone: "info", message: "Shortcut captured. Save changes to activate it." });
    }
    const onKeyUp = (event: KeyboardEvent) => setHeldModifiers(shortcutModifiers(event));
    window.addEventListener("keydown", onKeyDown, true); window.addEventListener("keyup", onKeyUp, true);
    return () => { window.removeEventListener("keydown", onKeyDown, true); window.removeEventListener("keyup", onKeyUp, true); };
  }, [recording, setShortcut]);

  return {
    recording,
    parts: recording ? heldModifiers.map((part) => displayShortcutPart(part, platform)) : shortcutParts(shortcut, platform),
    start: () => { setRecording(true); setHeldModifiers([]); notify({ tone: "info", message: "Press the new shortcut now. Escape cancels." }); },
    stop: () => { setRecording(false); setHeldModifiers([]); },
  };
}

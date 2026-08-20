"use client";

import { useEffect } from "react";

export interface HotkeyOptions {
  /** Fire even when the event target is an input/textarea/contenteditable. */
  allowInEditable?: boolean;
  preventDefault?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function matchCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const wantsMod = parts.includes("mod");
  const wantsAlt = parts.includes("alt");
  const wantsShift = parts.includes("shift");
  const key = parts.find((p) => !["mod", "alt", "shift"].includes(p));

  if (!key) return false;
  if (wantsMod !== (event.metaKey || event.ctrlKey)) return false;
  if (wantsAlt !== event.altKey) return false;
  if (wantsShift !== event.shiftKey) return false;
  return event.key.toLowerCase() === key;
}

export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchCombo(event, combo)) return;
      if (!options.allowInEditable && isEditableTarget(event.target)) return;
      if (options.preventDefault ?? true) event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, handler, options.allowInEditable, options.preventDefault]);
}

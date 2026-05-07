"use client";

import { useEffect } from "react";

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
  category?: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // Allow Escape even in inputs
        if (e.key !== "Escape") return;
      }

      for (const s of shortcuts) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const altMatch = s.alt ? e.altKey : !e.altKey;
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          e.preventDefault();
          s.action();
          break;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

export function shortcutLabel(s: Shortcut): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push("Ctrl");
  if (s.alt) parts.push("Alt");
  if (s.shift) parts.push("Shift");
  parts.push(s.key.toUpperCase());
  return parts.join("+");
}

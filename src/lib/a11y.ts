"use client";

import { useEffect, useRef } from "react";

/** Traps Tab focus inside the given ref element. */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;

    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [active, ref]);
}

/** Returns focus to the given element on unmount. */
export function useReturnFocus(triggerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const trigger = triggerRef.current;
    return () => {
      trigger?.focus();
    };
  }, [triggerRef]);
}

/** Announce a message to screen readers via aria-live. */
export function useAnnounce() {
  const regionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement("div");
    div.setAttribute("aria-live", "polite");
    div.setAttribute("aria-atomic", "true");
    div.className = "sr-only";
    document.body.appendChild(div);
    regionRef.current = div;
    return () => { document.body.removeChild(div); };
  }, []);

  return (message: string) => {
    if (regionRef.current) {
      regionRef.current.textContent = "";
      requestAnimationFrame(() => {
        if (regionRef.current) regionRef.current.textContent = message;
      });
    }
  };
}

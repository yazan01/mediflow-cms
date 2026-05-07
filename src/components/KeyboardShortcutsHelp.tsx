"use client";

import { useEffect } from "react";
import { shortcutLabel, type Shortcut } from "@/lib/hooks/useKeyboardShortcuts";

interface Props {
  shortcuts: Shortcut[];
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  navigate: "التنقل",
  create: "إنشاء",
  search: "البحث",
  general: "عام",
};

export function KeyboardShortcutsHelp({ shortcuts, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const grouped: Record<string, Shortcut[]> = {};
  for (const s of shortcuts) {
    const cat = s.category ?? "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-[#1a1c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1960a3]">keyboard</span>
            اختصارات لوحة المفاتيح
          </h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-lg hover:bg-[#f0f4ff] transition-colors text-[#74777f]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-3">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={`${s.key}-${s.alt}-${s.ctrl}`} className="flex items-center justify-between">
                    <span className="text-sm text-[#1a1c1e]">{s.description}</span>
                    <kbd className="inline-flex items-center gap-1 rounded-lg border border-[#e3e2e6] bg-[#faf9fd] px-2 py-1 text-xs font-mono text-[#43474e] shadow-sm">
                      {shortcutLabel(s)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-[#faf9fd] border-t border-[#e3e2e6] text-center">
          <span className="text-xs text-[#74777f]">اضغط <kbd className="rounded border border-[#e3e2e6] px-1 font-mono text-[10px]">Esc</kbd> للإغلاق</span>
        </div>
      </div>
    </div>
  );
}

interface HintProps {
  shortcut: Shortcut;
}

export function KeyboardShortcutHint({ shortcut }: HintProps) {
  return (
    <kbd
      title={`اختصار: ${shortcutLabel(shortcut)}`}
      className="hidden md:inline-flex ms-1.5 items-center rounded border border-[#e3e2e6] bg-[#faf9fd] px-1.5 py-0.5 text-[10px] font-mono text-[#74777f]"
    >
      {shortcutLabel(shortcut)}
    </kbd>
  );
}

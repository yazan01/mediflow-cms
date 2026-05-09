"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface SearchResult {
  type: "patient" | "appointment" | "invoice" | "medication" | "employee";
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

const TYPE_ICONS: Record<string, string> = {
  patient: "person",
  appointment: "calendar_month",
  invoice: "receipt_long",
  medication: "medication",
  employee: "badge",
};

const HISTORY_KEY = "mediflow_search_history";

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]").slice(0, 5);
  } catch {
    return [];
  }
}

function saveHistory(q: string) {
  try {
    const prev = getHistory().filter((h) => h !== q);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, 5)));
  } catch { /* ignore */ }
}

interface Props {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [history] = useState(getHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const typeLabels: Record<string, string> = {
    patient: t.common.patientSingular,
    appointment: t.common.appointmentSingular,
    invoice: t.common.invoiceSingular,
    medication: t.pharmacy.medication,
    employee: t.common.employeeSingular,
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=12`)
      .then((r) => r.ok ? r.json() : { results: [] })
      .then((d) => {
        setResults(d.results ?? []);
        setActive(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const navigate = useCallback((url: string, q: string) => {
    saveHistory(q);
    onClose();
    router.push(url);
  }, [router, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = results.length ? results : [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      navigate(items[active].url, query);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  const flatItems = results;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.common.searchLabel}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <span className="material-symbols-outlined text-[var(--txt2)] text-xl flex-shrink-0">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.common.searchSystemPlaceholder}
            className="flex-1 text-[var(--txt1)] placeholder-[#74777f] bg-transparent outline-none text-sm"
            aria-label={t.common.searchLabel}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
          />
          {loading && (
            <span className="animate-spin material-symbols-outlined text-[var(--txt2)] text-lg">progress_activity</span>
          )}
          <button onClick={onClose} aria-label={t.common.closeSearch} className="text-[var(--txt2)] hover:text-[var(--txt1)]">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto" role="listbox">
          {!query && history.length > 0 && (
            <div className="p-4">
              <p className="text-xs text-[var(--txt2)] font-medium mb-2">{t.common.recentSearches}</p>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    onClick={() => setQuery(h)}
                    className="flex items-center gap-1.5 text-xs text-[var(--txt2)] bg-[#f0f4ff] rounded-full px-3 py-1.5 hover:bg-[#dbeafe] transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">history</span>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div className="p-8 text-center text-[var(--txt2)]">
              <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
              <p className="text-sm">{t.common.noResultsFor} &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div className="px-4 py-2 bg-[#faf9fd] border-b border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--txt2)] uppercase tracking-wide">
                  {typeLabels[type] ?? type}
                </span>
              </div>
              {items.map((r) => {
                const idx = flatItems.indexOf(r);
                return (
                  <button
                    key={r.id}
                    role="option"
                    aria-selected={idx === active}
                    onClick={() => navigate(r.url, query)}
                    onMouseEnter={() => setActive(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${
                      idx === active ? "bg-[#f0f4ff]" : "hover:bg-[#faf9fd]"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-xl flex-shrink-0 ${
                      idx === active ? "text-[var(--blue)]" : "text-[var(--txt2)]"
                    }`}>
                      {TYPE_ICONS[r.type] ?? "article"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--txt1)] truncate">{r.title}</p>
                      <p className="text-xs text-[var(--txt2)] truncate">{r.subtitle}</p>
                    </div>
                    <span className="material-symbols-outlined text-sm text-[var(--txt2)]">arrow_forward</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 bg-[#faf9fd] border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--txt2)]">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--border)] px-1 font-mono">↑↓</kbd> {t.common.kbNavigate}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--border)] px-1 font-mono">Enter</kbd> {t.common.kbSelect}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--border)] px-1 font-mono">Esc</kbd> {t.common.kbClose}
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { searchICD10, type ICD10Code } from "@/lib/icd10";

interface Props {
  value: string;
  onChange: (code: string, description: string) => void;
  inputClassName?: string;
  placeholder?: string;
}

export default function ICD10Search({ value, onChange, inputClassName, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ICD10Code[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    const found = searchICD10(q);
    setResults(found);
    setOpen(found.length > 0);
    setHighlighted(0);
    if (!q.trim()) onChange("", "");
  }

  function select(item: ICD10Code) {
    setQuery(item.code);
    setOpen(false);
    onChange(item.code, item.description);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && results[highlighted]) { e.preventDefault(); select(results[highlighted]); }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Code or description (e.g. J06.9 or 'cold')"}
        className={inputClassName}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-[#e3e2e6] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map((item, i) => (
            <li
              key={item.code}
              onMouseDown={() => select(item)}
              className={`px-3 py-2.5 cursor-pointer flex items-start gap-3 border-b border-[#f4f3f7] last:border-b-0 ${
                i === highlighted ? "bg-[#eff6ff]" : "hover:bg-[#f4f3f7]"
              }`}
            >
              <span className="text-xs font-bold font-mono text-[#1960a3] bg-[#d3e4ff] px-2 py-0.5 rounded mt-0.5 flex-shrink-0 min-w-[56px] text-center">
                {item.code}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1a1c1e] leading-snug">{item.description}</p>
                <p className="text-[10px] text-[#74777f] mt-0.5">{item.category}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

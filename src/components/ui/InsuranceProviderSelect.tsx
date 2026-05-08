"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Provider {
  id: string;
  name: string;
  isActive: boolean;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  inputClassName?: string;
  required?: boolean;
}

export function InsuranceProviderSelect({
  value,
  onChange,
  className = "input-field",
  inputClassName,
  required = false,
}: Props) {
  const { t } = useLanguage();
  const s = t.settings;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/insurance-providers?active_only=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Provider[]) => {
        setProviders(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const isKnownProvider = providers.some((p) => p.name === value);
  const selectVal = !loaded ? "" : value === "" ? "" : isKnownProvider ? value : "__other__";
  const showTextInput = loaded && value !== "" && !isKnownProvider;

  return (
    <div className="space-y-2">
      <select
        className={className}
        value={selectVal}
        required={required && !showTextInput}
        disabled={!loaded}
        onChange={(e) => {
          if (e.target.value === "__other__") {
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{loaded ? s.selectProvider : t.common.loading}</option>
        {providers.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
        {loaded && <option value="__other__">{s.otherProvider}</option>}
      </select>

      {showTextInput && (
        <input
          type="text"
          className={inputClassName ?? className}
          required={required}
          value={value}
          placeholder="e.g. CIGNA, AXA, BUPA"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

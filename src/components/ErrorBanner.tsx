"use client";

import type { FetchError } from "@/lib/hooks/useDataFetch";

interface Props {
  error: FetchError;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: Props) {
  const isNetwork = error.type === "network";
  const status = error.type === "api" ? error.status : undefined;
  const icon = isNetwork ? "wifi_off" : status === 403 ? "lock" : "error_outline";
  const color = status === 403 ? "text-[#d97706]" : "text-[#ba1a1a]";
  const bg = status === 403 ? "bg-[#fff7ed] border-[#d97706]/20" : "bg-[#ffdad6]/40 border-[#ba1a1a]/20";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg} mb-4`} role="alert">
      <span className={`material-symbols-outlined text-[20px] ${color} flex-shrink-0`} aria-hidden="true">{icon}</span>
      <p className={`text-sm font-medium ${color} flex-1`}>{error.message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-[#1960a3] hover:underline flex-shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}

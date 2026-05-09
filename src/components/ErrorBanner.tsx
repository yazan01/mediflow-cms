"use client";

import type { FetchError } from "@/lib/hooks/useDataFetch";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type AnyError = FetchError | Error;

interface Props {
  error: AnyError;
  onRetry?: () => void;
}

function toFetchError(error: AnyError): FetchError {
  if ("type" in error) return error as FetchError;
  const status = (error as Error & { status?: number }).status;
  if (status) return { type: "api", status, message: error.message };
  return { type: "network", message: error.message || "Unable to connect. Check your network." };
}

export function ErrorBanner({ error, onRetry }: Props) {
  const { t } = useLanguage();
  const fe = toFetchError(error);
  const isNetwork = fe.type === "network";
  const status = fe.type === "api" ? fe.status : undefined;
  const icon = isNetwork ? "wifi_off" : status === 403 ? "lock" : "error_outline";
  const color = status === 403 ? "text-[var(--warn)]" : "text-[var(--err)]";
  const bg = status === 403 ? "bg-[var(--warn-bg)] border-[#d97706]/20" : "bg-[var(--err-bg)]/40 border-[#ba1a1a]/20";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg} mb-4`} role="alert">
      <span className={`material-symbols-outlined text-[20px] ${color} flex-shrink-0`} aria-hidden="true">{icon}</span>
      <p className={`text-sm font-medium ${color} flex-1`}>{fe.message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-[var(--blue)] hover:underline flex-shrink-0"
        >
          {t.common.retry}
        </button>
      )}
    </div>
  );
}

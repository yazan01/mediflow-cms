"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ErrorBanner } from "@/components/ErrorBanner";

const MODULE_COLORS: Record<string, string> = {
  AUTH: "bg-[var(--blue-bg)] text-[#00477f]",
  PATIENTS: "bg-[var(--ok-bg)] text-[var(--ok)]",
  APPOINTMENTS: "bg-[#ffddba] text-[#633f0f]",
  EMR: "bg-[var(--blue-bg)] text-[var(--blue)]",
  BILLING: "bg-[#d6e3ff] text-[#002045]",
  PHARMACY: "bg-[#fdf4ff] text-[#9333ea]",
  HR: "bg-[#f0fdf4] text-[#16a34a]",
  ACCOUNTING: "bg-[#fffbeb] text-[var(--warn)]",
  USERS: "bg-[#e9e7eb] text-[var(--txt2)]",
};

const MODULES = ["ALL", "AUTH", "PATIENTS", "APPOINTMENTS", "EMR", "BILLING", "PHARMACY", "HR", "ACCOUNTING", "USERS"];

function getEntityLink(module: string, entityType: string | undefined, entityId: string | undefined): string | null {
  if (!entityId) return null;
  if (module === "PATIENTS" || entityType === "Patient") return `/patients/${entityId}`;
  if (module === "APPOINTMENTS" || entityType === "Appointment") return `/appointments/${entityId}`;
  if (module === "BILLING" || entityType === "Invoice") return `/billing/${entityId}`;
  if (module === "EMR" || entityType === "Consultation") return `/emr/${entityId}`;
  if (module === "HR" || entityType === "Employee") return `/hr`;
  if (module === "USERS" || entityType === "User") return `/users`;
  if (module === "PHARMACY") return `/pharmacy`;
  if (module === "ACCOUNTING") return `/accounting`;
  return null;
}

export default function AuditPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(moduleFilter !== "ALL" && { module: moduleFilter }),
        ...(actionFilter !== "ALL" && { action: actionFilter }),
      });
      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      setLogs(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setFetchError(err as Error);
    }
    finally { setLoading(false); }
  }, [page, debouncedSearch, moduleFilter, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--txt1)]">{t.audit.title}</h1>
          <p className="text-sm text-[var(--txt2)] mt-0.5">{t.audit.subtitle}</p>
        </div>
        <button className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--surface2)] transition-colors">
          <span className="material-symbols-outlined text-[18px]">download</span>
          {t.audit.export}
        </button>
      </div>

      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchLogs} />}

      <div className="bg-[#fffbeb] border border-[#d97706]/20 rounded-xl p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-[var(--warn)] text-[20px]">lock</span>
        <p className="text-sm text-[var(--txt1)]">{t.audit.immutableNotice}</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--txt2)] text-[18px]">search</span>
          <input
            className="w-full bg-[var(--surface2)] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            placeholder={t.audit.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
          className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
        >
          {MODULES.map((m) => <option key={m} value={m}>{m === "ALL" ? t.audit.allModules : m}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
        >
          <option value="ALL">{t.audit.allActions}</option>
          <option value="CREATE">{t.audit.actionCreate}</option>
          <option value="UPDATE">{t.audit.actionUpdate}</option>
          <option value="DELETE">{t.audit.actionDelete}</option>
          <option value="LOGIN">{t.audit.actionLogin}</option>
          <option value="LOGOUT">{t.audit.actionLogout}</option>
        </select>
      </div>

      {total > 0 && (
        <p className="text-xs text-[var(--txt2)]">{t.audit.showing} {total} {t.audit.totalEntries}</p>
      )}

      <div className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[t.audit.timestamp, t.audit.user, t.audit.module, t.audit.action, t.audit.entity, t.audit.ipAddress].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3.5 bg-[var(--surface2)] border-b border-[var(--border)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                    <p className="text-sm text-[var(--txt2)]">{t.audit.loading}</p>
                  </div>
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">policy</span>
                    <p className="text-sm font-semibold text-[var(--txt1)]">{t.audit.noLogs}</p>
                    <p className="text-xs text-[var(--txt2)]">{t.audit.noLogsDesc}</p>
                  </div>
                </td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-5 py-3.5 border-b border-[var(--border)]">
                      <p className="text-xs font-mono text-[var(--txt2)] whitespace-nowrap">{formatDateTime(log.timestamp)}</p>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--border)]">
                      <p className="text-sm font-semibold text-[var(--txt1)]">{log.userName}</p>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--border)]">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${MODULE_COLORS[log.module] ?? "bg-[#e9e7eb] text-[var(--txt2)]"}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--border)]">
                      <p className="text-sm text-[var(--txt1)]">{log.action}</p>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--border)]">
                      {log.entityType && log.entityId ? (() => {
                        const link = getEntityLink(log.module, log.entityType, log.entityId);
                        return link ? (
                          <button
                            onClick={() => router.push(link)}
                            className="text-xs font-semibold text-[var(--blue)] hover:underline text-start"
                          >
                            {log.entityType} #{log.entityId.slice(0, 8)}
                          </button>
                        ) : (
                          <p className="text-xs text-[var(--txt2)]">{log.entityType} #{log.entityId.slice(0, 8)}</p>
                        );
                      })() : (
                        <p className="text-xs text-[var(--txt2)]">—</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--border)]">
                      <p className="text-xs font-mono text-[var(--txt2)]">{log.ipAddress ?? "—"}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / pageSize) > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-xs text-[var(--txt2)]">{t.audit.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} {t.common.of} {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
              <button onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page === Math.ceil(total / pageSize)} className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

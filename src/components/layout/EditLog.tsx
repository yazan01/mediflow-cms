"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  ipAddress: string;
}

function timeAgo(iso: string, t: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string }): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return t.justNow;
  if (diff < 3600) return t.minutesAgo.replace("{n}", String(Math.floor(diff / 60)));
  if (diff < 86400) return t.hoursAgo.replace("{n}", String(Math.floor(diff / 3600)));
  return t.daysAgo.replace("{n}", String(Math.floor(diff / 86400)));
}

export default function EditLog({ entityId }: { entityId: string }) {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    fetch(`/api/audit?entityId=${entityId}&page=${page}&pageSize=${pageSize}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.data || []);
        setTotal(d.total || 0);
      })
      .finally(() => setLoading(false));
  }, [entityId, page]);

  const timeKeys = {
    justNow: t.topbar.justNow,
    minutesAgo: t.topbar.minutesAgo,
    hoursAgo: t.topbar.hoursAgo,
    daysAgo: t.topbar.daysAgo,
  };

  const actionColor: Record<string, string> = {
    CREATE: "bg-[#ccfbf1] text-[#0d9488]",
    UPDATE: "bg-[#d3e4ff] text-[#1960a3]",
    DELETE: "bg-[#ffdad6] text-[#ba1a1a]",
    LOGIN: "bg-[#fff7ed] text-[#d97706]",
  };

  const getActionColor = (action: string) => {
    const key = Object.keys(actionColor).find((k) => action.toUpperCase().startsWith(k));
    return key ? actionColor[key] : "bg-[#f2f0f4] text-[#74777f]";
  };

  return (
    <div className="card mt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-[#1960a3]">history</span>
        <div>
          <h3 className="font-semibold text-[#1a1c1e]">{t.audit.editLog}</h3>
          <p className="text-xs text-[#74777f]">{t.audit.editLogDesc}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-[#74777f]">
          <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
          <span className="text-sm">{t.audit.loading}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-[#74777f]">
          <span className="material-symbols-outlined text-3xl">manage_history</span>
          <p className="text-sm">{t.audit.noEditHistory}</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="absolute start-4 top-0 bottom-0 w-px bg-[#e3e2e6]" />
            <ul className="space-y-0">
              {logs.map((log, i) => (
                <li key={log.id} className="relative flex gap-4 ps-10 pb-5">
                  <div className="absolute start-2.5 top-1 w-3 h-3 rounded-full border-2 border-[#1960a3] bg-white" />
                  <div className="flex-1 min-w-0 bg-[#f8f9ff] rounded-lg p-3 border border-[#e3e2e6]">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-[#74777f]">
                        {t.audit.by} <span className="font-medium text-[#1a1c1e]">{log.userName || "—"}</span>
                      </span>
                      <span className="text-xs text-[#74777f] ms-auto">
                        {timeAgo(log.timestamp, timeKeys)}
                      </span>
                    </div>
                    <p className="text-xs text-[#74777f]">
                      {new Date(log.timestamp).toLocaleString()} · {log.module}
                      {log.ipAddress && ` · ${log.ipAddress}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {total > pageSize && (
            <div className="flex items-center justify-between pt-2 border-t border-[#e3e2e6] mt-2">
              <span className="text-xs text-[#74777f]">
                {t.audit.showing} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= total}
                  className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

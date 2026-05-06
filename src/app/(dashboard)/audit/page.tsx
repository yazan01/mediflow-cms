"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog } from "@/types";

const MODULE_COLORS: Record<string, string> = {
  AUTH: "bg-[#d3e4ff] text-[#00477f]",
  PATIENTS: "bg-[#ccfbf1] text-[#0d9488]",
  APPOINTMENTS: "bg-[#ffddba] text-[#633f0f]",
  EMR: "bg-[#dbeafe] text-[#1960a3]",
  BILLING: "bg-[#d6e3ff] text-[#002045]",
  PHARMACY: "bg-[#fdf4ff] text-[#9333ea]",
  HR: "bg-[#f0fdf4] text-[#16a34a]",
  ACCOUNTING: "bg-[#fffbeb] text-[#d97706]",
  USERS: "bg-[#e9e7eb] text-[#43474e]",
};

const MODULES = ["ALL", "AUTH", "PATIENTS", "APPOINTMENTS", "EMR", "BILLING", "PHARMACY", "HR", "ACCOUNTING", "USERS"];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(search && { search }),
        ...(moduleFilter !== "ALL" && { module: moduleFilter }),
      });
      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) { const data = await res.json(); setLogs(data.data ?? []); setTotal(data.total ?? 0); }
    } catch { /* network */ }
    finally { setLoading(false); }
  }, [page, search, moduleFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Audit Logs</h1>
          <p className="text-sm text-[#74777f] mt-0.5">Immutable record of all system actions — {total} total entries</p>
        </div>
        <button className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export Logs
        </button>
      </div>

      <div className="bg-[#fffbeb] border border-[#d97706]/20 rounded-xl p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-[#d97706] text-[20px]">lock</span>
        <p className="text-sm text-[#1a1c1e]">Audit logs are <strong>immutable</strong> — no user can modify or delete entries. Every data change is recorded with user ID, timestamp, and old/new values.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
          <input className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20" placeholder="Search by user or action..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
          {MODULES.map((m) => <option key={m} value={m}>{m === "ALL" ? "All Modules" : m}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {["Timestamp", "User", "Module", "Action", "Entity", "IP Address"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                    <p className="text-sm text-[#74777f]">Loading audit logs...</p>
                  </div>
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">policy</span>
                    <p className="text-sm font-semibold text-[#1a1c1e]">No audit logs found</p>
                    <p className="text-xs text-[#74777f]">Logs will appear as users interact with the system</p>
                  </div>
                </td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#f4f3f7] transition-colors">
                    <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                      <p className="text-xs font-mono text-[#43474e] whitespace-nowrap">{formatDateTime(log.timestamp)}</p>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                      <p className="text-sm font-semibold text-[#1a1c1e]">{log.userName}</p>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${MODULE_COLORS[log.module] ?? "bg-[#e9e7eb] text-[#43474e]"}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                      <p className="text-sm text-[#1a1c1e]">{log.action}</p>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                      <p className="text-xs text-[#74777f]">{log.entityType ? `${log.entityType} #${log.entityId?.slice(0, 8)}` : "—"}</p>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                      <p className="text-xs font-mono text-[#74777f]">{log.ipAddress ?? "—"}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / pageSize) > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e3e2e6] bg-[#faf9fd]">
            <p className="text-xs text-[#74777f]">Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total} entries</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
              <button onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page === Math.ceil(total / pageSize)} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

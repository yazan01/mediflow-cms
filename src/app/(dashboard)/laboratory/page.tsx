"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDateTime } from "@/lib/utils";
import type { LabOrder } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function LaboratoryPage() {
  const { t } = useLanguage();

  const STATUS_STYLES = {
    PENDING_COLLECTION: { label: t.laboratory.pendingCollection, bg: "bg-[#e9e7eb]",   text: "text-[#43474e]" },
    IN_PROGRESS:        { label: t.laboratory.inProgressStatus,  bg: "bg-[#d3e4ff]",   text: "text-[#00477f]" },
    RESULTS_READY:      { label: t.laboratory.resultsReadyStatus,bg: "bg-[#ccfbf1]",   text: "text-[#0d9488]" },
    RESULTS_RELEASED:   { label: t.laboratory.released,          bg: "bg-[#d6e3ff]",   text: "text-[#002045]" },
    CANCELLED:          { label: t.laboratory.cancelledStatus,   bg: "bg-[#ffdad6]",   text: "text-[#ba1a1a]" },
  };

  const PRIORITY_STYLES = {
    ROUTINE: { label: t.laboratory.routine, bg: "bg-[#f4f3f7]", text: "text-[#74777f]" },
    URGENT:  { label: t.laboratory.urgent,  bg: "bg-[#ffddba]", text: "text-[#633f0f]" },
    STAT:    { label: t.laboratory.stat,    bg: "bg-[#ba1a1a]", text: "text-white" },
  };

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(search && { search }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
        ...(priorityFilter !== "ALL" && { priority: priorityFilter }),
      });
      const res = await fetch(`/api/laboratory?${params}`);
      if (res.ok) { const data = await res.json(); setOrders(data.data ?? []); setTotal(data.total ?? 0); }
    } catch { /* network */ }
    finally { setLoading(false); }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const stats = {
    total: total,
    pending: orders.filter((o) => o.status === "PENDING_COLLECTION").length,
    inProgress: orders.filter((o) => o.status === "IN_PROGRESS").length,
    ready: orders.filter((o) => o.status === "RESULTS_READY").length,
    stat: orders.filter((o) => o.priority === "STAT").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.laboratory.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.laboratory.subtitle}</p>
        </div>
        <button className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t.laboratory.newOrder}
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: t.laboratory.totalOrders,   value: stats.total,      icon: "biotech",       color: "text-[#1960a3]", bg: "bg-[#d3e4ff]" },
          { label: t.laboratory.pending,        value: stats.pending,    icon: "pending",       color: "text-[#74777f]", bg: "bg-[#f4f3f7]" },
          { label: t.laboratory.inProgress,     value: stats.inProgress, icon: "hourglass",     color: "text-[#1960a3]", bg: "bg-[#d3e4ff]" },
          { label: t.laboratory.resultsReady,   value: stats.ready,      icon: "fact_check",    color: "text-[#0d9488]", bg: "bg-[#ccfbf1]" },
          { label: t.laboratory.statOrders,     value: stats.stat,       icon: "emergency",     color: "text-[#ba1a1a]", bg: "bg-[#ffdad6]" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className={`p-2 ${s.bg} rounded-xl`}><span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span></div>
            <div>
              <p className="text-xl font-bold text-[#1a1c1e]">{s.value}</p>
              <p className="text-xs text-[#74777f]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
          <input className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20" placeholder={t.laboratory.searchPlaceholder} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
          <option value="ALL">{t.laboratory.allStatuses}</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
          <option value="ALL">{t.laboratory.allPriorities}</option>
          {Object.entries(PRIORITY_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[t.laboratory.orderId, t.laboratory.patient, t.laboratory.tests, t.laboratory.priority, t.laboratory.orderedBy, t.laboratory.date, t.laboratory.status, t.laboratory.actions].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                    <p className="text-sm text-[#74777f]">{t.laboratory.loading}</p>
                  </div>
                </td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#74777f] text-2xl">biotech</span>
                    </div>
                    <p className="text-sm font-semibold text-[#1a1c1e]">{t.laboratory.noOrders}</p>
                    <p className="text-xs text-[#74777f]">{search ? t.laboratory.trySearch : t.laboratory.noOrdersDesc}</p>
                  </div>
                </td></tr>
              ) : (
                orders.map((order) => {
                  const st = STATUS_STYLES[order.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.PENDING_COLLECTION;
                  const pr = PRIORITY_STYLES[order.priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.ROUTINE;
                  return (
                    <tr key={order.id} className="hover:bg-[#f4f3f7] transition-colors group">
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <span className="text-xs font-mono font-semibold text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded">{order.id.slice(0, 8).toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <p className="text-sm font-semibold text-[#1a1c1e]">{order.patientName}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {order.tests.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-[10px] font-semibold bg-[#d3e4ff] text-[#00477f] px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                          {order.tests.length > 3 && <span className="text-[10px] text-[#74777f] font-semibold">+{order.tests.length - 3} more</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pr.bg} ${pr.text}`}>{pr.label}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <p className="text-sm text-[#43474e]">{order.orderedBy}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <p className="text-xs text-[#74777f]">{order.date ? formatDateTime(order.date) : "—"}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <div className="flex items-center gap-1">
                          <button title={t.laboratory.enterResults} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg text-[#74777f] hover:text-[#1960a3] transition-colors"><span className="material-symbols-outlined text-[18px]">edit_note</span></button>
                          <button title={t.laboratory.printOrder} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg text-[#74777f] hover:text-[#1960a3] transition-colors"><span className="material-symbols-outlined text-[18px]">print</span></button>
                          <button title={t.laboratory.cancel} className="p-1.5 hover:bg-[#ffdad6] rounded-lg text-[#74777f] hover:text-[#ba1a1a] transition-colors"><span className="material-symbols-outlined text-[18px]">cancel</span></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / pageSize) > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e3e2e6] bg-[#faf9fd]">
            <p className="text-xs text-[#74777f]">{t.laboratory.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}</p>
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

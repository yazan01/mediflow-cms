"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, printDocument } from "@/lib/utils";
import type { LabOrder } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ErrorBanner } from "@/components/ErrorBanner";

interface LabResultInput {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  isCritical: boolean;
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 end-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${type === "success" ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--err-bg)] text-[var(--err)]"}`}>
      <span className="material-symbols-outlined text-[18px]">{type === "success" ? "check_circle" : "error"}</span>
      {message}
      <button onClick={onClose} className="ms-1 opacity-70 hover:opacity-100"><span className="material-symbols-outlined text-[16px]">close</span></button>
    </div>
  );
}

export default function LaboratoryPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const STATUS_STYLES = {
    PENDING_COLLECTION: { label: t.laboratory.pendingCollection, bg: "bg-[#e9e7eb]",   text: "text-[var(--txt2)]" },
    IN_PROGRESS:        { label: t.laboratory.inProgressStatus,  bg: "bg-[var(--blue-bg)]",   text: "text-[#00477f]" },
    RESULTS_READY:      { label: t.laboratory.resultsReadyStatus,bg: "bg-[var(--ok-bg)]",   text: "text-[var(--ok)]" },
    RESULTS_RELEASED:   { label: t.laboratory.released,          bg: "bg-[#d6e3ff]",   text: "text-[#002045]" },
    CANCELLED:          { label: t.laboratory.cancelledStatus,   bg: "bg-[var(--err-bg)]",   text: "text-[var(--err)]" },
  };

  const PRIORITY_STYLES = {
    ROUTINE: { label: t.laboratory.routine, bg: "bg-[var(--surface2)]", text: "text-[var(--txt2)]" },
    URGENT:  { label: t.laboratory.urgent,  bg: "bg-[#ffddba]", text: "text-[#633f0f]" },
    STAT:    { label: t.laboratory.stat,    bg: "bg-[var(--err)]", text: "text-white" },
  };

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Action state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [resultsModal, setResultsModal] = useState<LabOrder | null>(null);
  const [resultRows, setResultRows] = useState<LabResultInput[]>([{ testName: "", value: "", unit: "", referenceRange: "", isAbnormal: false, isCritical: false }]);
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchOrders = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
        ...(priorityFilter !== "ALL" && { priority: priorityFilter }),
      });
      const res = await fetch(`/api/laboratory?${params}`, { signal: abortRef.current.signal });
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      setOrders(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setFetchError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, priorityFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleStatusUpdate(orderId: string, status: string) {
    try {
      const res = await fetch(`/api/laboratory/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setToast({ message: t.laboratory.statusUpdated, type: "success" });
      fetchOrders();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    }
  }

  async function handleCancelOrder() {
    if (!confirmCancel) return;
    await handleStatusUpdate(confirmCancel, "CANCELLED");
    setConfirmCancel(null);
  }

  function openResultsModal(order: LabOrder) {
    const existing = (order.results ?? []) as LabResultInput[];
    setResultRows(
      existing.length > 0
        ? existing
        : [{ testName: "", value: "", unit: "", referenceRange: "", isAbnormal: false, isCritical: false }]
    );
    setResultsModal(order);
  }

  async function saveResults() {
    if (!resultsModal) return;
    const valid = resultRows.filter((r) => r.testName.trim() && r.value.trim());
    if (valid.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/laboratory/${resultsModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: valid, status: "RESULTS_READY" }),
      });
      if (!res.ok) throw new Error();
      setToast({ message: t.laboratory.resultsEntered, type: "success" });
      setResultsModal(null);
      fetchOrders();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setSaving(false);
    }
  }

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
          <h1 className="text-2xl font-bold text-[var(--txt1)]">{t.laboratory.title}</h1>
          <p className="text-sm text-[var(--txt2)] mt-0.5">{t.laboratory.subtitle}</p>
        </div>
        <button className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t.laboratory.newOrder}
        </button>
      </div>

      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchOrders} />}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: t.laboratory.totalOrders,   value: stats.total,      icon: "biotech",       color: "text-[var(--blue)]", bg: "bg-[var(--blue-bg)]" },
          { label: t.laboratory.pending,        value: stats.pending,    icon: "pending",       color: "text-[var(--txt2)]", bg: "bg-[var(--surface2)]" },
          { label: t.laboratory.inProgress,     value: stats.inProgress, icon: "hourglass",     color: "text-[var(--blue)]", bg: "bg-[var(--blue-bg)]" },
          { label: t.laboratory.resultsReady,   value: stats.ready,      icon: "fact_check",    color: "text-[var(--ok)]", bg: "bg-[var(--ok-bg)]" },
          { label: t.laboratory.statOrders,     value: stats.stat,       icon: "emergency",     color: "text-[var(--err)]", bg: "bg-[var(--err-bg)]" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[var(--border)] p-4 flex items-center gap-3 shadow-[var(--sh-sm)]">
            <div className={`p-2 ${s.bg} rounded-xl`}><span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span></div>
            <div>
              <p className="text-xl font-bold text-[var(--txt1)]">{s.value}</p>
              <p className="text-xs text-[var(--txt2)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--txt2)] text-[18px]">search</span>
          <input className="w-full bg-[var(--surface2)] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20" placeholder={t.laboratory.searchPlaceholder} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
          <option value="ALL">{t.laboratory.allStatuses}</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
          <option value="ALL">{t.laboratory.allPriorities}</option>
          {Object.entries(PRIORITY_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[t.laboratory.orderId, t.laboratory.patient, t.laboratory.tests, t.laboratory.priority, t.laboratory.orderedBy, t.laboratory.date, t.laboratory.status, t.laboratory.actions].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3.5 bg-[var(--surface2)] border-b border-[var(--border)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                    <p className="text-sm text-[var(--txt2)]">{t.laboratory.loading}</p>
                  </div>
                </td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[var(--txt2)] text-2xl">biotech</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--txt1)]">{t.laboratory.noOrders}</p>
                    <p className="text-xs text-[var(--txt2)]">{search ? t.laboratory.trySearch : t.laboratory.noOrdersDesc}</p>
                  </div>
                </td></tr>
              ) : (
                orders.map((order) => {
                  const st = STATUS_STYLES[order.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.PENDING_COLLECTION;
                  const pr = PRIORITY_STYLES[order.priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.ROUTINE;
                  const isCancelled = order.status === "CANCELLED";
                  return (
                    <tr key={order.id} className="hover:bg-[var(--surface2)] transition-colors group">
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <span className="text-xs font-mono font-semibold text-[var(--txt2)] bg-[var(--surface2)] px-2 py-1 rounded">{order.id.slice(0, 8).toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <button
                          onClick={() => router.push(`/emr/${order.patientId}`)}
                          className="text-sm font-semibold text-[var(--blue)] hover:underline text-start"
                        >
                          {order.patientName}
                        </button>
                      </td>
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {order.tests.slice(0, 3).map((testName, i) => (
                            <span key={i} className="text-[10px] font-semibold bg-[var(--blue-bg)] text-[#00477f] px-2 py-0.5 rounded-full">{testName}</span>
                          ))}
                          {order.tests.length > 3 && <span className="text-[10px] text-[var(--txt2)] font-semibold">{t.common.nMoreItems.replace("{count}", String(order.tests.length - 3))}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pr.bg} ${pr.text}`}>{pr.label}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <p className="text-sm text-[var(--txt2)]">{order.orderedBy}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <p className="text-xs text-[var(--txt2)]">{order.date ? formatDateTime(order.date) : "—"}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[var(--border)]">
                        <div className="flex items-center gap-1">
                          {!isCancelled && order.status !== "RESULTS_RELEASED" && (
                            <button
                              aria-label={t.laboratory.enterResults}
                              title={t.laboratory.enterResults}
                              onClick={() => openResultsModal(order)}
                              className="p-1.5 hover:bg-[var(--blue-bg)] rounded-lg text-[var(--txt2)] hover:text-[var(--blue)] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit_note</span>
                            </button>
                          )}
                          <button
                            aria-label={t.laboratory.printOrder}
                            title={t.laboratory.printOrder}
                            onClick={() => printDocument(`/print/lab-order/${order.id}`)}
                            className="p-1.5 hover:bg-[var(--blue-bg)] rounded-lg text-[var(--txt2)] hover:text-[var(--blue)] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          {!isCancelled && (
                            <button
                              aria-label={t.laboratory.cancel}
                              title={t.laboratory.cancel}
                              onClick={() => setConfirmCancel(order.id)}
                              className="p-1.5 hover:bg-[var(--err-bg)] rounded-lg text-[var(--txt2)] hover:text-[var(--err)] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">cancel</span>
                            </button>
                          )}
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
          <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-xs text-[var(--txt2)]">{t.laboratory.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
              <button onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page === Math.ceil(total / pageSize)} className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <div role="dialog" aria-modal="true" aria-labelledby="cancel-lab-title" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-[var(--sh-xl)] max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--err-bg)] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[28px] text-[var(--err)]">cancel</span>
            </div>
            <h2 id="cancel-lab-title" className="text-base font-bold text-[var(--txt1)] mb-2">{t.laboratory.cancel}</h2>
            <p className="text-sm text-[var(--txt2)] mb-6">{t.laboratory.confirmCancelOrder}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)} className="btn-secondary flex-1">{t.common.cancel}</button>
              <button onClick={handleCancelOrder} className="flex-1 bg-[var(--err)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">{t.laboratory.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* Enter Results modal */}
      {resultsModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="results-title" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-[var(--sh-xl)] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 id="results-title" className="text-base font-bold text-[var(--txt1)]">{t.laboratory.enterResultsTitle}</h2>
              <button aria-label={t.common.close} onClick={() => setResultsModal(null)} className="p-1.5 hover:bg-[var(--surface2)] rounded-lg text-[var(--txt2)]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[var(--txt2)]">{resultsModal.patientName} · {resultsModal.tests.join(", ")}</p>
              {resultRows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 p-4 bg-[var(--surface2)] rounded-xl">
                  <input className="input-field col-span-2 sm:col-span-1" placeholder={t.laboratory.testName} value={row.testName} onChange={(e) => setResultRows((r) => r.map((x, j) => j === i ? { ...x, testName: e.target.value } : x))} />
                  <input className="input-field col-span-2 sm:col-span-1" placeholder={t.laboratory.value} value={row.value} onChange={(e) => setResultRows((r) => r.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                  <input className="input-field" placeholder={t.laboratory.unit} value={row.unit} onChange={(e) => setResultRows((r) => r.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
                  <input className="input-field" placeholder={t.laboratory.referenceRange} value={row.referenceRange} onChange={(e) => setResultRows((r) => r.map((x, j) => j === i ? { ...x, referenceRange: e.target.value } : x))} />
                  <label className="flex items-center gap-2 text-sm text-[var(--txt2)] cursor-pointer">
                    <input type="checkbox" checked={row.isAbnormal} onChange={(e) => setResultRows((r) => r.map((x, j) => j === i ? { ...x, isAbnormal: e.target.checked } : x))} className="rounded" />
                    {t.laboratory.isAbnormal}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--err)] cursor-pointer">
                    <input type="checkbox" checked={row.isCritical} onChange={(e) => setResultRows((r) => r.map((x, j) => j === i ? { ...x, isCritical: e.target.checked } : x))} className="rounded" />
                    {t.laboratory.isCritical}
                  </label>
                  {resultRows.length > 1 && (
                    <button onClick={() => setResultRows((r) => r.filter((_, j) => j !== i))} className="col-span-2 text-xs text-[var(--err)] hover:underline text-start">{t.laboratory.removeResult}</button>
                  )}
                </div>
              ))}
              <button onClick={() => setResultRows((r) => [...r, { testName: "", value: "", unit: "", referenceRange: "", isAbnormal: false, isCritical: false }])} className="text-sm text-[var(--blue)] font-semibold hover:underline">
                + {t.laboratory.addResult}
              </button>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setResultsModal(null)} className="btn-secondary flex-1">{t.common.cancel}</button>
              <button onClick={saveResults} disabled={saving} className="btn-primary flex-1">
                {saving ? t.common.saving : t.laboratory.saveResults}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

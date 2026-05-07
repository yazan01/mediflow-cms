"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDateTime } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ErrorBanner } from "@/components/ErrorBanner";

const MODALITY_STYLES: Record<string, { bg: string; text: string }> = {
  XRAY:  { bg: "bg-[#f4f3f7]",   text: "text-[#43474e]" },
  CT:    { bg: "bg-[#d3e4ff]",   text: "text-[#00477f]" },
  MRI:   { bg: "bg-[#dbeafe]",   text: "text-[#1960a3]" },
  US:    { bg: "bg-[#ccfbf1]",   text: "text-[#0d9488]" },
  ECHO:  { bg: "bg-[#fdf4ff]",   text: "text-[#9333ea]" },
  DEXA:  { bg: "bg-[#fffbeb]",   text: "text-[#d97706]" },
  MAMMO: { bg: "bg-[#fce7f3]",   text: "text-[#be185d]" },
};

interface RadiologyOrder {
  id: string;
  patientName: string;
  mrn: string;
  modality: string;
  study: string;
  bodyPart: string;
  priority: string;
  orderedBy: string;
  scheduledAt: string | null;
  status: string;
  radiologist: string | null;
  date: string;
  report?: string | null;
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 end-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${type === "success" ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#ffdad6] text-[#ba1a1a]"}`}>
      <span className="material-symbols-outlined text-[18px]">{type === "success" ? "check_circle" : "error"}</span>
      {message}
      <button onClick={onClose} className="ms-1 opacity-70 hover:opacity-100"><span className="material-symbols-outlined text-[16px]">close</span></button>
    </div>
  );
}

export default function RadiologyPage() {
  const { t } = useLanguage();

  const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
    PENDING:          { label: t.radiology.pendingStatus,    bg: "bg-[#e9e7eb]",   text: "text-[#43474e]" },
    SCHEDULED:        { label: t.radiology.scheduledStatus,  bg: "bg-[#d3e4ff]",   text: "text-[#00477f]" },
    IN_PROGRESS:      { label: t.radiology.inProgressStatus, bg: "bg-[#ffddba]",   text: "text-[#633f0f]" },
    IMAGES_ACQUIRED:  { label: t.radiology.imagesAcquired,   bg: "bg-[#ccfbf1]",   text: "text-[#0d9488]" },
    REPORT_READY:     { label: t.radiology.reportReady,      bg: "bg-[#d6e3ff]",   text: "text-[#002045]" },
    CANCELLED:        { label: t.radiology.cancelledStatus,  bg: "bg-[#ffdad6]",   text: "text-[#ba1a1a]" },
  };

  const [orders, setOrders] = useState<RadiologyOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modalityFilter, setModalityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<RadiologyOrder | null>(null);
  const [reportText, setReportText] = useState("");
  const [scheduleModal, setScheduleModal] = useState<RadiologyOrder | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
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
        ...(modalityFilter !== "ALL" && { modality: modalityFilter }),
      });
      const res = await fetch(`/api/radiology?${params}`, { signal: abortRef.current.signal });
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      setOrders(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setFetchError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, modalityFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function patchOrder(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/radiology/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
  }

  async function handleCancelOrder() {
    if (!confirmCancel) return;
    try {
      await patchOrder(confirmCancel, { status: "CANCELLED" });
      setToast({ message: t.radiology.orderCancelled, type: "success" });
      fetchOrders();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setConfirmCancel(null);
    }
  }

  async function handleSaveReport() {
    if (!reportModal || !reportText.trim()) return;
    setSaving(true);
    try {
      await patchOrder(reportModal.id, { report: reportText });
      setToast({ message: t.radiology.reportSaved, type: "success" });
      setReportModal(null);
      fetchOrders();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSchedule() {
    if (!scheduleModal || !scheduleDateTime) return;
    setSaving(true);
    try {
      await patchOrder(scheduleModal.id, { scheduledAt: scheduleDateTime, status: "SCHEDULED" });
      setToast({ message: t.radiology.statusUpdated, type: "success" });
      setScheduleModal(null);
      fetchOrders();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const stats = {
    total,
    pending: orders.filter((o) => o.status === "PENDING").length,
    inProgress: orders.filter((o) => o.status === "IN_PROGRESS").length,
    reportReady: orders.filter((o) => o.status === "REPORT_READY").length,
    urgent: orders.filter((o) => o.priority === "URGENT" || o.priority === "STAT").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.radiology.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.radiology.subtitle}</p>
        </div>
        <button className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t.radiology.newOrder}
        </button>
      </div>

      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchOrders} />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: t.radiology.totalOrders,  value: stats.total,       icon: "image_search",  color: "text-[#1960a3]", bg: "bg-[#d3e4ff]" },
          { label: t.radiology.pending,       value: stats.pending,     icon: "pending",        color: "text-[#74777f]", bg: "bg-[#f4f3f7]" },
          { label: t.radiology.inProgress,    value: stats.inProgress,  icon: "hourglass",      color: "text-[#d97706]", bg: "bg-[#fffbeb]" },
          { label: t.radiology.reportsReady,  value: stats.reportReady, icon: "description",    color: "text-[#0d9488]", bg: "bg-[#ccfbf1]" },
          { label: t.radiology.urgentStat,    value: stats.urgent,      icon: "emergency",      color: "text-[#ba1a1a]", bg: "bg-[#ffdad6]" },
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
          <input
            className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            placeholder={t.radiology.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select value={modalityFilter} onChange={(e) => { setModalityFilter(e.target.value); setPage(1); }} className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
          <option value="ALL">{t.radiology.allModalities}</option>
          {["XRAY", "CT", "MRI", "US", "ECHO", "DEXA", "MAMMO"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
          <option value="ALL">{t.radiology.allStatuses}</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[t.radiology.orderId, t.radiology.patient, t.radiology.modality, t.radiology.study, t.radiology.priority, t.radiology.orderedBy, t.radiology.scheduled, t.radiology.status, t.radiology.actions].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                    <p className="text-sm text-[#74777f]">{t.radiology.loading}</p>
                  </div>
                </td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#74777f] text-2xl">image_search</span>
                    </div>
                    <p className="text-sm font-semibold text-[#1a1c1e]">{t.radiology.noOrders}</p>
                    <p className="text-xs text-[#74777f]">{search ? t.radiology.trySearch : t.radiology.noOrdersDesc}</p>
                  </div>
                </td></tr>
              ) : (
                orders.map((order) => {
                  const st = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;
                  const mod = MODALITY_STYLES[order.modality] ?? { bg: "bg-[#f4f3f7]", text: "text-[#43474e]" };
                  const isCancelled = order.status === "CANCELLED";
                  return (
                    <tr key={order.id} className="hover:bg-[#f4f3f7] transition-colors">
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <span className="text-xs font-mono font-semibold text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded">{order.id.slice(0, 8).toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <p className="text-sm font-semibold text-[#1a1c1e]">{order.patientName}</p>
                        <p className="text-xs text-[#74777f]">{order.mrn}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${mod.bg} ${mod.text}`}>{order.modality}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <p className="text-sm text-[#1a1c1e]">{order.study}</p>
                        <p className="text-xs text-[#74777f]">{order.bodyPart}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          order.priority === "STAT" ? "bg-[#ba1a1a] text-white" :
                          order.priority === "URGENT" ? "bg-[#ffddba] text-[#633f0f]" :
                          "bg-[#f4f3f7] text-[#74777f]"
                        }`}>{order.priority}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <p className="text-sm text-[#43474e]">{order.orderedBy}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <p className="text-xs text-[#74777f]">{order.scheduledAt ? formatDateTime(order.scheduledAt) : "—"}</p>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-[#e3e2e6]">
                        <div className="flex items-center gap-1">
                          {!isCancelled && (
                            <button
                              aria-label={t.radiology.enterReport}
                              title={t.radiology.enterReport}
                              onClick={() => { setReportText(order.report ?? ""); setReportModal(order); }}
                              className="p-1.5 hover:bg-[#d3e4ff] rounded-lg text-[#74777f] hover:text-[#1960a3] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">description</span>
                            </button>
                          )}
                          {!isCancelled && order.status === "PENDING" && (
                            <button
                              aria-label={t.radiology.schedule}
                              title={t.radiology.schedule}
                              onClick={() => { setScheduleDateTime(order.scheduledAt ?? ""); setScheduleModal(order); }}
                              className="p-1.5 hover:bg-[#d3e4ff] rounded-lg text-[#74777f] hover:text-[#1960a3] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                            </button>
                          )}
                          <button
                            aria-label={t.radiology.printAction}
                            title={t.radiology.printAction}
                            onClick={() => window.print()}
                            className="p-1.5 hover:bg-[#d3e4ff] rounded-lg text-[#74777f] hover:text-[#1960a3] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          {!isCancelled && (
                            <button
                              aria-label={t.radiology.cancelAction}
                              title={t.radiology.cancelAction}
                              onClick={() => setConfirmCancel(order.id)}
                              className="p-1.5 hover:bg-[#ffdad6] rounded-lg text-[#74777f] hover:text-[#ba1a1a] transition-colors"
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
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e3e2e6] bg-[#faf9fd]">
            <p className="text-xs text-[#74777f]">{t.radiology.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
              <button onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page === Math.ceil(total / pageSize)} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <div role="dialog" aria-modal="true" aria-labelledby="cancel-rad-title" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#ffdad6] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[28px] text-[#ba1a1a]">cancel</span>
            </div>
            <h2 id="cancel-rad-title" className="text-base font-bold text-[#1a1c1e] mb-2">{t.radiology.cancelAction}</h2>
            <p className="text-sm text-[#74777f] mb-6">{t.radiology.confirmCancelOrder}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)} className="btn-secondary flex-1">{t.common.cancel}</button>
              <button onClick={handleCancelOrder} className="flex-1 bg-[#ba1a1a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">{t.radiology.cancelAction}</button>
            </div>
          </div>
        </div>
      )}

      {/* Enter Report modal */}
      {reportModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
              <h2 id="report-title" className="text-base font-bold text-[#1a1c1e]">{t.radiology.reportTitle}</h2>
              <button aria-label={t.common.close} onClick={() => setReportModal(null)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg text-[#74777f]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#74777f] mb-3">{reportModal.patientName} · {reportModal.modality} — {reportModal.study}</p>
              <textarea
                className="input-field w-full min-h-[160px] resize-y"
                placeholder={t.radiology.reportPlaceholder}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setReportModal(null)} className="btn-secondary flex-1">{t.common.cancel}</button>
              <button onClick={handleSaveReport} disabled={saving || !reportText.trim()} className="btn-primary flex-1">
                {saving ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {scheduleModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="schedule-title" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
              <h2 id="schedule-title" className="text-base font-bold text-[#1a1c1e]">{t.radiology.scheduleTitle}</h2>
              <button aria-label={t.common.close} onClick={() => setScheduleModal(null)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg text-[#74777f]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#74777f] mb-3">{scheduleModal.patientName} · {scheduleModal.modality}</p>
              <label className="block text-xs font-semibold text-[#43474e] mb-1">{t.radiology.scheduleDateTime}</label>
              <input
                type="datetime-local"
                className="input-field w-full"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setScheduleModal(null)} className="btn-secondary flex-1">{t.common.cancel}</button>
              <button onClick={handleSaveSchedule} disabled={saving || !scheduleDateTime} className="btn-primary flex-1">
                {saving ? t.common.saving : t.radiology.schedule}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

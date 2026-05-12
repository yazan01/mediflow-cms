"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate, formatCurrency, printDocument } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ErrorBanner } from "@/components/ErrorBanner";
import { apiFetch } from "@/lib/hooks/useDataFetch";

type BillingStats = {
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
};

type InsuranceARRow = {
  providerName: string;
  invoiceCount: number;
  totalBilled: number;
  insuranceShare: number;
  patientShare: number;
  insuranceCollected: number;
  outstanding: number;
};

type InsuranceARData = {
  providers: InsuranceARRow[];
  totals: { insuranceShare: number; insuranceCollected: number; outstanding: number };
};

const STATUS_FILTERS = ["ALL", "PENDING", "PAID", "PARTIAL", "OVERDUE", "DRAFT"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function BillingPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const STATUS_STYLES: Record<InvoiceStatus, { label: string; cls: string; dot: string }> = {
    PAID:      { label: t.billing.paidStatus,    cls: "status-ok",    dot: "var(--teal)"    },
    PENDING:   { label: t.billing.pendingStatus, cls: "status-info",  dot: "var(--blue)"    },
    PARTIAL:   { label: t.billing.partial,       cls: "status-warn",  dot: "var(--warn)"    },
    OVERDUE:   { label: t.billing.overdue,       cls: "status-err",   dot: "var(--err)"     },
    DRAFT:     { label: t.billing.draft,         cls: "status-muted", dot: "var(--txt4)"    },
    CANCELLED: { label: t.billing.cancelled,     cls: "status-muted", dot: "var(--txt4)"    },
    REFUNDED:  { label: t.billing.refunded,      cls: "status-info",  dot: "var(--blue)"    },
  };

  const [activeTab,     setActiveTab]     = useState<"invoices" | "insurance_ar">("invoices");
  const [invoices,      setInvoices]      = useState<Invoice[]>([]);
  const [stats,         setStats]         = useState<BillingStats | null>(null);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [loadingStats,  setLoadingStats]  = useState(true);
  const [fetchError,    setFetchError]    = useState<Error | null>(null);
  const [search,        setSearch]        = useState("");
  const debouncedSearch                  = useDebounce(search, 300);
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("ALL");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [page,          setPage]          = useState(1);
  const pageSize = 15;

  const [arData,        setArData]        = useState<InsuranceARData | null>(null);
  const [arLoading,     setArLoading]     = useState(false);
  const [arError,       setArError]       = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingStats(true);
    fetch("/api/billing/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (active && d) setStats(d.data ?? d); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingStats(false); });
    return () => { active = false; };
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/billing?${params}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      setInvoices(data.data ?? []); setTotal(data.total ?? 0);
    } catch (err) {
      setFetchError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const fetchInsuranceAR = useCallback(async () => {
    setArLoading(true); setArError(null);
    try {
      const data = await apiFetch<InsuranceARData>("/api/billing/insurance-ar");
      setArData(data);
    } catch (err) {
      setArError(err as Error);
    } finally {
      setArLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "insurance_ar" && !arData && !arLoading) {
      fetchInsuranceAR();
    }
  }, [activeTab, arData, arLoading, fetchInsuranceAR]);

  const totalPages = Math.ceil(total / pageSize);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: StatusFilter) { setStatusFilter(v); setPage(1); }

  const kpiCards = [
    {
      label: t.billing.totalRevenue,    icon: "payments",
      iconBg: "var(--teal-soft)",  iconColor: "var(--teal)",
      value: loadingStats ? null : formatCurrency(stats?.totalRevenue ?? 0),
    },
    {
      label: t.billing.pendingAmount,   icon: "hourglass_empty",
      iconBg: "var(--blue-bg)",    iconColor: "var(--blue)",
      value: loadingStats ? null : formatCurrency(stats?.pendingAmount ?? 0),
    },
    {
      label: t.billing.overdueAmount,   icon: "warning",
      iconBg: "var(--err-soft)",   iconColor: "var(--err)",
      value: loadingStats ? null : formatCurrency(stats?.overdueAmount ?? 0),
    },
    {
      label: t.billing.paidThisMonth,   icon: "check_circle",
      iconBg: "var(--teal-soft)",  iconColor: "var(--teal-h)",
      value: loadingStats ? null : formatCurrency(stats?.paidThisMonth ?? 0),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="page-title">{t.billing.title}</h1>
          <p className="page-subtitle">
            {activeTab === "invoices"
              ? `${total} ${t.billing.invoices}`
              : t.billing.insuranceARDesc}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {activeTab === "invoices" && (
            <>
              <button className="btn-secondary btn-sm hidden sm:flex">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                {t.billing.export}
              </button>
              <Link href="/billing/new" className="btn-primary btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                {t.billing.newInvoice}
              </Link>
            </>
          )}
          {activeTab === "insurance_ar" && (
            <button
              onClick={fetchInsuranceAR}
              className="btn-secondary btn-sm"
              aria-label="Refresh"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              {t.common.refresh}
            </button>
          )}
        </div>
      </motion.div>

      {/* ── KPI cards ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04, duration: 0.38, ease }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + i * 0.07, duration: 0.35, ease }}
            className="stat-card"
          >
            <div className="icon-box mb-4" style={{ background: card.iconBg, color: card.iconColor }}>
              <span className="material-symbols-outlined"
                style={{ fontSize: 20, fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>
                {card.icon}
              </span>
            </div>
            {card.value === null ? (
              <div className="skeleton h-7 w-28 mb-1.5" />
            ) : (
              <p className="tabular font-extrabold tracking-[-0.025em] mb-1"
                style={{ fontSize: 22, color: "var(--txt1)", lineHeight: 1 }}>
                {card.value}
              </p>
            )}
            <p className="t-caption font-semibold">{card.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Tab bar ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.3, ease }}
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
      >
        {([
          { id: "invoices",    icon: "receipt_long",   label: t.billing.invoices },
          { id: "insurance_ar", icon: "health_and_safety", label: t.billing.insuranceARTab },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={activeTab === tab.id ? {
              background: "var(--surface)",
              color: "var(--brand)",
              boxShadow: "var(--sh-sm)",
            } : {
              color: "var(--txt3)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ── Invoices tab ──────────────────────── */}
        {activeTab === "invoices" && (
          <motion.div
            key="invoices"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease }}
            className="space-y-4"
          >
            {fetchError && <ErrorBanner error={fetchError} onRetry={fetchInvoices} />}

            {/* Filters */}
            <div className="card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="input-group flex-1">
                  <span className="material-symbols-outlined input-icon input-icon-start" style={{ fontSize: 17 }}>search</span>
                  <input
                    className="search-field"
                    placeholder={t.billing.searchPlaceholder}
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatus(e.target.value as StatusFilter)}
                  className="select-field sm:w-40"
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>
                      {s === "ALL" ? t.billing.allStatuses : (STATUS_STYLES[s as InvoiceStatus]?.label ?? s)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input type="date" value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="input-field text-sm" style={{ width: 140 }}
                  />
                  <span className="text-sm" style={{ color: "var(--txt3)" }}>—</span>
                  <input type="date" value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="input-field text-sm" style={{ width: 140 }}
                  />
                </div>
                {(search || statusFilter !== "ALL" || dateFrom || dateTo) && (
                  <button
                    onClick={() => { setSearch(""); setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); setPage(1); }}
                    className="btn-ghost btn-sm whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                    {t.common.clear}
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatus(s)}
                    className={`chip ${statusFilter === s ? "active" : ""}`}
                  >
                    {s === "ALL" ? t.common.all : (STATUS_STYLES[s as InvoiceStatus]?.label ?? s)}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="table-wrapper">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {[
                        { label: t.billing.invoice,  align: "start"  },
                        { label: t.billing.patient,  align: "start"  },
                        { label: t.billing.date,     align: "start"  },
                        { label: t.billing.items,    align: "center" },
                        { label: t.billing.subtotal, align: "end"    },
                        { label: t.billing.discount, align: "end"    },
                        { label: t.billing.tax,      align: "end"    },
                        { label: t.billing.total,    align: "end"    },
                        { label: t.billing.paid,     align: "end"    },
                        { label: t.billing.balance,  align: "end"    },
                        { label: t.billing.status,   align: "start"  },
                        { label: "",                 align: "end"    },
                      ].map(({ label, align }, i) => (
                        <th key={i} className={`table-header text-${align}`}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                          <td className="table-cell">
                            <div className="space-y-1.5">
                              <div className="skeleton h-3.5 w-28" />
                              <div className="skeleton h-2.5 w-16" />
                            </div>
                          </td>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="table-cell"><div className="skeleton h-3 w-16 ms-auto" /></td>
                          ))}
                          <td className="table-cell"><div className="skeleton h-5 w-16 rounded-full" /></td>
                          <td className="table-cell"><div className="skeleton h-7 w-16 ms-auto" /></td>
                        </tr>
                      ))
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={12}>
                          <div className="empty-state py-16">
                            <div className="empty-state-icon">
                              <span className="material-symbols-outlined"
                                style={{ fontSize: 28, color: "var(--txt3)", fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}>
                                receipt_long
                              </span>
                            </div>
                            <p className="empty-state-title">{t.billing.noInvoices}</p>
                            <p className="empty-state-desc">
                              {search || statusFilter !== "ALL" ? t.billing.tryFilters : t.billing.createFirst}
                            </p>
                            {!search && statusFilter === "ALL" && (
                              <Link href="/billing/new" className="btn-primary btn-sm">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                {t.billing.createFirstBtn}
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv, idx) => {
                        const st        = STATUS_STYLES[inv.status] ?? STATUS_STYLES.DRAFT;
                        const isOverdue = inv.status === "OVERDUE";
                        return (
                          <motion.tr
                            key={inv.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.025, duration: 0.22, ease }}
                            className="table-row"
                            style={isOverdue ? { background: "color-mix(in srgb, var(--err-soft) 40%, transparent)" } : {}}
                          >
                            <td className="table-cell">
                              <Link
                                href={`/billing/${inv.id}`}
                                className="font-mono text-[11.5px] font-bold px-2 py-1 rounded-lg hover:underline transition-colors"
                                style={{ background: "var(--blue-bg)", color: "var(--blue)" }}
                              >
                                #{inv.id.slice(-8).toUpperCase()}
                              </Link>
                            </td>
                            <td className="table-cell">
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/patients/${inv.patientId}`); }}
                                className="text-[13.5px] font-semibold hover:underline text-start"
                                style={{ color: "var(--blue)" }}
                              >
                                {inv.patientName}
                              </button>
                              {inv.insuranceClaim && (
                                <span className="badge badge-sm status-info mt-0.5">
                                  {t.billing.insurance}
                                </span>
                              )}
                            </td>
                            <td className="table-cell whitespace-nowrap">
                              <p className="text-[13px]" style={{ color: "var(--txt2)" }}>{formatDate(inv.createdAt)}</p>
                              {inv.dueDate && (
                                <p className="text-[11px] font-medium mt-0.5"
                                  style={{ color: isOverdue ? "var(--err)" : "var(--txt4)" }}>
                                  {t.billing.due}: {formatDate(inv.dueDate)}
                                </p>
                              )}
                            </td>
                            <td className="table-cell text-center">
                              <span className="badge status-muted tabular">{inv.items.length}</span>
                            </td>
                            <td className="table-cell text-end tabular text-[13px]" style={{ color: "var(--txt2)" }}>
                              {formatCurrency(inv.subtotal)}
                            </td>
                            <td className="table-cell text-end tabular text-[13px]">
                              {Number(inv.discountAmount) > 0 ? (
                                <span style={{ color: "var(--teal-h)" }}>−{formatCurrency(Number(inv.discountAmount))}</span>
                              ) : (
                                <span style={{ color: "var(--txt4)" }}>—</span>
                              )}
                            </td>
                            <td className="table-cell text-end tabular text-[13px]" style={{ color: "var(--txt2)" }}>
                              {Number(inv.taxAmount) > 0
                                ? formatCurrency(Number(inv.taxAmount))
                                : <span style={{ color: "var(--txt4)" }}>—</span>
                              }
                            </td>
                            <td className="table-cell text-end">
                              <span className="tabular font-bold text-[13.5px]" style={{ color: "var(--txt1)" }}>
                                {formatCurrency(Number(inv.totalAmount))}
                              </span>
                            </td>
                            <td className="table-cell text-end">
                              <span className="tabular font-semibold text-[13px]" style={{ color: "var(--teal)" }}>
                                {formatCurrency(Number(inv.paidAmount))}
                              </span>
                            </td>
                            <td className="table-cell text-end">
                              {inv.balance > 0 ? (
                                <span className="tabular font-bold text-[13.5px]"
                                  style={{ color: isOverdue ? "var(--err)" : "var(--warn)" }}>
                                  {formatCurrency(inv.balance)}
                                </span>
                              ) : (
                                <span style={{ color: "var(--teal)", fontWeight: 600, fontSize: 13 }}>—</span>
                              )}
                            </td>
                            <td className="table-cell">
                              <span className={`badge badge-dot ${st.cls}`}
                                style={{ "--tw-badge-dot-color": st.dot } as React.CSSProperties}>
                                {st.label}
                              </span>
                            </td>
                            <td className="table-cell text-end" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-0.5">
                                <Link href={`/billing/${inv.id}`} className="btn-icon btn-sm" title={t.billing.viewInvoice} aria-label={t.billing.viewInvoice}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 17 }}>visibility</span>
                                </Link>
                                <button
                                  onClick={() => printDocument(`/print/invoice/${inv.id}`)}
                                  className="btn-icon btn-sm" title={t.billing.printInvoice} aria-label={t.billing.printInvoice}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 17 }}>print</span>
                                </button>
                                {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                                  <Link href={`/billing/${inv.id}`} className="btn-icon btn-sm"
                                    title={t.billing.recordPayment} aria-label={t.billing.recordPayment}
                                    style={{ color: "var(--teal)" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>payments</span>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t"
                  style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
                  <p className="text-xs" style={{ color: "var(--txt3)" }}>
                    {t.billing.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)}{" "}
                    {t.common.of} {total} {t.billing.invoices}
                  </p>
                  <div className="pagination">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="pagination-btn" aria-label="Previous page">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const p = start + i;
                      return p <= totalPages ? (
                        <button key={p} onClick={() => setPage(p)}
                          className={`pagination-btn ${page === p ? "active" : ""}`}>
                          {p}
                        </button>
                      ) : null;
                    })}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="pagination-btn" aria-label="Next page">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Insurance AR tab ─────────────────── */}
        {activeTab === "insurance_ar" && (
          <motion.div
            key="insurance_ar"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease }}
            className="space-y-4"
          >
            {arError && <ErrorBanner error={arError} onRetry={fetchInsuranceAR} />}

            {/* AR Summary cards */}
            {arData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: t.billing.insTotalClaims,
                    value: formatCurrency(arData.totals.insuranceShare),
                    icon: "health_and_safety",
                    iconBg: "var(--blue-bg)", iconColor: "var(--blue)",
                  },
                  {
                    label: t.billing.insTotalCollected,
                    value: formatCurrency(arData.totals.insuranceCollected),
                    icon: "check_circle",
                    iconBg: "var(--teal-soft)", iconColor: "var(--teal)",
                  },
                  {
                    label: t.billing.insTotalOutstanding,
                    value: formatCurrency(arData.totals.outstanding),
                    icon: "pending_actions",
                    iconBg: "var(--warn-bg)", iconColor: "var(--warn)",
                  },
                ].map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3, ease }}
                    className="stat-card"
                  >
                    <div className="icon-box mb-4" style={{ background: card.iconBg, color: card.iconColor }}>
                      <span className="material-symbols-outlined"
                        style={{ fontSize: 20, fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>
                        {card.icon}
                      </span>
                    </div>
                    <p className="tabular font-extrabold tracking-[-0.025em] mb-1"
                      style={{ fontSize: 22, color: "var(--txt1)", lineHeight: 1 }}>
                      {card.value}
                    </p>
                    <p className="t-caption font-semibold">{card.label}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* AR table */}
            <div className="table-wrapper">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {[
                        { label: t.billing.insProvider,       align: "start" },
                        { label: t.billing.invoices,          align: "center" },
                        { label: t.billing.totalAmount,       align: "end" },
                        { label: t.billing.patientShare,      align: "end" },
                        { label: t.billing.insuranceShare,    align: "end" },
                        { label: t.billing.insCollected,      align: "end" },
                        { label: t.billing.insOutstanding,    align: "end" },
                      ].map(({ label, align }, i) => (
                        <th key={i} className={`table-header text-${align}`}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="table-cell">
                              <div className="skeleton h-4 w-24 mx-auto" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : !arData || arData.providers.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state py-16">
                            <div className="empty-state-icon">
                              <span className="material-symbols-outlined"
                                style={{ fontSize: 28, color: "var(--txt3)", fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}>
                                health_and_safety
                              </span>
                            </div>
                            <p className="empty-state-title">{t.billing.insNoClaimsTitle}</p>
                            <p className="empty-state-desc">{t.billing.insNoClaimsDesc}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      arData.providers.map((row, idx) => (
                        <motion.tr
                          key={row.providerName}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04, duration: 0.22, ease }}
                          className="table-row"
                        >
                          <td className="table-cell">
                            <div className="flex items-center gap-2.5">
                              <div className="icon-box icon-box-sm"
                                style={{ background: "var(--blue-bg)", color: "var(--blue)", flexShrink: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>health_and_safety</span>
                              </div>
                              <span className="font-semibold text-sm" style={{ color: "var(--txt1)" }}>
                                {row.providerName}
                              </span>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            <span className="badge status-info tabular">{row.invoiceCount}</span>
                          </td>
                          <td className="table-cell text-end tabular text-[13px]" style={{ color: "var(--txt2)" }}>
                            {formatCurrency(row.totalBilled)}
                          </td>
                          <td className="table-cell text-end tabular text-[13px]" style={{ color: "var(--txt3)" }}>
                            {formatCurrency(row.patientShare)}
                          </td>
                          <td className="table-cell text-end">
                            <span className="tabular font-semibold text-[13px]" style={{ color: "var(--blue)" }}>
                              {formatCurrency(row.insuranceShare)}
                            </span>
                          </td>
                          <td className="table-cell text-end">
                            <span className="tabular font-semibold text-[13px]" style={{ color: "var(--teal)" }}>
                              {formatCurrency(row.insuranceCollected)}
                            </span>
                          </td>
                          <td className="table-cell text-end">
                            {row.outstanding > 0 ? (
                              <span className="tabular font-bold text-[13.5px]" style={{ color: "var(--warn)" }}>
                                {formatCurrency(row.outstanding)}
                              </span>
                            ) : (
                              <span className="badge status-ok">✓</span>
                            )}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

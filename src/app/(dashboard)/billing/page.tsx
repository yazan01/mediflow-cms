"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type BillingStats = {
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
};

const STATUS_FILTERS = ["ALL", "PENDING", "PAID", "PARTIAL", "OVERDUE", "DRAFT"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function BillingPage() {
  const { t } = useLanguage();

  const STATUS_STYLES: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
    PAID:      { label: t.billing.paidStatus,    bg: "bg-[#ccfbf1]",  text: "text-[#0d9488]" },
    PENDING:   { label: t.billing.pendingStatus, bg: "bg-[#d3e4ff]",  text: "text-[#00477f]" },
    PARTIAL:   { label: t.billing.partial,       bg: "bg-[#ffddba]",  text: "text-[#633f0f]" },
    OVERDUE:   { label: t.billing.overdue,       bg: "bg-[#ffdad6]",  text: "text-[#ba1a1a]" },
    DRAFT:     { label: t.billing.draft,         bg: "bg-[#e9e7eb]",  text: "text-[#43474e]" },
    CANCELLED: { label: t.billing.cancelled,     bg: "bg-[#e3e2e6]",  text: "text-[#74777f]" },
    REFUNDED:  { label: t.billing.refunded,      bg: "bg-[#d6e3ff]",  text: "text-[#002045]" },
  };

  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [stats, setStats]             = useState<BillingStats | null>(null);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [page, setPage]               = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const pageSize = 15;

  /* ── fetch stats ── */
  useEffect(() => {
    let active = true;
    setLoadingStats(true);
    fetch("/api/billing/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setStats(d.data ?? d); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingStats(false); });
    return () => { active = false; };
  }, []);

  /* ── fetch invoices ── */
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search && { search }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/billing?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const totalPages = Math.ceil(total / pageSize);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }
  function handleStatus(v: StatusFilter) {
    setStatusFilter(v);
    setPage(1);
  }

  async function handlePrint(id: string) {
    window.open(`/api/billing/${id}/print`, "_blank");
  }

  async function handleRecordPayment(id: string) {
    // Navigate to the invoice detail where payment can be recorded
    window.location.href = `/billing/${id}`;
  }

  return (
    <div className="space-y-6" onClick={() => setActionMenuId(null)}>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.billing.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{total} {t.billing.invoices}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t.billing.export}
          </button>
          <Link
            href="/billing/new"
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t.billing.newInvoice}
          </Link>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t.billing.totalRevenue}
          value={loadingStats ? null : formatCurrency(stats?.totalRevenue ?? 0)}
          icon="payments"
          iconBg="bg-[#ccfbf1]"
          iconColor="text-[#0d9488]"
          change={null}
        />
        <StatCard
          label={t.billing.pendingAmount}
          value={loadingStats ? null : formatCurrency(stats?.pendingAmount ?? 0)}
          icon="hourglass_empty"
          iconBg="bg-[#d3e4ff]"
          iconColor="text-[#1960a3]"
          change={null}
        />
        <StatCard
          label={t.billing.overdueAmount}
          value={loadingStats ? null : formatCurrency(stats?.overdueAmount ?? 0)}
          icon="warning"
          iconBg="bg-[#ffdad6]"
          iconColor="text-[#ba1a1a]"
          change={null}
        />
        <StatCard
          label={t.billing.paidThisMonth}
          value={loadingStats ? null : formatCurrency(stats?.paidThisMonth ?? 0)}
          icon="check_circle"
          iconBg="bg-[#ccfbf1]"
          iconColor="text-[#0d9488]"
          change={null}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
            <input
              className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              placeholder={t.billing.searchPlaceholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatus(e.target.value as StatusFilter)}
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3]"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? t.billing.allStatuses : (STATUS_STYLES[s as InvoiceStatus]?.label ?? s)}
              </option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3]"
            />
            <span className="text-[#74777f] text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3]"
            />
          </div>

          {(search || statusFilter !== "ALL" || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); setPage(1); }}
              className="flex items-center gap-1.5 border border-[#c4c6cf] bg-white px-3 py-2.5 rounded-lg text-sm text-[#74777f] hover:bg-[#f4f3f7] transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              {t.common.clear}
            </button>
          )}
        </div>

        {/* Quick status tabs */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                statusFilter === s
                  ? "bg-[#002045] text-white"
                  : "bg-[#f4f3f7] text-[#43474e] hover:bg-[#e9e7eb]"
              }`}
            >
              {s === "ALL" ? t.common.all : (STATUS_STYLES[s as InvoiceStatus]?.label ?? s)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[
                  t.billing.invoice,
                  t.billing.patient,
                  t.billing.date,
                  t.billing.items,
                  t.billing.subtotal,
                  t.billing.discount,
                  t.billing.tax,
                  t.billing.total,
                  t.billing.paid,
                  t.billing.balance,
                  t.billing.status,
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`table-header ${
                      i >= 4 && i <= 9 ? "text-right" : i === 11 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                      <p className="text-sm text-[#74777f]">{t.billing.loading}</p>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#74777f] text-3xl">receipt_long</span>
                      </div>
                      <p className="text-sm font-semibold text-[#1a1c1e]">{t.billing.noInvoices}</p>
                      <p className="text-xs text-[#74777f]">
                        {search || statusFilter !== "ALL" ? t.billing.tryFilters : t.billing.createFirst}
                      </p>
                      {!search && statusFilter === "ALL" && (
                        <Link href="/billing/new" className="mt-1 text-sm text-[#1960a3] font-semibold hover:underline">
                          {t.billing.createFirstBtn}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const st = STATUS_STYLES[inv.status] ?? STATUS_STYLES.DRAFT;
                  const isOverdue = inv.status === "OVERDUE";
                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors group ${
                        isOverdue ? "bg-[#fff8f7] hover:bg-[#ffdad6]/30" : "hover:bg-[#f4f3f7]"
                      }`}
                    >
                      {/* Invoice ID */}
                      <td className="table-cell">
                        <Link
                          href={`/billing/${inv.id}`}
                          className="text-xs font-mono font-semibold text-[#1960a3] hover:underline bg-[#d3e4ff]/40 px-2 py-1 rounded"
                        >
                          #{inv.id.slice(-8).toUpperCase()}
                        </Link>
                      </td>

                      {/* Patient */}
                      <td className="table-cell">
                        <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors">
                          {inv.patientName}
                        </p>
                        {inv.insuranceClaim && (
                          <span className="text-[10px] text-[#1960a3] font-semibold bg-[#d3e4ff]/50 px-1.5 py-0.5 rounded">
                            {t.billing.insurance}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="table-cell whitespace-nowrap text-[#43474e]">
                        <p>{formatDate(inv.createdAt)}</p>
                        {inv.dueDate && (
                          <p className={`text-[10px] ${isOverdue ? "text-[#ba1a1a] font-semibold" : "text-[#74777f]"}`}>
                            {t.billing.due}: {formatDate(inv.dueDate)}
                          </p>
                        )}
                      </td>

                      {/* Items count */}
                      <td className="table-cell text-center">
                        <span className="text-sm font-semibold text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded-lg">
                          {inv.items.length}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="table-cell text-right text-[#43474e]">
                        {formatCurrency(inv.subtotal)}
                      </td>

                      {/* Discount */}
                      <td className="table-cell text-right">
                        {Number(inv.discountAmount) > 0 ? (
                          <span className="text-[#0d9488]">−{formatCurrency(Number(inv.discountAmount))}</span>
                        ) : (
                          <span className="text-[#c4c6cf]">—</span>
                        )}
                      </td>

                      {/* Tax */}
                      <td className="table-cell text-right text-[#43474e]">
                        {Number(inv.taxAmount) > 0 ? formatCurrency(Number(inv.taxAmount)) : <span className="text-[#c4c6cf]">—</span>}
                      </td>

                      {/* Total */}
                      <td className="table-cell text-right">
                        <span className="font-bold text-[#1a1c1e]">{formatCurrency(Number(inv.totalAmount))}</span>
                      </td>

                      {/* Paid */}
                      <td className="table-cell text-right">
                        <span className="text-[#0d9488] font-semibold">{formatCurrency(Number(inv.paidAmount))}</span>
                      </td>

                      {/* Balance */}
                      <td className="table-cell text-right">
                        {inv.balance > 0 ? (
                          <span className={`font-bold ${isOverdue ? "text-[#ba1a1a]" : "text-[#d97706]"}`}>
                            {formatCurrency(inv.balance)}
                          </span>
                        ) : (
                          <span className="text-[#0d9488] font-semibold">—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="table-cell">
                        <span className={`badge ${st.bg} ${st.text}`}>{st.label}</span>
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative flex items-center justify-end gap-1">
                          <Link
                            href={`/billing/${inv.id}`}
                            className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]"
                            title={t.billing.viewInvoice}
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </Link>
                          <button
                            onClick={() => handlePrint(inv.id)}
                            className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]"
                            title={t.billing.printInvoice}
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                            <button
                              onClick={() => handleRecordPayment(inv.id)}
                              className="p-1.5 hover:bg-[#ccfbf1] rounded-lg transition-colors text-[#74777f] hover:text-[#0d9488]"
                              title={t.billing.recordPayment}
                            >
                              <span className="material-symbols-outlined text-[18px]">payments</span>
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

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e3e2e6] bg-[#faf9fd]">
            <p className="text-xs text-[#74777f]">
              {t.billing.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} {t.common.of} {total} {t.billing.invoices}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return p <= totalPages ? (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                      page === p ? "bg-[#002045] text-white" : "hover:bg-[#f4f3f7] text-[#43474e]"
                    }`}
                  >
                    {p}
                  </button>
                ) : null;
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card sub-component ── */
function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | null;
  icon: string;
  iconBg: string;
  iconColor: string;
  change: number | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
        </div>
      </div>
      {value === null ? (
        <div className="h-7 w-28 bg-[#f4f3f7] rounded animate-pulse mb-1"></div>
      ) : (
        <p className="text-2xl font-bold text-[#1a1c1e] tabular-nums">{value}</p>
      )}
      <p className="text-xs text-[#74777f] mt-1 font-medium">{label}</p>
    </div>
  );
}

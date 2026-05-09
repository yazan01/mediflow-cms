"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Medication, StockStatus } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ErrorBanner } from "@/components/ErrorBanner";

type PharmacyStats = {
  totalSKUs: number;
  lowStockItems: number;
  outOfStock: number;
  expiringSoon: number;
};

type StockFilter = "ALL" | StockStatus;

export default function PharmacyPage() {
  const { t } = useLanguage();

  const STOCK_STYLES: Record<StockStatus, { label: string; bg: string; text: string; rowBg: string }> = {
    IN_STOCK:     { label: t.pharmacy.inStock,         bg: "bg-[var(--ok-bg)]",  text: "text-[var(--ok)]", rowBg: "" },
    LOW_STOCK:    { label: t.pharmacy.lowStockStatus,  bg: "bg-[#ffddba]",  text: "text-[#633f0f]", rowBg: "bg-[#fffbeb]" },
    CRITICAL:     { label: t.pharmacy.criticalStock,   bg: "bg-[var(--err-bg)]",  text: "text-[var(--err)]", rowBg: "bg-[#fff8f7]" },
    OUT_OF_STOCK: { label: t.pharmacy.outOfStockStatus, bg: "bg-[#3b1218]", text: "text-[#ffdad6]", rowBg: "bg-[#fff0f0]" },
  };

  const CATEGORIES = [
    "ALL",
    t.pharmacy.antibiotics,
    t.pharmacy.analgesics,
    t.pharmacy.antihypertensives,
    t.pharmacy.antidiabetics,
    t.pharmacy.cardiovascular,
    t.pharmacy.respiratory,
    t.pharmacy.gastrointestinal,
    t.pharmacy.vitamins,
    t.pharmacy.dermatology,
    t.pharmacy.other,
  ] as const;

  const [medications, setMedications] = useState<Medication[]>([]);
  const [stats, setStats]             = useState<PharmacyStats | null>(null);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [search, setSearch]           = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter]     = useState<StockFilter>("ALL");
  const [page, setPage]               = useState(1);
  const [expiryAlert, setExpiryAlert] = useState<Medication[]>([]);
  const [fetchError, setFetchError]   = useState<Error | null>(null);
  const [adjustId, setAdjustId]       = useState<string | null>(null);
  const [adjustQty, setAdjustQty]     = useState("");
  const [adjustNote, setAdjustNote]   = useState("");
  const [adjusting, setAdjusting]     = useState(false);

  const pageSize = 15;

  /* ── stats ── */
  useEffect(() => {
    let active = true;
    setLoadingStats(true);
    fetch("/api/pharmacy/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setStats(d.data ?? d); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingStats(false); });
    return () => { active = false; };
  }, []);

  /* ── medications ── */
  const fetchMedications = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(categoryFilter !== "ALL" && { category: categoryFilter }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      });
      const res = await fetch(`/api/pharmacy/medications?${params}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      const list: Medication[] = data.data ?? data ?? [];
      setMedications(list);
      setTotal(data.total ?? list.length);

      // Compute expiry alert (within 90 days)
      const today = new Date();
      const cutoff = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
      setExpiryAlert(
        list.filter((m) => {
          if (!m.expiryDate) return false;
          const exp = new Date(m.expiryDate);
          return exp <= cutoff && exp >= today;
        })
      );
    } catch (err) {
      setFetchError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter, statusFilter]);

  useEffect(() => { fetchMedications(); }, [fetchMedications]);

  const totalPages = Math.ceil(total / pageSize);

  async function handleAdjustStock() {
    if (!adjustId || !adjustQty) return;
    setAdjusting(true);
    try {
      await fetch(`/api/pharmacy/medications/${adjustId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: Number(adjustQty), note: adjustNote }),
      });
      setAdjustId(null);
      setAdjustQty("");
      setAdjustNote("");
      fetchMedications();
    } catch {
      // error handled silently; production would show toast
    } finally {
      setAdjusting(false);
    }
  }

  const adjustMed = medications.find((m) => m.id === adjustId);

  return (
    <div className="space-y-6">
      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchMedications} />}

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--txt1)]">{t.pharmacy.title}</h1>
          <p className="text-sm text-[var(--txt2)] mt-0.5">{total} {t.pharmacy.medications}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/pharmacy/purchase"
            className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] text-[var(--txt1)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--surface2)] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">local_shipping</span>
            {t.pharmacy.recordPurchase}
          </Link>
          <Link
            href="/pharmacy/new"
            className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t.pharmacy.addMedication}
          </Link>
        </div>
      </div>

      {/* ── Expiry alert banner ── */}
      {expiryAlert.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-[#ffddba] border border-[#d97706]/30 rounded-xl">
          <span className="material-symbols-outlined text-[var(--warn)] text-[22px] flex-shrink-0 mt-0.5">warning</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#633f0f]">{t.pharmacy.expiryAlert}</p>
            <p className="text-xs text-[#7c4a00] mt-0.5">
              {expiryAlert.length} {t.pharmacy.expiryAlertDesc}:&nbsp;
              {expiryAlert.slice(0, 4).map((m) => m.brandName ?? m.genericName).join(", ")}
              {expiryAlert.length > 4 && ` ${t.common.andMore.replace("{count}", String(expiryAlert.length - 4))}`}.
            </p>
          </div>
          <button
            onClick={() => setStatusFilter("ALL")}
            className="text-xs text-[#633f0f] font-semibold underline hover:no-underline whitespace-nowrap"
          >
            {t.pharmacy.viewAll}
          </button>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PharmStatCard
          label={t.pharmacy.totalSKUs}
          value={loadingStats ? null : (stats?.totalSKUs ?? 0).toString()}
          icon="inventory_2"
          iconBg="bg-[var(--blue-bg)]"
          iconColor="text-[var(--blue)]"
        />
        <PharmStatCard
          label={t.pharmacy.lowStock}
          value={loadingStats ? null : (stats?.lowStockItems ?? 0).toString()}
          icon="trending_down"
          iconBg="bg-[#ffddba]"
          iconColor="text-[var(--warn)]"
          onClick={() => setStatusFilter("LOW_STOCK")}
        />
        <PharmStatCard
          label={t.pharmacy.outOfStock}
          value={loadingStats ? null : (stats?.outOfStock ?? 0).toString()}
          icon="remove_shopping_cart"
          iconBg="bg-[var(--err-bg)]"
          iconColor="text-[var(--err)]"
          onClick={() => setStatusFilter("OUT_OF_STOCK")}
        />
        <PharmStatCard
          label={t.pharmacy.expiringSoon}
          value={loadingStats ? null : (stats?.expiringSoon ?? 0).toString()}
          icon="event_busy"
          iconBg="bg-[#ffddba]"
          iconColor="text-[#633f0f]"
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--txt2)] text-[18px]">search</span>
            <input
              className="w-full bg-[var(--surface2)] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[var(--txt1)] placeholder:text-[var(--txt2)] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              placeholder={t.pharmacy.searchPlaceholder}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c === t.pharmacy.antibiotics ? "Antibiotics"
                : c === t.pharmacy.analgesics ? "Analgesics"
                : c === t.pharmacy.antihypertensives ? "Antihypertensives"
                : c === t.pharmacy.antidiabetics ? "Antidiabetics"
                : c === t.pharmacy.cardiovascular ? "Cardiovascular"
                : c === t.pharmacy.respiratory ? "Respiratory"
                : c === t.pharmacy.gastrointestinal ? "Gastrointestinal"
                : c === t.pharmacy.vitamins ? "Vitamins & Supplements"
                : c === t.pharmacy.dermatology ? "Dermatology"
                : c === t.pharmacy.other ? "Other"
                : c}>
                {c === "ALL" ? t.pharmacy.allCategories : c}
              </option>
            ))}
          </select>

          {/* Stock status */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StockFilter); setPage(1); }}
            className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3]"
          >
            <option value="ALL">{t.pharmacy.allStatuses}</option>
            {(Object.keys(STOCK_STYLES) as StockStatus[]).map((s) => (
              <option key={s} value={s}>{STOCK_STYLES[s].label}</option>
            ))}
          </select>

          {(search || categoryFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              onClick={() => { setSearch(""); setCategoryFilter("ALL"); setStatusFilter("ALL"); setPage(1); }}
              className="flex items-center gap-1.5 border border-[var(--border2)] bg-[var(--surface)] px-3 py-2.5 rounded-lg text-sm text-[var(--txt2)] hover:bg-[var(--surface2)] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              {t.pharmacy.clear}
            </button>
          )}

          <button className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] px-4 py-2.5 rounded-lg text-sm text-[var(--txt1)] hover:bg-[var(--surface2)] transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t.pharmacy.export}
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[
                  t.pharmacy.medication,
                  t.pharmacy.genericName,
                  t.pharmacy.category,
                  t.pharmacy.unit,
                  t.pharmacy.stockQty,
                  t.pharmacy.minStock,
                  t.pharmacy.reorderAt,
                  t.pharmacy.unitPrice,
                  t.pharmacy.expiry,
                  t.common.status,
                  t.pharmacy.barcode,
                  t.common.actions,
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`table-header ${
                      i === 11 ? "text-right" : i >= 4 && i <= 7 ? "text-right" : "text-left"
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
                      <p className="text-sm text-[var(--txt2)]">{t.pharmacy.loading}</p>
                    </div>
                  </td>
                </tr>
              ) : medications.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">medication</span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--txt1)]">{t.pharmacy.noMedications}</p>
                      <p className="text-xs text-[var(--txt2)]">
                        {search || categoryFilter !== "ALL" || statusFilter !== "ALL"
                          ? t.common.tryAgain
                          : t.pharmacy.addFirst}
                      </p>
                      {!search && categoryFilter === "ALL" && statusFilter === "ALL" && (
                        <Link href="/pharmacy/new" className="mt-1 text-sm text-[var(--blue)] font-semibold hover:underline">
                          {t.pharmacy.addFirstBtn}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                medications.map((med) => {
                  const stockStatus = med.stockStatus ?? med.status ?? "IN_STOCK";
                  const st = STOCK_STYLES[stockStatus as StockStatus] ?? STOCK_STYLES.IN_STOCK;
                  const isLow = stockStatus === "LOW_STOCK" || stockStatus === "CRITICAL";
                  const isOut = stockStatus === "OUT_OF_STOCK";
                  const isExpiringSoon =
                    med.expiryDate
                      ? new Date(med.expiryDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                      : false;

                  return (
                    <tr
                      key={med.id}
                      className={`transition-colors group ${
                        isOut ? st.rowBg + " opacity-80" : isLow ? st.rowBg : "hover:bg-[var(--surface2)]"
                      }`}
                    >
                      {/* Name */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {(med.isControlled) && (
                            <span
                              className="text-[10px] font-bold text-[var(--err)] bg-[var(--err-bg)] px-1.5 py-0.5 rounded"
                              title={t.pharmacy.controlled}
                            >
                              Ctrl
                            </span>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-[var(--txt1)] group-hover:text-[var(--blue)] transition-colors">
                              {med.brandName ?? med.genericName}
                            </p>
                            {med.requiresPrescription && (
                              <p className="text-[10px] text-[var(--txt2)]">{t.pharmacy.rxRequired}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Generic name */}
                      <td className="table-cell text-[var(--txt2)] max-w-[120px] truncate">{med.genericName || "—"}</td>

                      {/* Category */}
                      <td className="table-cell">
                        <span className="text-xs bg-[var(--surface2)] text-[var(--txt2)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                          {med.category}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="table-cell text-[var(--txt2)] text-xs">{med.unit}</td>

                      {/* Stock Qty */}
                      <td className="table-cell text-right">
                        <span className={`text-sm font-bold ${
                          isOut ? "text-[var(--err)]" : isLow ? "text-[var(--warn)]" : "text-[var(--txt1)]"
                        }`}>
                          {med.stockQuantity.toLocaleString()}
                        </span>
                      </td>

                      {/* Min stock */}
                      <td className="table-cell text-right text-[var(--txt2)] text-sm">
                        {med.minStockLevel.toLocaleString()}
                      </td>

                      {/* Reorder level — colored indicator */}
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-16 h-1.5 bg-[#e3e2e6] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isOut ? "bg-[var(--err)]" : isLow ? "bg-[var(--warn)]" : "bg-[var(--ok)]"
                              }`}
                              style={{
                                width: `${Math.min(100, (med.stockQuantity / Math.max(med.minStockLevel * 2, 1)) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-[var(--txt2)]">{med.minStockLevel}</span>
                        </div>
                      </td>

                      {/* Unit price */}
                      <td className="table-cell text-right text-[var(--txt2)]">
                        {formatCurrency(med.unitCost)}
                      </td>

                      {/* Expiry */}
                      <td className="table-cell whitespace-nowrap">
                        {med.expiryDate ? (
                          <span className={`text-sm ${isExpiringSoon ? "text-[var(--warn)] font-semibold" : "text-[var(--txt2)]"}`}>
                            {isExpiringSoon && (
                              <span className="material-symbols-outlined text-[13px] me-0.5 align-middle">warning</span>
                            )}
                            {formatDate(med.expiryDate)}
                          </span>
                        ) : (
                          <span className="text-[#c4c6cf]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <span className={`badge ${st.bg} ${st.text}`}>{st.label}</span>
                      </td>

                      {/* Barcode */}
                      <td className="table-cell">
                        {med.barcode ? (
                          <span className="text-xs font-mono text-[var(--txt2)] bg-[var(--surface2)] px-2 py-1 rounded border border-[var(--border)]">
                            {med.barcode}
                          </span>
                        ) : (
                          <span className="text-[#c4c6cf]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/pharmacy/${med.id}/edit`}
                            className="p-1.5 hover:bg-[var(--blue-bg)] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--blue)]"
                            title={t.common.edit}
                            aria-label={t.common.edit}
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Link>
                          <button
                            onClick={() => { setAdjustId(med.id); setAdjustQty(""); setAdjustNote(""); }}
                            className="p-1.5 hover:bg-[var(--ok-bg)] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--ok)]"
                            title={t.pharmacy.adjustStock}
                            aria-label={t.pharmacy.adjustStock}
                          >
                            <span className="material-symbols-outlined text-[18px]">tune</span>
                          </button>
                          <Link
                            href={`/pharmacy/${med.id}/history`}
                            className="p-1.5 hover:bg-[var(--blue-bg)] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--blue)]"
                            title={t.common.view}
                            aria-label={t.common.view}
                          >
                            <span className="material-symbols-outlined text-[18px]">history</span>
                          </Link>
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
          <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-xs text-[var(--txt2)]">
              {t.pharmacy.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} {t.common.of} {total} {t.pharmacy.medications}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                      page === p ? "bg-[var(--brand)] text-white" : "hover:bg-[var(--surface2)] text-[var(--txt2)]"
                    }`}
                  >
                    {p}
                  </button>
                ) : null;
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Adjust Stock modal ── */}
      {adjustId && adjustMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl border border-[var(--border)] shadow-[var(--sh-xl)] p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--txt1)]">{t.pharmacy.adjustStock}</h3>
              <button
                onClick={() => setAdjustId(null)}
                aria-label="Close"
                className="p-1.5 hover:bg-[var(--surface2)] rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-[var(--txt2)]">close</span>
              </button>
            </div>

            <div className="mb-5 p-3 bg-[var(--surface2)] rounded-xl">
              <p className="text-sm font-bold text-[var(--txt1)]">{adjustMed.brandName ?? adjustMed.genericName}</p>
              <p className="text-xs text-[var(--txt2)]">
                Current stock: <span className="font-semibold text-[var(--txt1)]">{adjustMed.stockQuantity} {adjustMed.unit}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">
                  {t.pharmacy.adjQty}
                </label>
                <p className="text-[10px] text-[var(--txt2)] mb-2">{t.pharmacy.adjHint}</p>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="input-field"
                  placeholder={t.pharmacy.adjExample}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">
                  {t.pharmacy.adjReason}
                </label>
                <textarea
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder={t.pharmacy.adjReasonExample}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAdjustId(null)}
                className="flex-1 border border-[var(--border2)] bg-[var(--surface)] text-[var(--txt1)] py-2.5 rounded-lg text-sm font-semibold hover:bg-[var(--surface2)] transition-colors"
              >
                {t.pharmacy.cancel}
              </button>
              <button
                onClick={handleAdjustStock}
                disabled={!adjustQty || adjusting}
                className="flex-1 bg-[var(--brand)] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {adjusting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    {t.pharmacy.saving}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    {t.pharmacy.saveAdj}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pharmacy stat card ── */
function PharmStatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  onClick,
}: {
  label: string;
  value: string | null;
  icon: string;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-5 ${
        onClick ? "cursor-pointer hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
        </div>
        {onClick && (
          <span className="material-symbols-outlined text-[16px] text-[var(--txt2)]">arrow_forward</span>
        )}
      </div>
      {value === null ? (
        <div className="h-7 w-16 bg-[var(--surface2)] rounded animate-pulse mb-1"></div>
      ) : (
        <p className="text-2xl font-bold text-[var(--txt1)] tabular-nums">{value}</p>
      )}
      <p className="text-xs text-[var(--txt2)] mt-1 font-medium">{label}</p>
    </div>
  );
}

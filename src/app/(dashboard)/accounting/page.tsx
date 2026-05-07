"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { PurchaseOrder, Vendor, Asset } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// ─── Local types ──────────────────────────────────────────────────────────────

interface AccountingOverview {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  accountsReceivable: number;
  accountsPayable: number;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  approvedBy?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hasReceipt: boolean;
}

// ─── Helper components ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3 py-20">
      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
      <p className="text-sm text-[#74777f]">Loading…</p>
    </div>
  );
}

function EmptyRow({ cols, icon, label, sub }: { cols: number; icon: string; label: string; sub?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-20 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[#74777f] text-3xl">{icon}</span>
          </div>
          <p className="text-sm font-semibold text-[#1a1c1e]">{label}</p>
          {sub && <p className="text-xs text-[#74777f]">{sub}</p>}
        </div>
      </td>
    </tr>
  );
}

function KpiCard({ icon, iconBg, iconColor, label, value, sub }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 ${iconBg} rounded-2xl`}>
          <span className={`material-symbols-outlined ${iconColor} text-[22px]`}>{icon}</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#1a1c1e]">{value}</p>
      {sub && <p className="text-xs text-[#74777f] mt-0.5">{sub}</p>}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`material-symbols-outlined text-[14px] ${i <= rating ? "text-[#d97706]" : "text-[#e3e2e6]"}`}>
          star
        </span>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const { t } = useLanguage();

  type Tab = "overview" | "purchaseOrders" | "vendors" | "expenses" | "assets";
  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",       label: t.accounting.overview },
    { key: "purchaseOrders", label: t.accounting.purchaseOrders },
    { key: "vendors",        label: t.accounting.vendors },
    { key: "expenses",       label: t.accounting.expenses },
    { key: "assets",         label: t.accounting.assets },
  ];

  const PO_STATUS: Record<string, { label: string; cls: string }> = {
    DRAFT:              { label: t.accounting.draftStatus,       cls: "bg-[#e3e2e6] text-[#74777f]" },
    SUBMITTED:          { label: t.accounting.submittedStatus,   cls: "bg-[#d3e4ff] text-[#1960a3]" },
    APPROVED:           { label: t.accounting.approvedStatus,    cls: "bg-[#ccfbf1] text-[#0d9488]" },
    PARTIALLY_RECEIVED: { label: t.accounting.partialReceived,   cls: "bg-[#fff7ed] text-[#d97706]" },
    COMPLETED:          { label: t.accounting.completedStatus,   cls: "bg-[#ccfbf1] text-[#0d9488]" },
    CANCELLED:          { label: t.accounting.cancelledStatus,   cls: "bg-[#ffdad6] text-[#ba1a1a]" },
  };

  const ASSET_STATUS: Record<string, { label: string; cls: string }> = {
    ACTIVE:             { label: t.accounting.activeAsset,       cls: "bg-[#ccfbf1] text-[#0d9488]" },
    UNDER_MAINTENANCE:  { label: t.accounting.maintenance,       cls: "bg-[#fff7ed] text-[#d97706]" },
    DISPOSED:           { label: t.accounting.disposed,          cls: "bg-[#ffdad6] text-[#ba1a1a]" },
    TRANSFERRED:        { label: t.accounting.transferred,       cls: "bg-[#d3e4ff] text-[#1960a3]" },
  };

  const EXP_STATUS: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: t.accounting.pendingExpense,  cls: "bg-[#fff7ed] text-[#d97706]" },
    APPROVED: { label: t.accounting.approvedExpense, cls: "bg-[#ccfbf1] text-[#0d9488]" },
    REJECTED: { label: t.accounting.rejectedExpense, cls: "bg-[#ffdad6] text-[#ba1a1a]" },
  };

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Overview
  const [overview, setOverview] = useState<AccountingOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Purchase Orders
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [posSearch, setPosSearch] = useState("");
  const [posStatus, setPosStatus] = useState("ALL");

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseStatus, setExpenseStatus] = useState("ALL");

  // Assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetStatus, setAssetStatus] = useState("ALL");

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch("/api/accounting/overview");
      if (res.ok) { const d = await res.json(); setOverview(d ?? null); }
    } catch { /* ignore */ } finally { setOverviewLoading(false); }
  }, []);

  const fetchPos = useCallback(async () => {
    setPosLoading(true);
    try {
      const p = new URLSearchParams({
        ...(posSearch && { search: posSearch }),
        ...(posStatus !== "ALL" && { status: posStatus }),
      });
      const res = await fetch(`/api/accounting/purchase-orders?${p}`);
      if (res.ok) { const d = await res.json(); setPos(d.data ?? []); }
    } catch { /* ignore */ } finally { setPosLoading(false); }
  }, [posSearch, posStatus]);

  const fetchVendors = useCallback(async () => {
    setVendorsLoading(true);
    try {
      const p = new URLSearchParams({ ...(vendorSearch && { search: vendorSearch }) });
      const res = await fetch(`/api/accounting/vendors?${p}`);
      if (res.ok) { const d = await res.json(); setVendors(d.data ?? []); }
    } catch { /* ignore */ } finally { setVendorsLoading(false); }
  }, [vendorSearch]);

  const fetchExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const p = new URLSearchParams({ ...(expenseStatus !== "ALL" && { status: expenseStatus }) });
      const res = await fetch(`/api/accounting/expenses?${p}`);
      if (res.ok) { const d = await res.json(); setExpenses(d.data ?? []); }
    } catch { /* ignore */ } finally { setExpensesLoading(false); }
  }, [expenseStatus]);

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const p = new URLSearchParams({
        ...(assetSearch && { search: assetSearch }),
        ...(assetStatus !== "ALL" && { status: assetStatus }),
      });
      const res = await fetch(`/api/accounting/assets?${p}`);
      if (res.ok) { const d = await res.json(); setAssets(d.data ?? []); }
    } catch { /* ignore */ } finally { setAssetsLoading(false); }
  }, [assetSearch, assetStatus]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { if (activeTab === "purchaseOrders") fetchPos(); }, [activeTab, fetchPos]);
  useEffect(() => { if (activeTab === "vendors") fetchVendors(); }, [activeTab, fetchVendors]);
  useEffect(() => { if (activeTab === "expenses") fetchExpenses(); }, [activeTab, fetchExpenses]);
  useEffect(() => { if (activeTab === "assets") fetchAssets(); }, [activeTab, fetchAssets]);

  // ── PO actions ─────────────────────────────────────────────────────────────

  async function handleApprovePO(id: string) {
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${id}/approve`, { method: "POST" });
      if (res.ok) fetchPos();
    } catch { /* ignore */ }
  }

  async function handleReceivePO(id: string) {
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${id}/receive`, { method: "POST" });
      if (res.ok) fetchPos();
    } catch { /* ignore */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.accounting.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.accounting.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/accounting/expenses/new"
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">receipt</span>
            {t.accounting.logExpense}
          </Link>
          <Link
            href="/accounting/vendors/new"
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">store</span>
            {t.accounting.addVendor}
          </Link>
          <Link
            href="/accounting/purchase-orders/new"
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t.accounting.newPO}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#e3e2e6]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-[#002045] text-[#002045]"
                : "border-transparent text-[#74777f] hover:text-[#1a1c1e]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {overviewLoading ? (
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-8"><Spinner /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard icon="trending_up" iconBg="bg-[#ccfbf1]" iconColor="text-[#0d9488]" label={t.accounting.totalRevenue} value={overview ? formatCurrency(overview.totalRevenue) : "—"} />
                <KpiCard icon="trending_down" iconBg="bg-[#ffdad6]" iconColor="text-[#ba1a1a]" label={t.accounting.totalExpenses} value={overview ? formatCurrency(overview.totalExpenses) : "—"} />
                <KpiCard icon="account_balance" iconBg="bg-[#d3e4ff]" iconColor="text-[#1960a3]" label={t.accounting.netProfit} value={overview ? formatCurrency(overview.netProfit) : "—"} sub={overview && overview.netProfit >= 0 ? t.accounting.profitable : t.accounting.loss} />
                <KpiCard icon="move_to_inbox" iconBg="bg-[#fff7ed]" iconColor="text-[#d97706]" label={t.accounting.accountsReceivable} value={overview ? formatCurrency(overview.accountsReceivable) : "—"} />
                <KpiCard icon="outbox" iconBg="bg-[#ffddba]" iconColor="text-[#633f0f]" label={t.accounting.accountsPayable} value={overview ? formatCurrency(overview.accountsPayable) : "—"} />
              </div>

              {/* Chart placeholder */}
              <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1a1c1e]">{t.accounting.revenueVsExpenses}</h3>
                    <p className="text-xs text-[#74777f]">{t.accounting.monthlyTrend}</p>
                  </div>
                  <Link href="/reports?tab=financial" className="text-xs text-[#1960a3] font-semibold hover:underline flex items-center gap-1">
                    {t.accounting.fullReport} <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </Link>
                </div>
                <div className="h-56 bg-[#faf9fd] rounded-lg border border-[#e3e2e6] flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">bar_chart</span>
                  <p className="text-sm text-[#74777f]">Connect to DB for financial charts</p>
                  <p className="text-xs text-[#c4c6cf]">Data will populate from /api/accounting/revenue-trend</p>
                </div>
              </div>

              {/* Quick report links */}
              <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
                <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{t.accounting.quickReports}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t.accounting.plStatement,   icon: "description",    href: "/reports?report=pl" },
                    { label: t.accounting.balanceSheet,  icon: "account_balance",href: "/reports?report=balance" },
                    { label: t.accounting.cashFlow,      icon: "waterfall_chart",href: "/reports?report=cashflow" },
                    { label: t.accounting.arAging,       icon: "move_to_inbox",  href: "/reports?report=ar" },
                  ].map((r) => (
                    <Link
                      key={r.label}
                      href={r.href}
                      className="flex items-center gap-3 p-3 bg-[#f4f3f7] rounded-xl hover:bg-[#e9e7eb] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[#1960a3] text-[20px]">{r.icon}</span>
                      <span className="text-sm font-semibold text-[#1a1c1e]">{r.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Purchase Orders ── */}
      {activeTab === "purchaseOrders" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder={t.accounting.searchPOs}
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
              />
            </div>
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={posStatus}
              onChange={(e) => setPosStatus(e.target.value)}
            >
              <option value="ALL">{t.accounting.allStatuses}</option>
              <option value="DRAFT">{t.accounting.draftStatus}</option>
              <option value="SUBMITTED">{t.accounting.submittedStatus}</option>
              <option value="APPROVED">{t.accounting.approvedStatus}</option>
              <option value="PARTIALLY_RECEIVED">{t.accounting.partialReceived}</option>
              <option value="COMPLETED">{t.accounting.completedStatus}</option>
              <option value="CANCELLED">{t.accounting.cancelledStatus}</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {[t.accounting.poId, t.accounting.vendor, t.accounting.date, t.accounting.expectedDelivery, t.accounting.items, t.common.total, t.accounting.poStatus, t.accounting.poActions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posLoading ? (
                    <tr><td colSpan={8}><Spinner /></td></tr>
                  ) : pos.length === 0 ? (
                    <EmptyRow cols={8} icon="shopping_cart" label={t.accounting.noPOs} sub={t.accounting.noPOsDesc} />
                  ) : pos.map((po) => {
                    const sc = PO_STATUS[po.status] ?? PO_STATUS.DRAFT;
                    return (
                      <tr key={po.id} className="hover:bg-[#f4f3f7] transition-colors border-b border-[#e3e2e6]">
                        <td className="px-5 py-4">
                          <span className="text-xs font-mono font-semibold text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded">{po.id.slice(0, 8).toUpperCase()}</span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-[#1a1c1e]">{po.vendor.name}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#43474e] whitespace-nowrap">{formatDate(po.date)}</td>
                        <td className="px-5 py-4 text-sm text-[#43474e] whitespace-nowrap">
                          {po.expectedDelivery ? formatDate(po.expectedDelivery) : "—"}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#43474e] text-center">{po.items.length}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#1a1c1e]">{formatCurrency(po.totalAmount)}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Link href={`/accounting/purchase-orders/${po.id}`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title={t.accounting.viewPO}>
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </Link>
                            {po.status === "SUBMITTED" && (
                              <button onClick={() => handleApprovePO(po.id)} className="p-1.5 hover:bg-[#ccfbf1] rounded-lg transition-colors text-[#74777f] hover:text-[#0d9488]" title={t.accounting.approvePO}>
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                              </button>
                            )}
                            {(po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED") && (
                              <button onClick={() => handleReceivePO(po.id)} className="p-1.5 hover:bg-[#fff7ed] rounded-lg transition-colors text-[#74777f] hover:text-[#d97706]" title={t.accounting.receiveGoods}>
                                <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Vendors ── */}
      {activeTab === "vendors" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder={t.accounting.searchVendors}
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {[t.accounting.vendor, t.accounting.contactPerson, t.common.phone, t.common.email, t.accounting.paymentTerms, t.accounting.rating, t.common.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorsLoading ? (
                    <tr><td colSpan={7}><Spinner /></td></tr>
                  ) : vendors.length === 0 ? (
                    <EmptyRow cols={7} icon="store" label={t.accounting.noVendors} sub={t.accounting.noVendorsDesc} />
                  ) : vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-[#f4f3f7] transition-colors border-b border-[#e3e2e6]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1960a3] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {getInitials(v.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1a1c1e] flex items-center gap-2">
                              {v.name}
                              {v.isPreferred && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#d3e4ff] text-[#1960a3] rounded-full uppercase tracking-wider">{t.accounting.preferred}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#43474e]">{v.contactPerson ?? "—"}</td>
                      <td className="px-5 py-4 text-sm text-[#43474e]">{v.phone ?? "—"}</td>
                      <td className="px-5 py-4 text-sm text-[#43474e]">{v.email ?? "—"}</td>
                      <td className="px-5 py-4 text-sm text-[#43474e]">{v.paymentTerms ?? "—"}</td>
                      <td className="px-5 py-4">
                        {v.rating != null ? <StarRating rating={v.rating} /> : <span className="text-xs text-[#74777f]">No rating</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/accounting/vendors/${v.id}`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="View">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </Link>
                          <Link href={`/accounting/vendors/${v.id}/edit`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="Edit">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Link>
                          <Link href={`/accounting/purchase-orders/new?vendor=${v.id}`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="Create PO">
                            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Expenses ── */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex gap-3">
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={expenseStatus}
              onChange={(e) => setExpenseStatus(e.target.value)}
            >
              <option value="ALL">{t.accounting.allExpenses}</option>
              <option value="PENDING">{t.accounting.pendingExpense}</option>
              <option value="APPROVED">{t.accounting.approvedExpense}</option>
              <option value="REJECTED">{t.accounting.rejectedExpense}</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {[t.accounting.expenseDate, t.accounting.category, t.accounting.description, t.accounting.amount, t.accounting.approvedBy, t.accounting.expenseStatus, t.accounting.receipt].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expensesLoading ? (
                    <tr><td colSpan={7}><Spinner /></td></tr>
                  ) : expenses.length === 0 ? (
                    <EmptyRow cols={7} icon="receipt" label={t.accounting.noExpenses} sub={t.accounting.noExpensesDesc} />
                  ) : expenses.map((exp) => {
                    const sc = EXP_STATUS[exp.status] ?? EXP_STATUS.PENDING;
                    return (
                      <tr key={exp.id} className="hover:bg-[#f4f3f7] transition-colors border-b border-[#e3e2e6]">
                        <td className="px-5 py-4 text-sm text-[#43474e] whitespace-nowrap">{formatDate(exp.date)}</td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold bg-[#f4f3f7] text-[#43474e] px-2 py-1 rounded">{exp.category}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#1a1c1e] max-w-xs">
                          <p className="truncate">{exp.description}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#1a1c1e]">{formatCurrency(exp.amount)}</td>
                        <td className="px-5 py-4 text-sm text-[#43474e]">{exp.approvedBy ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="px-5 py-4">
                          {exp.hasReceipt ? (
                            <span className="flex items-center gap-1 text-xs text-[#0d9488] font-semibold">
                              <span className="material-symbols-outlined text-[16px]">attach_file</span>
                              {t.accounting.attached}
                            </span>
                          ) : (
                            <span className="text-xs text-[#74777f]">{t.accounting.noReceipt}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Assets ── */}
      {activeTab === "assets" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder={t.accounting.searchAssets}
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
              />
            </div>
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={assetStatus}
              onChange={(e) => setAssetStatus(e.target.value)}
            >
              <option value="ALL">{t.accounting.allStatuses}</option>
              <option value="ACTIVE">{t.accounting.activeAsset}</option>
              <option value="UNDER_MAINTENANCE">{t.accounting.underMaintenance}</option>
              <option value="DISPOSED">{t.accounting.disposed}</option>
              <option value="TRANSFERRED">{t.accounting.transferred}</option>
            </select>
            <Link
              href="/accounting/assets/new"
              className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t.accounting.addAsset}
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {[t.accounting.asset, t.accounting.assetCategory, t.accounting.serial, t.accounting.purchaseCost, t.accounting.currentValue, t.accounting.location, t.accounting.assignedTo, t.accounting.warranty, t.common.status, t.common.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assetsLoading ? (
                    <tr><td colSpan={10}><Spinner /></td></tr>
                  ) : assets.length === 0 ? (
                    <EmptyRow cols={10} icon="inventory_2" label={t.accounting.noAssets} sub={t.accounting.noAssetsDesc} />
                  ) : assets.map((asset) => {
                    const sc = ASSET_STATUS[asset.status] ?? ASSET_STATUS.ACTIVE;
                    const warrantyExpired = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) < new Date() : false;
                    return (
                      <tr key={asset.id} className="hover:bg-[#f4f3f7] transition-colors border-b border-[#e3e2e6]">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-[#1a1c1e]">{asset.name}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold bg-[#f4f3f7] text-[#43474e] px-2 py-1 rounded">{asset.category}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-mono text-[#43474e]">{asset.serialNumber ?? "—"}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#43474e]">{asset.purchasePrice != null ? formatCurrency(asset.purchasePrice) : "—"}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#1a1c1e]">{asset.currentValue != null ? formatCurrency(asset.currentValue) : "—"}</td>
                        <td className="px-5 py-4 text-sm text-[#43474e]">{asset.location ?? "—"}</td>
                        <td className="px-5 py-4 text-sm text-[#43474e]">{asset.department?.name ?? "Unassigned"}</td>
                        <td className="px-5 py-4">
                          {asset.warrantyExpiry ? (
                            <span className={`text-xs font-semibold ${warrantyExpired ? "text-[#ba1a1a]" : "text-[#0d9488]"}`}>
                              {warrantyExpired ? t.accounting.expired : formatDate(asset.warrantyExpiry)}
                            </span>
                          ) : <span className="text-xs text-[#74777f]">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Link href={`/accounting/assets/${asset.id}`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="View">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </Link>
                            <Link href={`/accounting/assets/${asset.id}/edit`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="Edit">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

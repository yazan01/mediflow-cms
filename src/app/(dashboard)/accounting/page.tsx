"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { PurchaseOrder, Vendor, Asset } from "@/types";

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

// ─── Status configs ───────────────────────────────────────────────────────────

const PO_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT:              { label: "Draft",               cls: "bg-[#e3e2e6] text-[#74777f]" },
  SUBMITTED:          { label: "Submitted",           cls: "bg-[#d3e4ff] text-[#1960a3]" },
  APPROVED:           { label: "Approved",            cls: "bg-[#ccfbf1] text-[#0d9488]" },
  PARTIALLY_RECEIVED: { label: "Partial Received",    cls: "bg-[#fff7ed] text-[#d97706]" },
  COMPLETED:          { label: "Completed",           cls: "bg-[#ccfbf1] text-[#0d9488]" },
  CANCELLED:          { label: "Cancelled",           cls: "bg-[#ffdad6] text-[#ba1a1a]" },
};

const ASSET_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE:             { label: "Active",              cls: "bg-[#ccfbf1] text-[#0d9488]" },
  UNDER_MAINTENANCE:  { label: "Maintenance",         cls: "bg-[#fff7ed] text-[#d97706]" },
  DISPOSED:           { label: "Disposed",            cls: "bg-[#ffdad6] text-[#ba1a1a]" },
  TRANSFERRED:        { label: "Transferred",         cls: "bg-[#d3e4ff] text-[#1960a3]" },
};

const EXP_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: "Pending",  cls: "bg-[#fff7ed] text-[#d97706]" },
  APPROVED: { label: "Approved", cls: "bg-[#ccfbf1] text-[#0d9488]" },
  REJECTED: { label: "Rejected", cls: "bg-[#ffdad6] text-[#ba1a1a]" },
};

const TABS = ["Overview", "Purchase Orders", "Vendors", "Expenses", "Assets"] as const;
type Tab = (typeof TABS)[number];

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
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

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
  useEffect(() => { if (activeTab === "Purchase Orders") fetchPos(); }, [activeTab, fetchPos]);
  useEffect(() => { if (activeTab === "Vendors") fetchVendors(); }, [activeTab, fetchVendors]);
  useEffect(() => { if (activeTab === "Expenses") fetchExpenses(); }, [activeTab, fetchExpenses]);
  useEffect(() => { if (activeTab === "Assets") fetchAssets(); }, [activeTab, fetchAssets]);

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
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Accounting &amp; Finance</h1>
          <p className="text-sm text-[#74777f] mt-0.5">Manage purchase orders, vendors, expenses and assets</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/accounting/expenses/new"
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">receipt</span>
            Log Expense
          </Link>
          <Link
            href="/accounting/vendors/new"
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">store</span>
            Add Vendor
          </Link>
          <Link
            href="/accounting/purchase-orders/new"
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New PO
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#e3e2e6]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-[#002045] text-[#002045]"
                : "border-transparent text-[#74777f] hover:text-[#1a1c1e]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === "Overview" && (
        <div className="space-y-6">
          {overviewLoading ? (
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-8"><Spinner /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard icon="trending_up" iconBg="bg-[#ccfbf1]" iconColor="text-[#0d9488]" label="Total Revenue" value={overview ? formatCurrency(overview.totalRevenue) : "—"} />
                <KpiCard icon="trending_down" iconBg="bg-[#ffdad6]" iconColor="text-[#ba1a1a]" label="Total Expenses" value={overview ? formatCurrency(overview.totalExpenses) : "—"} />
                <KpiCard icon="account_balance" iconBg="bg-[#d3e4ff]" iconColor="text-[#1960a3]" label="Net Profit" value={overview ? formatCurrency(overview.netProfit) : "—"} sub={overview && overview.netProfit >= 0 ? "Profitable" : "Loss"} />
                <KpiCard icon="move_to_inbox" iconBg="bg-[#fff7ed]" iconColor="text-[#d97706]" label="Accounts Receivable" value={overview ? formatCurrency(overview.accountsReceivable) : "—"} />
                <KpiCard icon="outbox" iconBg="bg-[#ffddba]" iconColor="text-[#633f0f]" label="Accounts Payable" value={overview ? formatCurrency(overview.accountsPayable) : "—"} />
              </div>

              {/* Chart placeholder */}
              <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1a1c1e]">Revenue vs Expenses</h3>
                    <p className="text-xs text-[#74777f]">Monthly trend — current fiscal year</p>
                  </div>
                  <Link href="/reports?tab=financial" className="text-xs text-[#1960a3] font-semibold hover:underline flex items-center gap-1">
                    Full Report <span className="material-symbols-outlined text-[14px]">open_in_new</span>
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
                <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">Quick Report Links</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "P&L Statement",   icon: "description",    href: "/reports?report=pl" },
                    { label: "Balance Sheet",    icon: "account_balance",href: "/reports?report=balance" },
                    { label: "Cash Flow",        icon: "waterfall_chart",href: "/reports?report=cashflow" },
                    { label: "AR Aging",         icon: "move_to_inbox",  href: "/reports?report=ar" },
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
      {activeTab === "Purchase Orders" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder="Search PO ID or vendor…"
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
              />
            </div>
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={posStatus}
              onChange={(e) => setPosStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="PARTIALLY_RECEIVED">Partial Received</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {["PO ID", "Vendor", "Date", "Expected Delivery", "Items", "Total", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posLoading ? (
                    <tr><td colSpan={8}><Spinner /></td></tr>
                  ) : pos.length === 0 ? (
                    <EmptyRow cols={8} icon="shopping_cart" label="No purchase orders found" sub="Create your first PO using the New PO button" />
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
                            <Link href={`/accounting/purchase-orders/${po.id}`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="View">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </Link>
                            {po.status === "SUBMITTED" && (
                              <button onClick={() => handleApprovePO(po.id)} className="p-1.5 hover:bg-[#ccfbf1] rounded-lg transition-colors text-[#74777f] hover:text-[#0d9488]" title="Approve">
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                              </button>
                            )}
                            {(po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED") && (
                              <button onClick={() => handleReceivePO(po.id)} className="p-1.5 hover:bg-[#fff7ed] rounded-lg transition-colors text-[#74777f] hover:text-[#d97706]" title="Receive Goods">
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
      {activeTab === "Vendors" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder="Search vendors…"
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
                    {["Vendor", "Contact Person", "Phone", "Email", "Payment Terms", "Rating", "Actions"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorsLoading ? (
                    <tr><td colSpan={7}><Spinner /></td></tr>
                  ) : vendors.length === 0 ? (
                    <EmptyRow cols={7} icon="store" label="No vendors found" sub="Add your first vendor using the Add Vendor button" />
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
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#d3e4ff] text-[#1960a3] rounded-full uppercase tracking-wider">Preferred</span>
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
      {activeTab === "Expenses" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex gap-3">
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={expenseStatus}
              onChange={(e) => setExpenseStatus(e.target.value)}
            >
              <option value="ALL">All Expenses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {["Date", "Category", "Description", "Amount", "Approved By", "Status", "Receipt"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expensesLoading ? (
                    <tr><td colSpan={7}><Spinner /></td></tr>
                  ) : expenses.length === 0 ? (
                    <EmptyRow cols={7} icon="receipt" label="No expenses logged" sub="Use Log Expense to record business expenses" />
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
                              Attached
                            </span>
                          ) : (
                            <span className="text-xs text-[#74777f]">None</span>
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
      {activeTab === "Assets" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder="Search assets by name or serial…"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
              />
            </div>
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={assetStatus}
              onChange={(e) => setAssetStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="DISPOSED">Disposed</option>
              <option value="TRANSFERRED">Transferred</option>
            </select>
            <Link
              href="/accounting/assets/new"
              className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Asset
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {["Asset", "Category", "Serial #", "Purchase Cost", "Current Value", "Location", "Assigned To", "Warranty", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assetsLoading ? (
                    <tr><td colSpan={10}><Spinner /></td></tr>
                  ) : assets.length === 0 ? (
                    <EmptyRow cols={10} icon="inventory_2" label="No assets registered" sub="Register clinic assets to track depreciation and maintenance" />
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
                              {warrantyExpired ? "Expired" : formatDate(asset.warrantyExpiry)}
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

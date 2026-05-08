"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { PurchaseOrder, Vendor, Asset } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ErrorBanner } from "@/components/ErrorBanner";

// ─── Local types ──────────────────────────────────────────────────────────────

interface AccountingOverview {
  totalRevenue: number; monthlyRevenue: number;
  totalExpenses: number; monthlyExpenses: number;
  netProfit: number; monthlyNetProfit: number;
  accountsReceivable: number; accountsPayable: number;
  pendingExpenses: number; overdueInvoices: number;
  revenueTrend: { month: string; revenue: number; expenses: number }[];
  recentExpenses: ExpenseItem[];
  recentInvoices: { id: string; invoiceNo: string; totalAmount: number; balance: number; status: string }[];
}

interface ExpenseItem {
  id: string; date: string; category: string; description: string;
  amount: number; paymentMethod?: string; referenceNo?: string;
  isRecurring?: boolean; status: "PENDING" | "APPROVED" | "REJECTED";
  vendor?: { id: string; name: string } | null;
  approvedAt?: string; approvedBy?: { name: string } | null;
  createdAt?: string;
}

interface PLReport {
  period: { from: string; to: string };
  revenue: { total: number; breakdown: { method: string; amount: number }[] };
  expenses: { total: number; breakdown: { category: string; amount: number }[] };
  grossProfit: number; grossProfitMargin: number;
}

interface AgingBucket {
  count: number; total: number;
}
interface AgingEntry {
  invoiceNo?: string; poNumber?: string;
  patient?: string; vendor?: string;
  totalAmount?: number; balance?: number;
  dueDate?: string; expectedDelivery?: string;
  status: string; ageDays: number;
}
interface AgingReport {
  summary: {
    current: AgingBucket; days1_30: AgingBucket; days31_60: AgingBucket;
    days61_90: AgingBucket; over90: AgingBucket; grandTotal: number;
  };
  detail: { current: AgingEntry[]; "1_30": AgingEntry[]; "31_60": AgingEntry[]; "61_90": AgingEntry[]; over_90: AgingEntry[] };
}

interface CashFlowReport {
  period: { from: string; to: string };
  operating: { inflows: number; outflows: number; net: number };
  investing: { assetPurchases: number; poPayments: number; net: number };
  netCashFlow: number;
}

interface DepreciationRow { year: number; depreciation: number; accumulatedDepreciation: number; bookValue: number }
interface DepreciationSchedule {
  assetId: string; assetName: string; cost: number; salvageValue: number;
  usefulLifeYears: number; depreciationMethod: string;
  schedule: DepreciationRow[]; totalDepreciation: number;
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const CARD = "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)]";
const TH = "px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase tracking-wider";
const TD = "px-4 py-3 text-sm text-[#1a1c1e]";
const INPUT = "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3]";
const BTN_SM = "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    <tr><td colSpan={cols} className="py-20 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
          <span className="material-symbols-outlined text-[#74777f] text-3xl">{icon}</span>
        </div>
        <p className="text-sm font-semibold text-[#1a1c1e]">{label}</p>
        {sub && <p className="text-xs text-[#74777f]">{sub}</p>}
      </div>
    </td></tr>
  );
}

function KpiCard({ icon, iconBg, iconColor, label, value, sub, badge }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string; sub?: string; badge?: { label: string; cls: string };
}) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 ${iconBg} rounded-2xl`}>
          <span className={`material-symbols-outlined ${iconColor} text-[22px]`}>{icon}</span>
        </div>
        {badge && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
      </div>
      <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#1a1c1e]">{value}</p>
      {sub && <p className="text-xs text-[#74777f] mt-0.5">{sub}</p>}
    </div>
  );
}

function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          onClick={() => onChange?.(i)}
          className={`material-symbols-outlined text-[18px] ${onChange ? "cursor-pointer" : ""} ${i <= rating ? "text-[#d97706]" : "text-[#e3e2e6]"}`}
        >star</span>
      ))}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl flex flex-col ${wide ? "w-full max-w-4xl" : "w-full max-w-lg"} max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6] z-10">
          <h2 className="text-lg font-bold text-[#1a1c1e]">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors" aria-label="Close">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const { t } = useLanguage();

  type Tab = "overview" | "purchaseOrders" | "vendors" | "expenses" | "assets" | "reports";
  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",       label: t.accounting.overview },
    { key: "purchaseOrders", label: t.accounting.purchaseOrders },
    { key: "vendors",        label: t.accounting.vendors },
    { key: "expenses",       label: t.accounting.expenses },
    { key: "assets",         label: t.accounting.assets },
    { key: "reports",        label: t.accounting.reports },
  ];

  const PO_STATUS: Record<string, { label: string; cls: string }> = {
    DRAFT:              { label: t.accounting.draftStatus,       cls: "bg-[#e3e2e6] text-[#74777f]" },
    SUBMITTED:          { label: t.accounting.submittedStatus,   cls: "bg-[#d3e4ff] text-[#1960a3]" },
    APPROVED:           { label: t.accounting.approvedStatus,    cls: "bg-[#ccfbf1] text-[#0d9488]" },
    PARTIALLY_RECEIVED: { label: t.accounting.partialReceived,   cls: "bg-[#fff7ed] text-[#d97706]" },
    COMPLETED:          { label: t.accounting.completedStatus,   cls: "bg-[#e3e2e6] text-[#43474e]" },
    CANCELLED:          { label: t.accounting.cancelledStatus,   cls: "bg-[#ffdad6] text-[#ba1a1a]" },
  };
  const ASSET_STATUS: Record<string, { label: string; cls: string }> = {
    ACTIVE:            { label: t.accounting.activeAsset,  cls: "bg-[#ccfbf1] text-[#0d9488]" },
    UNDER_MAINTENANCE: { label: t.accounting.maintenance,  cls: "bg-[#fff7ed] text-[#d97706]" },
    DISPOSED:          { label: t.accounting.disposed,     cls: "bg-[#ffdad6] text-[#ba1a1a]" },
    TRANSFERRED:       { label: t.accounting.transferred,  cls: "bg-[#d3e4ff] text-[#1960a3]" },
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
  const [fetchError, setFetchError] = useState<Error | null>(null);

  // POs
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [posStatus, setPosStatus] = useState("ALL");
  const [actionPO, setActionPO] = useState<PurchaseOrder | null>(null);
  const [poAction, setPoAction] = useState<"receive" | "view" | null>(null);
  const [receiveItems, setReceiveItems] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({});
  const [vendorSaving, setVendorSaving] = useState(false);

  // Expenses
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseStatus, setExpenseStatus] = useState("ALL");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [actionExpense, setActionExpense] = useState<ExpenseItem | null>(null);

  // Assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetStatus, setAssetStatus] = useState("ALL");
  const [viewAsset, setViewAsset] = useState<Asset | null>(null);
  const [deprSchedule, setDeprSchedule] = useState<DepreciationSchedule | null>(null);
  const [deprLoading, setDeprLoading] = useState(false);

  // Reports
  type ReportTab = "pl" | "ar" | "ap" | "cf";
  const [reportTab, setReportTab] = useState<ReportTab>("pl");
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [plReport, setPlReport] = useState<PLReport | null>(null);
  const [arReport, setArReport] = useState<AgingReport | null>(null);
  const [apReport, setApReport] = useState<AgingReport | null>(null);
  const [cfReport, setCfReport] = useState<CashFlowReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/accounting/overview");
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      setOverview(await res.json());
    } catch (err) { setFetchError(err as Error); }
    finally { setOverviewLoading(false); }
  }, []);

  const fetchPos = useCallback(async () => {
    setPosLoading(true);
    try {
      const p = new URLSearchParams({ ...(posStatus !== "ALL" && { status: posStatus }), pageSize: "50" });
      const res = await fetch(`/api/accounting/purchase-orders?${p}`);
      if (res.ok) { const d = await res.json(); setPos(d.data ?? []); }
    } catch { /* ignore */ } finally { setPosLoading(false); }
  }, [posStatus]);

  const fetchVendors = useCallback(async () => {
    setVendorsLoading(true);
    try {
      const p = new URLSearchParams({ ...(vendorSearch && { search: vendorSearch }), pageSize: "100" });
      const res = await fetch(`/api/accounting/vendors?${p}`);
      if (res.ok) { const d = await res.json(); setVendors(d.data ?? []); }
    } catch { /* ignore */ } finally { setVendorsLoading(false); }
  }, [vendorSearch]);

  const fetchExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const p = new URLSearchParams({
        ...(expenseStatus !== "ALL" && { status: expenseStatus }),
        ...(expenseSearch && { search: expenseSearch }),
        pageSize: "50",
      });
      const res = await fetch(`/api/accounting/expenses?${p}`);
      if (res.ok) { const d = await res.json(); setExpenses(d.data ?? []); }
    } catch { /* ignore */ } finally { setExpensesLoading(false); }
  }, [expenseStatus, expenseSearch]);

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const p = new URLSearchParams({
        ...(assetSearch && { search: assetSearch }),
        ...(assetStatus !== "ALL" && { status: assetStatus }),
        pageSize: "50",
      });
      const res = await fetch(`/api/accounting/assets?${p}`);
      if (res.ok) { const d = await res.json(); setAssets(d.data ?? []); }
    } catch { /* ignore */ } finally { setAssetsLoading(false); }
  }, [assetSearch, assetStatus]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { if (activeTab === "purchaseOrders") fetchPos(); }, [activeTab, fetchPos]);
  useEffect(() => { if (activeTab === "vendors") fetchVendors(); }, [activeTab, fetchVendors]);
  useEffect(() => { if (activeTab === "expenses") fetchExpenses(); }, [activeTab, fetchExpenses]);
  useEffect(() => { if (activeTab === "assets") fetchAssets(); }, [activeTab, fetchAssets]);

  // ── PO actions ────────────────────────────────────────────────────────────

  async function poActionCall(poId: string, action: "submit" | "approve" | "cancel") {
    setActionLoading(true); setActionError("");
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${poId}/${action}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail ?? "Action failed");
      fetchPos();
      setActionPO(null); setPoAction(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error");
    } finally { setActionLoading(false); }
  }

  async function submitReceive(poId: string) {
    setActionLoading(true); setActionError("");
    try {
      const items = Object.entries(receiveItems).map(([itemId, receivedQty]) => ({ itemId, receivedQty }));
      const res = await fetch(`/api/accounting/purchase-orders/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail ?? "Receive failed");
      fetchPos();
      setActionPO(null); setPoAction(null); setReceiveItems({});
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error");
    } finally { setActionLoading(false); }
  }

  // ── Expense actions ───────────────────────────────────────────────────────

  async function expenseAction(id: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`/api/accounting/expenses/${id}/${action}`, { method: "POST" });
      if (res.ok) { fetchExpenses(); fetchOverview(); setActionExpense(null); }
    } catch { /* ignore */ }
  }

  // ── Vendor edit ───────────────────────────────────────────────────────────

  async function saveVendor() {
    if (!editVendor) return;
    setVendorSaving(true);
    try {
      const res = await fetch(`/api/accounting/vendors/${editVendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorForm),
      });
      if (res.ok) { fetchVendors(); setEditVendor(null); }
    } catch { /* ignore */ } finally { setVendorSaving(false); }
  }

  // ── Asset depreciation ────────────────────────────────────────────────────

  async function loadDepreciation(assetId: string) {
    setDeprLoading(true); setDeprSchedule(null);
    try {
      const res = await fetch(`/api/accounting/assets/${assetId}/depreciation`);
      if (res.ok) setDeprSchedule(await res.json());
    } catch { /* ignore */ } finally { setDeprLoading(false); }
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async function generateReport() {
    setReportLoading(true);
    try {
      if (reportTab === "pl") {
        const res = await fetch(`/api/accounting/reports/profit-loss?from_date=${reportFrom}&to_date=${reportTo}`);
        if (res.ok) setPlReport(await res.json());
      } else if (reportTab === "ar") {
        const res = await fetch("/api/accounting/reports/ar-aging");
        if (res.ok) setArReport(await res.json());
      } else if (reportTab === "ap") {
        const res = await fetch("/api/accounting/reports/ap-aging");
        if (res.ok) setApReport(await res.json());
      } else if (reportTab === "cf") {
        const res = await fetch(`/api/accounting/reports/cash-flow?from_date=${reportFrom}&to_date=${reportTo}`);
        if (res.ok) setCfReport(await res.json());
      }
    } catch { /* ignore */ } finally { setReportLoading(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.accounting.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.accounting.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab("expenses")} className="flex items-center gap-2 px-4 py-2.5 border border-[#c4c6cf] rounded-lg bg-white text-sm font-semibold text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">receipt</span>{t.accounting.logExpense}
          </button>
          <button onClick={() => setActiveTab("vendors")} className="flex items-center gap-2 px-4 py-2.5 border border-[#c4c6cf] rounded-lg bg-white text-sm font-semibold text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">business</span>{t.accounting.addVendor}
          </button>
          <Link href="/accounting/purchase-orders/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#002045] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>{t.accounting.newPO}
          </Link>
        </div>
      </div>

      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchOverview} />}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-[#f4f3f7] p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.key ? "bg-white text-[#002045] shadow-sm" : "text-[#74777f] hover:text-[#1a1c1e]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          OVERVIEW TAB
      ════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <>
          {overviewLoading ? <Spinner /> : overview ? (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon="payments" iconBg="bg-[#d3e4ff]" iconColor="text-[#1960a3]"
                  label={t.accounting.totalRevenue} value={formatCurrency(overview.totalRevenue)}
                  sub={`${t.accounting.monthlyRevenue}: ${formatCurrency(overview.monthlyRevenue)}`} />
                <KpiCard icon="receipt_long" iconBg="bg-[#ffdad6]" iconColor="text-[#ba1a1a]"
                  label={t.accounting.totalExpenses} value={formatCurrency(overview.totalExpenses)}
                  sub={`${t.accounting.monthlyExpenses}: ${formatCurrency(overview.monthlyExpenses)}`} />
                <KpiCard icon="trending_up" iconBg={overview.netProfit >= 0 ? "bg-[#ccfbf1]" : "bg-[#ffdad6]"} iconColor={overview.netProfit >= 0 ? "text-[#0d9488]" : "text-[#ba1a1a]"}
                  label={t.accounting.netProfit} value={formatCurrency(overview.netProfit)}
                  badge={overview.netProfit >= 0 ? { label: t.accounting.profitable, cls: "bg-[#ccfbf1] text-[#0d9488]" } : { label: t.accounting.loss, cls: "bg-[#ffdad6] text-[#ba1a1a]" }} />
                <KpiCard icon="account_balance" iconBg="bg-[#fff7ed]" iconColor="text-[#d97706]"
                  label={t.accounting.accountsReceivable} value={formatCurrency(overview.accountsReceivable)}
                  sub={`AP: ${formatCurrency(overview.accountsPayable)}`} />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`${CARD} p-5 flex items-center gap-4`}>
                  <div className="p-3 bg-[#fff7ed] rounded-2xl">
                    <span className="material-symbols-outlined text-[#d97706] text-[22px]">pending_actions</span>
                  </div>
                  <div>
                    <p className="text-xs text-[#74777f] font-semibold uppercase tracking-wider">{t.accounting.pendingApproval}</p>
                    <p className="text-2xl font-bold text-[#1a1c1e]">{overview.pendingExpenses}</p>
                  </div>
                </div>
                <div className={`${CARD} p-5 flex items-center gap-4`}>
                  <div className="p-3 bg-[#ffdad6] rounded-2xl">
                    <span className="material-symbols-outlined text-[#ba1a1a] text-[22px]">warning</span>
                  </div>
                  <div>
                    <p className="text-xs text-[#74777f] font-semibold uppercase tracking-wider">{t.accounting.overdueInvoices}</p>
                    <p className="text-2xl font-bold text-[#1a1c1e]">{overview.overdueInvoices}</p>
                  </div>
                </div>
                <div className={`${CARD} p-5 col-span-2 flex items-center justify-between gap-4`}>
                  <div>
                    <p className="text-xs text-[#74777f] font-semibold uppercase tracking-wider mb-1">{t.accounting.quickReports}</p>
                    <div className="flex gap-2 flex-wrap">
                      {([["pl", t.accounting.plStatement], ["ar", t.accounting.arAgingReport], ["ap", t.accounting.apAgingReport], ["cf", t.accounting.cashFlowReport]] as const).map(([key, label]) => (
                        <button key={key} onClick={() => { setActiveTab("reports"); setReportTab(key as ReportTab); }}
                          className="text-xs font-semibold text-[#1960a3] hover:underline">
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#e3e2e6] text-4xl">bar_chart</span>
                </div>
              </div>

              {/* Revenue vs Expenses Chart */}
              {overview.revenueTrend.length > 0 && (
                <div className={`${CARD} p-6`}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-base font-bold text-[#1a1c1e]">{t.accounting.revenueVsExpenses}</h3>
                      <p className="text-xs text-[#74777f]">{t.accounting.monthlyTrend}</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={overview.revenueTrend} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1960a3" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1960a3" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ba1a1a" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#ba1a1a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#74777f" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#74777f" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                      <Tooltip formatter={((v: any) => formatCurrency(Number(v) || 0)) as never} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name={t.accounting.totalRevenue} stroke="#1960a3" strokeWidth={2} fill="url(#gradRev)" />
                      <Area type="monotone" dataKey="expenses" name={t.accounting.totalExpenses} stroke="#ba1a1a" strokeWidth={2} fill="url(#gradExp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Recent transactions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`${CARD} p-5`}>
                  <h3 className="text-sm font-bold text-[#1a1c1e] mb-3">{t.accounting.noExpenses.replace("No", "Recent")}</h3>
                  <div className="space-y-2">
                    {overview.recentExpenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between py-2 border-b border-[#f4f3f7] last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-[#1a1c1e]">{e.description}</p>
                          <p className="text-xs text-[#74777f]">{e.category} · {formatDate(e.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#ba1a1a]">-{formatCurrency(e.amount)}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EXP_STATUS[e.status]?.cls ?? ""}`}>{EXP_STATUS[e.status]?.label ?? e.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`${CARD} p-5`}>
                  <h3 className="text-sm font-bold text-[#1a1c1e] mb-3">Recent Invoices</h3>
                  <div className="space-y-2">
                    {overview.recentInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2 border-b border-[#f4f3f7] last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-[#1a1c1e]">{inv.invoiceNo}</p>
                          <p className="text-xs text-[#74777f]">Total: {formatCurrency(inv.totalAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#1960a3]">{formatCurrency(inv.balance)}</p>
                          <p className="text-xs text-[#74777f]">{inv.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* ════════════════════════════════════════
          PURCHASE ORDERS TAB
      ════════════════════════════════════════ */}
      {activeTab === "purchaseOrders" && (
        <div className={CARD}>
          <div className="p-4 border-b border-[#e3e2e6] flex flex-wrap items-center gap-3">
            <select value={posStatus} onChange={(e) => setPosStatus(e.target.value)} className="border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm bg-white">
              <option value="ALL">{t.accounting.allStatuses}</option>
              {Object.entries(PO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex-1" />
            <Link href="/accounting/purchase-orders/new" className="flex items-center gap-1.5 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-[18px]">add</span>{t.accounting.newPO}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f4f3f7]">
                <tr>
                  <th className={TH}>{t.accounting.poId}</th>
                  <th className={TH}>{t.accounting.vendor}</th>
                  <th className={TH}>{t.accounting.date}</th>
                  <th className={TH}>{t.accounting.expectedDelivery}</th>
                  <th className={TH}>{t.accounting.items}</th>
                  <th className={TH}>{t.accounting.amount}</th>
                  <th className={TH}>{t.accounting.poStatus}</th>
                  <th className={TH}>{t.accounting.poActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f3f7]">
                {posLoading ? (
                  <tr><td colSpan={8}><Spinner /></td></tr>
                ) : pos.length === 0 ? (
                  <EmptyRow cols={8} icon="shopping_bag" label={t.accounting.noPOs} sub={t.accounting.noPOsDesc} />
                ) : pos.map((po) => {
                  const st = PO_STATUS[po.status] ?? { label: po.status, cls: "bg-[#e3e2e6] text-[#74777f]" };
                  return (
                    <tr key={po.id} className="hover:bg-[#f9f9fb] transition-colors">
                      <td className={TD}><span className="font-mono text-xs font-bold text-[#1960a3]">{po.poNumber}</span></td>
                      <td className={TD}><span className="font-semibold">{po.vendor?.name ?? "—"}</span></td>
                      <td className={TD}>{formatDate(po.date)}</td>
                      <td className={TD}>{po.expectedDelivery ? formatDate(po.expectedDelivery) : "—"}</td>
                      <td className={TD}>{po.items?.length ?? 0}</td>
                      <td className={TD}><span className="font-bold">{formatCurrency(po.totalAmount)}</span></td>
                      <td className={TD}><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                      <td className={`${TD} space-x-1`}>
                        <button onClick={() => { setActionPO(po); setPoAction("view"); }} className={`${BTN_SM} bg-[#f4f3f7] text-[#43474e] hover:bg-[#e3e2e6]`}>
                          <span className="material-symbols-outlined text-[14px]">visibility</span>{t.accounting.viewPO}
                        </button>
                        {po.status === "DRAFT" && (
                          <button onClick={() => poActionCall(po.id, "submit")} className={`${BTN_SM} bg-[#d3e4ff] text-[#1960a3] hover:bg-[#bbd4ff]`}>
                            <span className="material-symbols-outlined text-[14px]">send</span>{t.accounting.submitPO}
                          </button>
                        )}
                        {po.status === "SUBMITTED" && (
                          <button onClick={() => poActionCall(po.id, "approve")} className={`${BTN_SM} bg-[#ccfbf1] text-[#0d9488] hover:bg-[#a7f3d0]`}>
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>{t.accounting.approvePO}
                          </button>
                        )}
                        {(po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED") && (
                          <button onClick={() => {
                            setActionPO(po); setPoAction("receive");
                            const init: Record<string, number> = {};
                            po.items?.forEach((it) => { init[it.id] = 0; });
                            setReceiveItems(init);
                          }} className={`${BTN_SM} bg-[#fff7ed] text-[#d97706] hover:bg-[#fed7aa]`}>
                            <span className="material-symbols-outlined text-[14px]">inventory</span>{t.accounting.receiveGoods}
                          </button>
                        )}
                        {!["COMPLETED", "CANCELLED"].includes(po.status) && (
                          <button onClick={() => poActionCall(po.id, "cancel")} className={`${BTN_SM} bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffc8c2]`}>
                            <span className="material-symbols-outlined text-[14px]">cancel</span>{t.accounting.cancelPO}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          VENDORS TAB
      ════════════════════════════════════════ */}
      {activeTab === "vendors" && (
        <div className={CARD}>
          <div className="p-4 border-b border-[#e3e2e6] flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <span className="material-symbols-outlined absolute start-3 top-2.5 text-[#74777f] text-[18px]">search</span>
              <input value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder={t.accounting.searchVendors} className="w-full ps-9 pe-4 py-2 border border-[#c4c6cf] rounded-lg text-sm bg-white" />
            </div>
            <Link href="/accounting/vendors/new" className="flex items-center gap-1.5 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity ms-auto">
              <span className="material-symbols-outlined text-[18px]">add</span>{t.accounting.addVendor}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f4f3f7]">
                <tr>
                  <th className={TH}>{t.accounting.vendor}</th>
                  <th className={TH}>{t.accounting.contactPerson}</th>
                  <th className={TH}>{t.accounting.paymentTerms}</th>
                  <th className={TH}>{t.accounting.taxId}</th>
                  <th className={TH}>{t.accounting.rating}</th>
                  <th className={TH}>{t.accounting.poActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f3f7]">
                {vendorsLoading ? (
                  <tr><td colSpan={6}><Spinner /></td></tr>
                ) : vendors.length === 0 ? (
                  <EmptyRow cols={6} icon="business" label={t.accounting.noVendors} sub={t.accounting.noVendorsDesc} />
                ) : vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#d3e4ff] flex items-center justify-center text-xs font-bold text-[#1960a3]">
                          {getInitials(v.name)}
                        </div>
                        <div>
                          <p className="font-semibold">{v.name}</p>
                          {v.isPreferred && <span className="text-xs text-[#d97706] font-semibold">{t.accounting.preferred}</span>}
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <p>{(v as { contactPerson?: string }).contactPerson ?? "—"}</p>
                      {(v as { phone?: string }).phone && <p className="text-xs text-[#74777f]">{(v as { phone?: string }).phone}</p>}
                    </td>
                    <td className={TD}>{(v as { paymentTerms?: string }).paymentTerms ?? "—"}</td>
                    <td className={TD}>{(v as { taxId?: string }).taxId ?? "—"}</td>
                    <td className={TD}><StarRating rating={(v as { rating?: number }).rating ?? 0} /></td>
                    <td className={`${TD} space-x-1`}>
                      <button onClick={() => { setEditVendor(v); setVendorForm({ contactPerson: (v as { contactPerson?: string }).contactPerson, phone: (v as { phone?: string }).phone, email: (v as { email?: string }).email, paymentTerms: (v as { paymentTerms?: string }).paymentTerms, taxId: (v as { taxId?: string }).taxId, bankDetails: (v as { bankDetails?: string }).bankDetails, rating: (v as { rating?: number }).rating ?? 0, isPreferred: v.isPreferred, notes: (v as { notes?: string }).notes }); }} className={`${BTN_SM} bg-[#f4f3f7] text-[#43474e] hover:bg-[#e3e2e6]`}>
                        <span className="material-symbols-outlined text-[14px]">edit</span>{t.accounting.editVendor}
                      </button>
                      <Link href={`/accounting/purchase-orders/new?vendorId=${v.id}`} className={`${BTN_SM} bg-[#d3e4ff] text-[#1960a3] hover:bg-[#bbd4ff]`}>
                        <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>{t.accounting.newPO}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          EXPENSES TAB
      ════════════════════════════════════════ */}
      {activeTab === "expenses" && (
        <div className={CARD}>
          <div className="p-4 border-b border-[#e3e2e6] flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute start-3 top-2.5 text-[#74777f] text-[18px]">search</span>
              <input value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} placeholder="Search expenses…" className="ps-9 pe-4 py-2 border border-[#c4c6cf] rounded-lg text-sm bg-white w-64" />
            </div>
            <select value={expenseStatus} onChange={(e) => setExpenseStatus(e.target.value)} className="border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm bg-white">
              <option value="ALL">{t.accounting.allExpenses}</option>
              {Object.entries(EXP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Link href="/accounting/expenses/new" className="flex items-center gap-1.5 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity ms-auto">
              <span className="material-symbols-outlined text-[18px]">add</span>{t.accounting.logExpense}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f4f3f7]">
                <tr>
                  <th className={TH}>{t.accounting.expenseDate}</th>
                  <th className={TH}>{t.accounting.category}</th>
                  <th className={TH}>{t.accounting.description}</th>
                  <th className={TH}>{t.accounting.vendor}</th>
                  <th className={TH}>{t.accounting.amount}</th>
                  <th className={TH}>{t.accounting.approvedBy}</th>
                  <th className={TH}>{t.accounting.expenseStatus}</th>
                  <th className={TH}>{t.accounting.poActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f3f7]">
                {expensesLoading ? (
                  <tr><td colSpan={8}><Spinner /></td></tr>
                ) : expenses.length === 0 ? (
                  <EmptyRow cols={8} icon="receipt_long" label={t.accounting.noExpenses} sub={t.accounting.noExpensesDesc} />
                ) : expenses.map((e) => {
                  const st = EXP_STATUS[e.status] ?? { label: e.status, cls: "bg-[#e3e2e6] text-[#74777f]" };
                  return (
                    <tr key={e.id} className="hover:bg-[#f9f9fb] transition-colors">
                      <td className={TD}>{formatDate(e.date)}</td>
                      <td className={TD}><span className="text-xs font-semibold bg-[#f4f3f7] px-2 py-0.5 rounded-full">{e.category}</span></td>
                      <td className={TD}><p className="max-w-[200px] truncate">{e.description}</p></td>
                      <td className={TD}>{e.vendor?.name ?? "—"}</td>
                      <td className={TD}><span className="font-bold">{formatCurrency(e.amount)}</span></td>
                      <td className={TD}>{e.approvedBy?.name ?? "—"}</td>
                      <td className={TD}><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                      <td className={`${TD} space-x-1`}>
                        {e.status === "PENDING" && (
                          <>
                            <button onClick={() => expenseAction(e.id, "approve")} className={`${BTN_SM} bg-[#ccfbf1] text-[#0d9488] hover:bg-[#a7f3d0]`}>
                              <span className="material-symbols-outlined text-[14px]">check</span>{t.accounting.approveExpense}
                            </button>
                            <button onClick={() => expenseAction(e.id, "reject")} className={`${BTN_SM} bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffc8c2]`}>
                              <span className="material-symbols-outlined text-[14px]">close</span>{t.accounting.rejectExpense}
                            </button>
                          </>
                        )}
                        <button onClick={() => setActionExpense(e)} className={`${BTN_SM} bg-[#f4f3f7] text-[#43474e] hover:bg-[#e3e2e6]`}>
                          <span className="material-symbols-outlined text-[14px]">info</span>{t.accounting.viewDetails}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ASSETS TAB
      ════════════════════════════════════════ */}
      {activeTab === "assets" && (
        <div className={CARD}>
          <div className="p-4 border-b border-[#e3e2e6] flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute start-3 top-2.5 text-[#74777f] text-[18px]">search</span>
              <input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder={t.accounting.searchAssets} className="ps-9 pe-4 py-2 border border-[#c4c6cf] rounded-lg text-sm bg-white w-64" />
            </div>
            <select value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)} className="border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm bg-white">
              <option value="ALL">{t.accounting.allStatuses}</option>
              {Object.entries(ASSET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Link href="/accounting/assets/new" className="flex items-center gap-1.5 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity ms-auto">
              <span className="material-symbols-outlined text-[18px]">add</span>{t.accounting.addAsset}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f4f3f7]">
                <tr>
                  <th className={TH}>{t.accounting.asset}</th>
                  <th className={TH}>{t.accounting.assetCategory}</th>
                  <th className={TH}>{t.accounting.serial}</th>
                  <th className={TH}>{t.accounting.purchaseCost}</th>
                  <th className={TH}>{t.accounting.currentValue}</th>
                  <th className={TH}>{t.accounting.depreciation}</th>
                  <th className={TH}>{t.accounting.warranty}</th>
                  <th className={TH}>{t.accounting.poStatus}</th>
                  <th className={TH}>{t.accounting.poActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f3f7]">
                {assetsLoading ? (
                  <tr><td colSpan={9}><Spinner /></td></tr>
                ) : assets.length === 0 ? (
                  <EmptyRow cols={9} icon="inventory_2" label={t.accounting.noAssets} sub={t.accounting.noAssetsDesc} />
                ) : assets.map((a) => {
                  const st = ASSET_STATUS[a.status] ?? { label: a.status, cls: "bg-[#e3e2e6] text-[#74777f]" };
                  const warrantyExpired = a.warrantyExpiry && new Date(a.warrantyExpiry) < new Date();
                  const purchasePrice = (a as { purchasePrice?: number }).purchasePrice ?? 0;
                  const currentValue = (a as { currentValue?: number }).currentValue ?? 0;
                  const depreciated = purchasePrice > 0 ? purchasePrice - currentValue : 0;
                  return (
                    <tr key={a.id} className="hover:bg-[#f9f9fb] transition-colors">
                      <td className={TD}>
                        <p className="font-semibold">{a.name}</p>
                        {(a as { assetCode?: string }).assetCode && <p className="text-xs text-[#74777f] font-mono">{(a as { assetCode?: string }).assetCode}</p>}
                      </td>
                      <td className={TD}>{a.category}</td>
                      <td className={TD}><span className="font-mono text-xs">{(a as { serialNumber?: string }).serialNumber ?? "—"}</span></td>
                      <td className={TD}>{purchasePrice ? formatCurrency(purchasePrice) : "—"}</td>
                      <td className={TD}>{currentValue ? formatCurrency(currentValue) : "—"}</td>
                      <td className={TD}>
                        {depreciated > 0 ? (
                          <span className="text-xs font-semibold text-[#d97706]">-{formatCurrency(depreciated)}</span>
                        ) : "—"}
                      </td>
                      <td className={TD}>
                        {a.warrantyExpiry ? (
                          <span className={warrantyExpired ? "text-[#ba1a1a] text-xs font-semibold" : "text-xs"}>
                            {warrantyExpired ? `⚠ ${t.accounting.expired}` : formatDate(a.warrantyExpiry)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className={TD}><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                      <td className={`${TD} space-x-1`}>
                        <button onClick={() => { setViewAsset(a); loadDepreciation(a.id); }} className={`${BTN_SM} bg-[#f4f3f7] text-[#43474e] hover:bg-[#e3e2e6]`}>
                          <span className="material-symbols-outlined text-[14px]">trending_down</span>{t.accounting.depreciationSchedule}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          REPORTS TAB
      ════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <div className="space-y-5">
          {/* Report sub-tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {([["pl", t.accounting.profitLoss], ["ar", t.accounting.arAgingReport], ["ap", t.accounting.apAgingReport], ["cf", t.accounting.cashFlowReport]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setReportTab(key as ReportTab)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${reportTab === key ? "bg-[#002045] text-white border-[#002045]" : "bg-white text-[#74777f] border-[#e3e2e6] hover:border-[#1960a3]"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Date range (for P&L and Cash Flow) */}
          {(reportTab === "pl" || reportTab === "cf") && (
            <div className={`${CARD} p-4 flex flex-wrap items-end gap-4`}>
              <div>
                <label className="block text-xs font-semibold text-[#74777f] mb-1">{t.accounting.fromDate}</label>
                <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className={INPUT + " w-44"} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#74777f] mb-1">{t.accounting.toDate}</label>
                <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className={INPUT + " w-44"} />
              </div>
              <button onClick={generateReport} disabled={reportLoading} className="flex items-center gap-2 bg-[#1960a3] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {reportLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">bar_chart</span>}
                {t.accounting.generateReport}
              </button>
            </div>
          )}
          {(reportTab === "ar" || reportTab === "ap") && (
            <button onClick={generateReport} disabled={reportLoading} className="flex items-center gap-2 bg-[#1960a3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {reportLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">refresh</span>}
              {t.accounting.generateReport}
            </button>
          )}

          {/* ── P&L Report ── */}
          {reportTab === "pl" && plReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon="payments" iconBg="bg-[#d3e4ff]" iconColor="text-[#1960a3]" label={t.accounting.revenue} value={formatCurrency(plReport.revenue.total)} />
                <KpiCard icon="receipt_long" iconBg="bg-[#ffdad6]" iconColor="text-[#ba1a1a]" label={t.accounting.totalExpenses} value={formatCurrency(plReport.expenses.total)} />
                <KpiCard icon="trending_up" iconBg={plReport.grossProfit >= 0 ? "bg-[#ccfbf1]" : "bg-[#ffdad6]"} iconColor={plReport.grossProfit >= 0 ? "text-[#0d9488]" : "text-[#ba1a1a]"} label={t.accounting.grossProfit} value={formatCurrency(plReport.grossProfit)} />
                <KpiCard icon="percent" iconBg="bg-[#fff7ed]" iconColor="text-[#d97706]" label={t.accounting.profitMargin} value={`${plReport.grossProfitMargin.toFixed(1)}%`} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`${CARD} p-5`}>
                  <h3 className="text-sm font-bold text-[#1a1c1e] mb-3">{t.accounting.revenue} {t.accounting.breakdown}</h3>
                  <div className="space-y-2">
                    {plReport.revenue.breakdown.map((r, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-[#f4f3f7] last:border-0">
                        <span className="text-sm text-[#43474e]">{r.method}</span>
                        <span className="text-sm font-bold text-[#1960a3]">{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`${CARD} p-5`}>
                  <h3 className="text-sm font-bold text-[#1a1c1e] mb-3">{t.accounting.totalExpenses} {t.accounting.breakdown}</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={plReport.expenses.breakdown} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={80} />
                      { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                      <Tooltip formatter={((v: any) => formatCurrency(Number(v) || 0)) as never} />
                      <Bar dataKey="amount" fill="#ba1a1a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── AR Aging ── */}
          {reportTab === "ar" && arReport && <AgingTable report={arReport} label={t.accounting.arAgingReport} t={t} valueKey="balance" />}

          {/* ── AP Aging ── */}
          {reportTab === "ap" && apReport && <AgingTable report={apReport} label={t.accounting.apAgingReport} t={t} valueKey="totalAmount" />}

          {/* ── Cash Flow ── */}
          {reportTab === "cf" && cfReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`${CARD} p-5`}>
                  <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-2">{t.accounting.operatingActivities}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-sm text-[#43474e]">{t.accounting.inflows}</span><span className="text-sm font-bold text-[#0d9488]">+{formatCurrency(cfReport.operating.inflows)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-[#43474e]">{t.accounting.outflows}</span><span className="text-sm font-bold text-[#ba1a1a]">-{formatCurrency(cfReport.operating.outflows)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-[#e3e2e6]"><span className="text-sm font-bold">Net</span><span className={`text-sm font-bold ${cfReport.operating.net >= 0 ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>{formatCurrency(cfReport.operating.net)}</span></div>
                  </div>
                </div>
                <div className={`${CARD} p-5`}>
                  <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-2">{t.accounting.investingActivities}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-sm text-[#43474e]">{t.accounting.assetPurchases}</span><span className="text-sm font-bold text-[#ba1a1a]">-{formatCurrency(cfReport.investing.assetPurchases)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-[#43474e]">{t.accounting.poPayments}</span><span className="text-sm font-bold text-[#ba1a1a]">-{formatCurrency(cfReport.investing.poPayments)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-[#e3e2e6]"><span className="text-sm font-bold">Net</span><span className={`text-sm font-bold ${cfReport.investing.net >= 0 ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>{formatCurrency(cfReport.investing.net)}</span></div>
                  </div>
                </div>
                <div className={`${CARD} p-5 flex flex-col items-center justify-center`}>
                  <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-2">{t.accounting.netCashFlow}</p>
                  <p className={`text-3xl font-bold ${cfReport.netCashFlow >= 0 ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>{formatCurrency(cfReport.netCashFlow)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          MODALS
      ════════════════════════════════════════ */}

      {/* PO View / Receive Modal */}
      {actionPO && poAction && (
        <Modal title={poAction === "receive" ? t.accounting.receiveModal : `PO — ${actionPO.poNumber}`} onClose={() => { setActionPO(null); setPoAction(null); setActionError(""); }} wide>
          {actionError && <div className="flex items-center gap-2 text-[#ba1a1a] text-sm bg-[#ffdad6] rounded-lg px-3 py-2"><span className="material-symbols-outlined text-[16px]">error</span>{actionError}</div>}
          <div className="grid grid-cols-2 gap-4 text-sm mb-2">
            <div><p className="text-xs text-[#74777f]">{t.accounting.vendor}</p><p className="font-semibold">{actionPO.vendor?.name}</p></div>
            <div><p className="text-xs text-[#74777f]">{t.accounting.date}</p><p className="font-semibold">{formatDate(actionPO.date)}</p></div>
            <div><p className="text-xs text-[#74777f]">Status</p><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PO_STATUS[actionPO.status]?.cls}`}>{PO_STATUS[actionPO.status]?.label}</span></div>
            <div><p className="text-xs text-[#74777f]">Total</p><p className="font-bold text-[#002045]">{formatCurrency(actionPO.totalAmount)}</p></div>
          </div>
          <table className="w-full text-sm border border-[#e3e2e6] rounded-xl overflow-hidden">
            <thead className="bg-[#f4f3f7]">
              <tr>
                <th className={TH}>Item</th>
                <th className={TH}>{t.accounting.ordered}</th>
                <th className={TH}>Received</th>
                <th className={TH}>Unit Price</th>
                {poAction === "receive" && <th className={TH}>{t.accounting.receivedQty}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f3f7]">
              {actionPO.items?.map((item) => (
                <tr key={item.id}>
                  <td className={TD}>{item.itemName}</td>
                  <td className={TD}>{item.quantity}</td>
                  <td className={TD}>{item.receivedQty ?? 0}</td>
                  <td className={TD}>{formatCurrency(item.unitPrice)}</td>
                  {poAction === "receive" && (
                    <td className={TD}>
                      <input
                        type="number" min={0} max={item.quantity - (item.receivedQty ?? 0)}
                        value={receiveItems[item.id] ?? 0}
                        onChange={(e) => setReceiveItems((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                        className="w-20 border border-[#c4c6cf] rounded-lg px-2 py-1 text-sm"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {poAction === "receive" && (
            <button onClick={() => submitReceive(actionPO.id)} disabled={actionLoading} className="w-full flex items-center justify-center gap-2 bg-[#0d9488] text-white py-3 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
              {actionLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">inventory</span>}
              {t.accounting.confirmReceive}
            </button>
          )}
        </Modal>
      )}

      {/* Expense Detail Modal */}
      {actionExpense && (
        <Modal title={actionExpense.description} onClose={() => setActionExpense(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-[#74777f]">Date</p><p className="font-semibold">{formatDate(actionExpense.date)}</p></div>
              <div><p className="text-xs text-[#74777f]">{t.accounting.amount}</p><p className="font-bold text-[#1a1c1e]">{formatCurrency(actionExpense.amount)}</p></div>
              <div><p className="text-xs text-[#74777f]">{t.accounting.category}</p><p className="font-semibold">{actionExpense.category}</p></div>
              <div><p className="text-xs text-[#74777f]">{t.accounting.vendor}</p><p className="font-semibold">{actionExpense.vendor?.name ?? "—"}</p></div>
              <div><p className="text-xs text-[#74777f]">Payment Method</p><p className="font-semibold">{actionExpense.paymentMethod ?? "—"}</p></div>
              <div><p className="text-xs text-[#74777f]">Reference</p><p className="font-semibold font-mono">{actionExpense.referenceNo ?? "—"}</p></div>
            </div>
            <div><p className="text-xs text-[#74777f]">Status</p><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EXP_STATUS[actionExpense.status]?.cls}`}>{EXP_STATUS[actionExpense.status]?.label}</span></div>
            {actionExpense.approvedBy && <div><p className="text-xs text-[#74777f]">{t.accounting.approvedBy}</p><p className="font-semibold">{actionExpense.approvedBy.name} · {formatDate(actionExpense.approvedAt!)}</p></div>}
            {actionExpense.status === "PENDING" && (
              <div className="flex gap-3 pt-2">
                <button onClick={() => expenseAction(actionExpense.id, "approve")} className="flex-1 flex items-center justify-center gap-2 bg-[#0d9488] text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>{t.accounting.approveExpense}
                </button>
                <button onClick={() => expenseAction(actionExpense.id, "reject")} className="flex-1 flex items-center justify-center gap-2 bg-[#ba1a1a] text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90">
                  <span className="material-symbols-outlined text-[18px]">cancel</span>{t.accounting.rejectExpense}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Vendor Edit Modal */}
      {editVendor && (
        <Modal title={t.accounting.editVendor} onClose={() => setEditVendor(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([["contactPerson", t.accounting.contactPerson], ["phone", "Phone"], ["email", "Email"], ["paymentTerms", t.accounting.paymentTerms], ["taxId", t.accounting.taxId], ["bankDetails", t.accounting.bankDetails]] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-[#74777f] mb-1">{label}</label>
                <input type="text" value={(vendorForm as Record<string, string>)[field] ?? ""} onChange={(e) => setVendorForm((f) => ({ ...f, [field]: e.target.value }))} className={INPUT} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-[#74777f] mb-1">{t.accounting.rating}</label>
              <StarRating rating={vendorForm.rating ?? 0} onChange={(r) => setVendorForm((f) => ({ ...f, rating: r }))} />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="preferred" checked={!!(vendorForm as { isPreferred?: boolean }).isPreferred} onChange={(e) => setVendorForm((f) => ({ ...f, isPreferred: e.target.checked }))} />
              <label htmlFor="preferred" className="text-sm font-semibold">{t.accounting.preferred}</label>
            </div>
          </div>
          <button onClick={saveVendor} disabled={vendorSaving} className="w-full flex items-center justify-center gap-2 bg-[#002045] text-white py-3 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 mt-2">
            {vendorSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
            {t.accounting.saveChanges}
          </button>
        </Modal>
      )}

      {/* Asset Depreciation Modal */}
      {viewAsset && (
        <Modal title={`${t.accounting.depreciationSchedule} — ${viewAsset.name}`} onClose={() => { setViewAsset(null); setDeprSchedule(null); }} wide>
          {deprLoading ? <Spinner /> : deprSchedule ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div><p className="text-xs text-[#74777f]">{t.accounting.purchaseCost}</p><p className="font-bold">{formatCurrency(deprSchedule.cost)}</p></div>
                <div><p className="text-xs text-[#74777f]">Salvage Value</p><p className="font-bold">{formatCurrency(deprSchedule.salvageValue)}</p></div>
                <div><p className="text-xs text-[#74777f]">Useful Life</p><p className="font-bold">{deprSchedule.usefulLifeYears} years</p></div>
                <div><p className="text-xs text-[#74777f]">Method</p><p className="font-bold text-xs">{deprSchedule.depreciationMethod.replace("_", " ")}</p></div>
              </div>
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={deprSchedule.schedule} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                      <Tooltip formatter={((v: any) => formatCurrency(Number(v) || 0)) as never} />
                    <Area type="monotone" dataKey="bookValue" name={t.accounting.bookValue} stroke="#1960a3" fill="#d3e4ff" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f4f3f7]">
                    <tr>
                      <th className={TH}>Year</th>
                      <th className={TH}>{t.accounting.annualDepreciation}</th>
                      <th className={TH}>Accumulated</th>
                      <th className={TH}>{t.accounting.bookValue}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f3f7]">
                    {deprSchedule.schedule.map((row) => (
                      <tr key={row.year}>
                        <td className={TD}>{row.year}</td>
                        <td className={TD}><span className="text-[#d97706] font-semibold">{formatCurrency(row.depreciation)}</span></td>
                        <td className={TD}>{formatCurrency(row.accumulatedDepreciation)}</td>
                        <td className={TD}><span className="font-bold text-[#1960a3]">{formatCurrency(row.bookValue)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <p className="text-sm text-[#74777f] text-center py-8">{t.accounting.noPurchasePrice}</p>}
        </Modal>
      )}
    </div>
  );
}

// ─── Aging Table component ────────────────────────────────────────────────────

function AgingTable({ report, label, t, valueKey }: {
  report: AgingReport; label: string; t: { accounting: { current: string; days1_30: string; days31_60: string; days61_90: string; over90: string; grandTotal: string; ageDays: string; balanceCol: string; dueDateCol: string; amount: string; poStatus: string } };
  valueKey: "balance" | "totalAmount";
}) {
  const BUCKET_LABELS = [
    { key: "current", label: t.accounting.current, cls: "bg-[#ccfbf1] text-[#0d9488]", data: report.detail.current, summary: report.summary.current },
    { key: "1_30", label: t.accounting.days1_30, cls: "bg-[#fff7ed] text-[#d97706]", data: report.detail["1_30"], summary: report.summary.days1_30 },
    { key: "31_60", label: t.accounting.days31_60, cls: "bg-[#fed7aa] text-[#c2410c]", data: report.detail["31_60"], summary: report.summary.days31_60 },
    { key: "61_90", label: t.accounting.days61_90, cls: "bg-[#ffdad6] text-[#ba1a1a]", data: report.detail["61_90"], summary: report.summary.days61_90 },
    { key: "over_90", label: t.accounting.over90, cls: "bg-[#ba1a1a] text-white", data: report.detail.over_90, summary: report.summary.over90 },
  ];

  return (
    <div className="space-y-4">
      {/* Summary buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {BUCKET_LABELS.map((b) => (
          <div key={b.key} className={`rounded-xl p-4 ${b.cls}`}>
            <p className="text-xs font-semibold mb-1">{b.label}</p>
            <p className="text-lg font-bold">{formatCurrency(b.summary.total)}</p>
            <p className="text-xs opacity-75">{b.summary.count} item{b.summary.count !== 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>
      <div className={`text-end text-sm font-bold text-[#1a1c1e] pe-2`}>
        {t.accounting.grandTotal}: {formatCurrency(report.summary.grandTotal)}
      </div>
      {/* Detail table */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f4f3f7]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase">{label}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase">Patient / Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase">{t.accounting.dueDateCol}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase">{t.accounting.amount}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase">{t.accounting.balanceCol}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase">{t.accounting.ageDays}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#74777f] uppercase">{t.accounting.poStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f3f7]">
            {BUCKET_LABELS.flatMap((b) =>
              b.data.map((entry, i) => (
                <tr key={`${b.key}-${i}`} className="hover:bg-[#f9f9fb]">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#1960a3]">{entry.invoiceNo ?? entry.poNumber ?? "—"}</td>
                  <td className="px-4 py-3">{entry.patient ?? entry.vendor ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : entry.expectedDelivery ? new Date(entry.expectedDelivery).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency((entry[valueKey as keyof AgingEntry] as number) ?? 0)}</td>
                  <td className="px-4 py-3 font-bold text-[#ba1a1a]">{valueKey === "balance" ? formatCurrency(entry.balance ?? 0) : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.cls}`}>{entry.ageDays}d</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-[#74777f]">{entry.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

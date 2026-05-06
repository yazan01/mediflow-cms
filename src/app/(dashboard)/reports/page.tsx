"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";

type DateRange = "this_month" | "last_month" | "last_quarter" | "last_year";

type OverviewStats = {
  revenueMTD: number;
  patientsMTD: number;
  appointmentsMTD: number;
  noShowRate: number;
  revenueChange: number;
  patientsChange: number;
  appointmentsChange: number;
  noShowChange: number;
};

const FINANCIAL_REPORTS = [
  { id: "pl",         icon: "account_balance",  label: "Profit & Loss Statement",    desc: "Revenue vs expenses for selected period" },
  { id: "bs",         icon: "balance",          label: "Balance Sheet",              desc: "Snapshot of assets, liabilities & equity" },
  { id: "cf",         icon: "waterfall_chart",  label: "Cash Flow Statement",        desc: "Inflows and outflows of cash" },
  { id: "tb",         icon: "receipt_long",     label: "Trial Balance",             desc: "All account balances before closing entries" },
  { id: "ar_aging",   icon: "pending_actions",  label: "AR Aging Report",           desc: "Outstanding patient balances by age bucket" },
  { id: "ap_aging",   icon: "payments",         label: "AP Aging Report",           desc: "Overdue vendor payments summary" },
  { id: "rev_service",icon: "pie_chart",        label: "Revenue by Service",        desc: "Revenue breakdown per service type" },
  { id: "expense",    icon: "trending_down",    label: "Expense Report",            desc: "Expense categories with budget vs actual" },
  { id: "depr",       icon: "category",         label: "Asset Depreciation Schedule", desc: "Depreciation per asset over time" },
];

const CLINICAL_REPORTS = [
  { id: "diag_freq",  icon: "diagnosis",        label: "Diagnosis Frequency",       desc: "Most common diagnoses (ICD-10 coded)" },
  { id: "rx_pattern", icon: "medication",       label: "Prescription Patterns",     desc: "Top prescribed medications and dosages" },
  { id: "lab_tat",    icon: "biotech",          label: "Lab Turnaround Times",      desc: "Average TAT per test category" },
  { id: "appt_stats", icon: "calendar_today",   label: "Appointment Statistics",    desc: "No-show rate, completion rate, duration" },
  { id: "patient_flow",icon: "group",           label: "Patient Flow Analysis",     desc: "New vs returning patients over time" },
];

const HR_REPORTS = [
  { id: "attendance",  icon: "fact_check",      label: "Attendance Overview",       desc: "Monthly attendance rate per department" },
  { id: "leave",       icon: "event_available", label: "Leave Utilization",         desc: "Leave taken vs balance by type" },
  { id: "headcount",   icon: "people",          label: "Headcount by Department",   desc: "Employee distribution across departments" },
  { id: "payroll_sum", icon: "payments",        label: "Payroll Summary",           desc: "Total payroll cost breakdown by month" },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "financial" | "clinical" | "hr">("overview");
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/overview?range=${dateRange}`);
      if (res.ok) setStats(await res.json());
    } catch { /* DB not configured */ }
    finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const kpiCards = [
    { label: "Revenue MTD",      value: stats ? formatCurrency(stats.revenueMTD)    : "—", icon: "payments",       change: stats?.revenueChange,      iconBg: "bg-[#d3e4ff]", iconColor: "text-[#1960a3]" },
    { label: "Patients MTD",     value: stats ? String(stats.patientsMTD)           : "—", icon: "person",         change: stats?.patientsChange,     iconBg: "bg-[#d6e3ff]", iconColor: "text-[#002045]" },
    { label: "Appointments MTD", value: stats ? String(stats.appointmentsMTD)       : "—", icon: "calendar_today", change: stats?.appointmentsChange, iconBg: "bg-[#ffddba]", iconColor: "text-[#633f0f]" },
    { label: "No-Show Rate",     value: stats ? `${stats.noShowRate.toFixed(1)}%`   : "—", icon: "event_busy",     change: stats?.noShowChange,       iconBg: "bg-[#ffdad6]", iconColor: "text-[#ba1a1a]" },
  ];

  const tabs = [
    { key: "overview",  label: "Overview",   icon: "dashboard" },
    { key: "financial", label: "Financial",  icon: "account_balance" },
    { key: "clinical",  label: "Clinical",   icon: "clinical_notes" },
    { key: "hr",        label: "HR Analytics", icon: "badge" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Reports & Analytics</h1>
          <p className="text-sm text-[#74777f] mt-0.5">Comprehensive insights across all clinic operations</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="last_year">Last Year</option>
          </select>
          <button className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">schedule_send</span>
            Schedule Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#f4f3f7] rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-white text-[#1960a3] shadow-sm"
                : "text-[#74777f] hover:text-[#1a1c1e]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 ${card.iconBg} rounded-2xl`}>
                    <span className={`material-symbols-outlined ${card.iconColor} text-[22px]`}>{card.icon}</span>
                  </div>
                  {card.change !== undefined && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      card.change >= 0 ? "bg-[#ccfbf1]/60 text-[#0d9488]" : "bg-[#ffdad6] text-[#93000a]"
                    }`}>
                      <span className="material-symbols-outlined text-[12px]">
                        {card.change >= 0 ? "trending_up" : "trending_down"}
                      </span>
                      {Math.abs(card.change)}%
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-1">{card.label}</p>
                {loading ? (
                  <div className="h-8 w-24 bg-[#f4f3f7] rounded animate-pulse"></div>
                ) : (
                  <p className="text-3xl font-bold text-[#1a1c1e]">{card.value}</p>
                )}
              </div>
            ))}
          </div>

          {/* Charts area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-semibold text-[#1a1c1e]">Revenue vs Expenses</h3>
                  <p className="text-xs text-[#74777f]">Monthly comparison</p>
                </div>
                <button className="flex items-center gap-1 text-xs text-[#1960a3] font-semibold border border-[#c4c6cf] px-3 py-1.5 rounded-lg hover:bg-[#f4f3f7]">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export
                </button>
              </div>
              <div className="h-52 chart-grid rounded-lg border border-[#e3e2e6] bg-[#faf9fd] flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">bar_chart</span>
                  <p className="text-xs text-[#74777f] mt-2">Connect database to view revenue chart</p>
                </div>
              </div>
              <div className="flex gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-[#43474e]"><span className="w-3 h-3 rounded-full bg-[#1960a3]"></span>Revenue</span>
                <span className="flex items-center gap-1.5 text-xs text-[#43474e]"><span className="w-3 h-3 rounded-full bg-[#adc7f7]"></span>Expenses</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e3e2e6] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-semibold text-[#1a1c1e]">Patient Volume</h3>
                  <p className="text-xs text-[#74777f]">New vs returning patients</p>
                </div>
                <button className="flex items-center gap-1 text-xs text-[#1960a3] font-semibold border border-[#c4c6cf] px-3 py-1.5 rounded-lg hover:bg-[#f4f3f7]">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export
                </button>
              </div>
              <div className="h-52 chart-grid rounded-lg border border-[#e3e2e6] bg-[#faf9fd] flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">area_chart</span>
                  <p className="text-xs text-[#74777f] mt-2">Connect database to view patient trends</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Reports Tab */}
      {activeTab === "financial" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FINANCIAL_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r} onExport={(format) => handleExport(r.id, format, dateRange)} />
          ))}
        </div>
      )}

      {/* Clinical Reports Tab */}
      {activeTab === "clinical" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CLINICAL_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r} onExport={(format) => handleExport(r.id, format, dateRange)} />
          ))}
        </div>
      )}

      {/* HR Analytics Tab */}
      {activeTab === "hr" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HR_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r} onExport={(format) => handleExport(r.id, format, dateRange)} />
          ))}
        </div>
      )}
    </div>
  );
}

async function handleExport(reportId: string, format: "pdf" | "excel" | "csv", dateRange: DateRange) {
  try {
    const res = await fetch(`/api/reports/export?id=${reportId}&format=${format}&range=${dateRange}`);
    if (!res.ok) { alert("Export failed. Connect the database first."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportId}_${dateRange}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("Export requires database connection.");
  }
}

function ReportCard({
  icon, label, desc, onExport,
}: {
  icon: string; label: string; desc: string;
  onExport: (format: "pdf" | "excel" | "csv") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2.5 bg-[#d3e4ff]/40 rounded-xl flex-shrink-0">
          <span className="material-symbols-outlined text-[#1960a3] text-[22px]">{icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#1a1c1e]">{label}</h3>
          <p className="text-xs text-[#74777f] mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-2 bg-[#002045] text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Report
        </button>
        {open && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#e3e2e6] rounded-xl shadow-[0_8px_32px_rgba(26,54,93,0.15)] overflow-hidden z-10">
            {(["pdf", "excel", "csv"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => { setOpen(false); onExport(fmt); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors font-medium text-left"
              >
                <span className="material-symbols-outlined text-[18px] text-[#74777f]">
                  {fmt === "pdf" ? "picture_as_pdf" : fmt === "excel" ? "table_chart" : "csv"}
                </span>
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

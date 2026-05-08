"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTimezone } from "@/lib/TimezoneContext";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";

type DateRange = "this_month" | "last_month" | "last_quarter" | "last_year";
type ReportType = "payments" | "appointments" | "patients";
type ExportFormat = "csv" | "xlsx";

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

type ChartRow = { month: string; revenue: number; expenses: number };

export default function ReportsPage() {
  const { t, lang } = useLanguage();
  const { formatDateTime } = useTimezone();

  const FINANCIAL_REPORTS = [
    { id: "pl",          icon: "account_balance",  label: t.reports.profitLoss,          desc: t.reports.profitLossDesc },
    { id: "bs",          icon: "balance",           label: t.reports.balanceSheet,        desc: t.reports.balanceSheetDesc },
    { id: "cf",          icon: "waterfall_chart",   label: t.reports.cashFlow,            desc: t.reports.cashFlowDesc },
    { id: "tb",          icon: "receipt_long",      label: t.reports.trialBalance,        desc: t.reports.trialBalanceDesc },
    { id: "ar_aging",    icon: "pending_actions",   label: t.reports.arAging,             desc: t.reports.arAgingDesc },
    { id: "ap_aging",    icon: "payments",          label: t.reports.apAging,             desc: t.reports.apAgingDesc },
    { id: "rev_service", icon: "pie_chart",         label: t.reports.revenueByService,    desc: t.reports.revenueByServiceDesc },
    { id: "expense",     icon: "trending_down",     label: t.reports.expenseReport,       desc: t.reports.expenseReportDesc },
    { id: "depr",        icon: "category",          label: t.reports.assetDepreciation,   desc: t.reports.assetDepreciationDesc },
  ];
  const CLINICAL_REPORTS = [
    { id: "diag_freq",    icon: "diagnosis",       label: t.reports.diagnosisFrequency,   desc: t.reports.diagnosisFrequencyDesc },
    { id: "rx_pattern",   icon: "medication",      label: t.reports.prescriptionPatterns, desc: t.reports.prescriptionPatternsDesc },
    { id: "lab_tat",      icon: "biotech",         label: t.reports.labTurnaround,        desc: t.reports.labTurnaroundDesc },
    { id: "appt_stats",   icon: "calendar_today",  label: t.reports.apptStatistics,       desc: t.reports.apptStatisticsDesc },
    { id: "patient_flow", icon: "group",           label: t.reports.patientFlow,          desc: t.reports.patientFlowDesc },
  ];
  const HR_REPORTS = [
    { id: "attendance",  icon: "fact_check",      label: t.reports.attendanceOverview,  desc: t.reports.attendanceOverviewDesc },
    { id: "leave",       icon: "event_available", label: t.reports.leaveUtilization,    desc: t.reports.leaveUtilizationDesc },
    { id: "headcount",   icon: "people",          label: t.reports.headcount,           desc: t.reports.headcountDesc },
    { id: "payroll_sum", icon: "payments",        label: t.reports.payrollSummary,      desc: t.reports.payrollSummaryDesc },
  ];

  // ── Global filters ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"overview" | "financial" | "clinical" | "hr" | "data">("overview");
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Overview ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartRow[]>([]);

  // ── Data Viewer ───────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>("payments");
  const [dvDoctorId, setDvDoctorId] = useState("ALL");
  const [dvBranchId, setDvBranchId] = useState("ALL");
  const [dvStatus, setDvStatus] = useState("ALL");
  const [dvSearch, setDvSearch] = useState("");
  const debouncedSearch = useDebounce(dvSearch, 300);
  const [dvPage, setDvPage] = useState(1);
  const [dvData, setDvData] = useState<Record<string, unknown>[]>([]);
  const [dvColumns, setDvColumns] = useState<string[]>([]);
  const [dvTotal, setDvTotal] = useState(0);
  const [dvTotalPages, setDvTotalPages] = useState(1);
  const [dvLoading, setDvLoading] = useState(false);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // ── Export ────────────────────────────────────────────────────────────────
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // ── Fetch overview stats ──────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({ range: dateRange });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/reports/overview?${params}`);
      if (res.ok) setStats(await res.json());
    } catch { /* offline */ }
    finally { setStatsLoading(false); }
  }, [dateRange, dateFrom, dateTo]);

  const fetchChartData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/revenue");
      if (res.ok) setChartData(await res.json());
    } catch { /* offline */ }
  }, []);

  // ── Fetch doctors / branches for filters ────────────────────────────────
  useEffect(() => {
    fetch("/api/doctors").then(r => r.ok ? r.json() : []).then((d: { id: string; name: string }[]) => setDoctors(d)).catch(() => {});
    fetch("/api/branches").then(r => r.ok ? r.json() : []).then((d: { id: string; name: string }[]) => {
      if (Array.isArray(d)) setBranches(d);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchChartData(); }, [fetchChartData]);

  // ── Fetch data viewer ────────────────────────────────────────────────────
  const fetchDvData = useCallback(async () => {
    setDvLoading(true);
    try {
      const params = new URLSearchParams({ report_type: reportType, page: String(dvPage), page_size: "50" });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (dvDoctorId !== "ALL") params.set("doctor_id", dvDoctorId);
      if (dvBranchId !== "ALL") params.set("branch_id", dvBranchId);
      if (dvStatus !== "ALL") params.set("status", dvStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/reports/data?${params}`);
      if (res.ok) {
        const json = await res.json();
        setDvData(json.data ?? []);
        setDvColumns(json.columns ?? []);
        setDvTotal(json.total ?? 0);
        setDvTotalPages(json.totalPages ?? 1);
      }
    } catch { /* offline */ }
    finally { setDvLoading(false); }
  }, [reportType, dateFrom, dateTo, dvDoctorId, dvBranchId, dvStatus, debouncedSearch, dvPage]);

  useEffect(() => {
    if (activeTab === "data") fetchDvData();
  }, [activeTab, fetchDvData]);

  // reset to page 1 when filters change
  useEffect(() => { setDvPage(1); }, [reportType, dateFrom, dateTo, dvDoctorId, dvBranchId, dvStatus, debouncedSearch]);

  // ── Export handlers ───────────────────────────────────────────────────────
  async function handleExport(format: ExportFormat) {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ report_type: reportType, format, lang });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (dvDoctorId !== "ALL") params.set("doctor_id", dvDoctorId);
      if (dvBranchId !== "ALL") params.set("branch_id", dvBranchId);
      if (dvStatus !== "ALL") params.set("status", dvStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) { setExportError(t.reports.exportFailed); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_${dateFrom || "all"}_${dateTo || "all"}.${format === "xlsx" ? "xlsx" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setExportError(t.reports.exportRequires); }
    finally { setExporting(false); }
  }

  async function handleOverviewExport(format: ExportFormat) {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ report_type: "payments", format, lang });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) { setExportError(t.reports.exportFailed); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments_report.${format === "xlsx" ? "xlsx" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setExportError(t.reports.exportRequires); }
    finally { setExporting(false); }
  }

  // ── Column label map ──────────────────────────────────────────────────────
  const COL_LABELS: Record<string, string> = {
    invoiceNo: t.reports.invoiceNo,
    patient: t.reports.patient,
    mrn: t.reports.mrn,
    amount: t.reports.amount,
    method: t.reports.method,
    status: t.common.status,
    date: t.common.date,
    doctor: t.reports.doctor,
    scheduledAt: t.reports.scheduledAt,
    type: t.common.type,
    branch: t.reports.branch,
    name: t.common.name,
    gender: t.reports.gender,
    phone: t.common.phone,
    nationality: t.reports.nationality,
    bloodType: t.reports.bloodType,
    createdAt: t.reports.createdAt,
  };

  function renderCell(col: string, value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (col === "amount" && typeof value === "number") return formatCurrency(value);
    if ((col === "date" || col === "scheduledAt" || col === "createdAt") && typeof value === "string") {
      return formatDateTime(value);
    }
    return String(value);
  }

  const kpiCards = [
    { label: t.reports.revenueMTD,      value: stats ? formatCurrency(stats.revenueMTD)    : "—", icon: "payments",       change: stats?.revenueChange,      iconBg: "bg-[#d3e4ff]", iconColor: "text-[#1960a3]" },
    { label: t.reports.patientsMTD,     value: stats ? String(stats.patientsMTD)           : "—", icon: "person",         change: stats?.patientsChange,     iconBg: "bg-[#d6e3ff]", iconColor: "text-[#002045]" },
    { label: t.reports.appointmentsMTD, value: stats ? String(stats.appointmentsMTD)       : "—", icon: "calendar_today", change: stats?.appointmentsChange, iconBg: "bg-[#ffddba]", iconColor: "text-[#633f0f]" },
    { label: t.reports.noShowRate,      value: stats ? `${(stats.noShowRate ?? 0).toFixed(1)}%` : "—", icon: "event_busy", change: stats?.noShowChange, iconBg: "bg-[#ffdad6]", iconColor: "text-[#ba1a1a]" },
  ];

  const tabs = [
    { key: "overview",  label: t.reports.overview,    icon: "dashboard" },
    { key: "financial", label: t.reports.financial,   icon: "account_balance" },
    { key: "clinical",  label: t.reports.clinical,    icon: "clinical_notes" },
    { key: "hr",        label: t.reports.hrAnalytics, icon: "badge" },
    { key: "data",      label: t.reports.dataViewer,  icon: "table_view" },
  ] as const;

  const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
    { value: "payments",     label: t.reports.paymentsReport },
    { value: "appointments", label: t.reports.appointmentsReport },
    { value: "patients",     label: t.reports.patientsReport },
  ];

  const STATUS_OPTIONS: Record<ReportType, string[]> = {
    payments:     ["PENDING", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"],
    appointments: ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "NO_SHOW", "CANCELLED"],
    patients:     ["ACTIVE", "INACTIVE"],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.reports.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.reports.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value as DateRange); setDateFrom(""); setDateTo(""); }}
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            aria-label={t.reports.dateRange}
          >
            <option value="this_month">{t.reports.thisMonth}</option>
            <option value="last_month">{t.reports.lastMonth}</option>
            <option value="last_quarter">{t.reports.lastQuarter}</option>
            <option value="last_year">{t.reports.lastYear}</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            aria-label={t.reports.dateFrom}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            aria-label={t.reports.dateTo}
          />
          <button
            onClick={() => handleOverviewExport("xlsx")}
            disabled={exporting}
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            {exporting ? t.reports.exporting : t.reports.exportExcelBtn}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors print:hidden"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            PDF
          </button>
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-3 p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-xl text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {exportError}
          <button onClick={() => setExportError(null)} className="ms-auto opacity-70 hover:opacity-100 p-1" aria-label={t.common.close}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-[#f4f3f7] rounded-xl w-fit">
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

      {/* ── Overview Tab ──────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
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
                {statsLoading ? (
                  <div className="h-8 w-24 bg-[#f4f3f7] rounded animate-pulse"></div>
                ) : (
                  <p className="text-3xl font-bold text-[#1a1c1e]">{card.value}</p>
                )}
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses — Recharts BarChart */}
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-semibold text-[#1a1c1e]">{t.reports.revenueVsExpenses}</h3>
                  <p className="text-xs text-[#74777f]">{t.reports.monthlyComparison}</p>
                </div>
                <button
                  onClick={() => handleOverviewExport("xlsx")}
                  className="flex items-center gap-1 text-xs text-[#1960a3] font-semibold border border-[#c4c6cf] px-3 py-1.5 rounded-lg hover:bg-[#f4f3f7]"
                  disabled={exporting}
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  {t.reports.export}
                </button>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e2e6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name: any) => [
                        formatCurrency(Number(value) || 0),
                        name === "revenue" ? t.reports.revenue : t.reports.expenses_,
                      ]) as never}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e2e6" }}
                    />
                    <Legend
                      formatter={(v) => v === "revenue" ? t.reports.revenue : t.reports.expenses_}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="revenue" fill="#1960a3" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#adc7f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 rounded-lg border border-[#e3e2e6] bg-[#faf9fd] flex items-center justify-center">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">bar_chart</span>
                    <p className="text-xs text-[#74777f] mt-2">{t.reports.noChartData}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Revenue trend — AreaChart */}
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-semibold text-[#1a1c1e]">{t.reports.patientVolume}</h3>
                  <p className="text-xs text-[#74777f]">{t.reports.newVsReturning}</p>
                </div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1960a3" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1960a3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e2e6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any) => [formatCurrency(Number(value) || 0), t.reports.revenue]) as never}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e2e6" }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#1960a3" strokeWidth={2}
                      fill="url(#colorRev)" dot={{ r: 3, fill: "#1960a3" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 rounded-lg border border-[#e3e2e6] bg-[#faf9fd] flex items-center justify-center">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">area_chart</span>
                    <p className="text-xs text-[#74777f] mt-2">{t.reports.noChartData}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Financial Reports Tab ─────────────────────────────────────────── */}
      {activeTab === "financial" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FINANCIAL_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r}
              generateLabel={t.reports.generateReport}
              viewDataLabel={t.reports.viewData}
              exportLabels={{ pdf: t.reports.exportPDF, excel: t.reports.exportExcel, csv: t.reports.exportCSV }}
              onExport={(fmt) => handleOverviewExport(fmt as ExportFormat)}
              onViewData={() => { setActiveTab("data"); }}
            />
          ))}
        </div>
      )}

      {/* ── Clinical Reports Tab ──────────────────────────────────────────── */}
      {activeTab === "clinical" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CLINICAL_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r}
              generateLabel={t.reports.generateReport}
              viewDataLabel={t.reports.viewData}
              exportLabels={{ pdf: t.reports.exportPDF, excel: t.reports.exportExcel, csv: t.reports.exportCSV }}
              onExport={(fmt) => handleOverviewExport(fmt as ExportFormat)}
              onViewData={() => { setActiveTab("data"); }}
            />
          ))}
        </div>
      )}

      {/* ── HR Analytics Tab ──────────────────────────────────────────────── */}
      {activeTab === "hr" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HR_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r}
              generateLabel={t.reports.generateReport}
              viewDataLabel={t.reports.viewData}
              exportLabels={{ pdf: t.reports.exportPDF, excel: t.reports.exportExcel, csv: t.reports.exportCSV }}
              onExport={(fmt) => handleOverviewExport(fmt as ExportFormat)}
              onViewData={() => { setActiveTab("data"); }}
            />
          ))}
        </div>
      )}

      {/* ── Data Viewer Tab ───────────────────────────────────────────────── */}
      {activeTab === "data" && (
        <div className="space-y-4">
          {/* Viewer filters bar */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex flex-wrap gap-3 items-end shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {/* Report type selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#74777f]">{t.reports.dataViewer}</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 min-w-[160px]"
              >
                {REPORT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#74777f]">{t.reports.dateFrom}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#74777f]">{t.reports.dateTo}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              />
            </div>

            {/* Doctor filter (appointments only) */}
            {reportType === "appointments" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#74777f]">{t.reports.doctor}</label>
                <select
                  value={dvDoctorId}
                  onChange={(e) => setDvDoctorId(e.target.value)}
                  className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 min-w-[150px]"
                >
                  <option value="ALL">{t.reports.allDoctors}</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {/* Branch filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#74777f]">{t.reports.branch}</label>
              <select
                value={dvBranchId}
                onChange={(e) => setDvBranchId(e.target.value)}
                className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 min-w-[140px]"
              >
                <option value="ALL">{t.reports.allBranches}</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#74777f]">{t.common.status}</label>
              <select
                value={dvStatus}
                onChange={(e) => setDvStatus(e.target.value)}
                className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 min-w-[130px]"
              >
                <option value="ALL">{t.reports.allStatuses}</option>
                {STATUS_OPTIONS[reportType].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-[#74777f]">{t.common.search}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute start-3 top-2.5 text-[16px] text-[#74777f]">search</span>
                <input
                  type="text"
                  value={dvSearch}
                  onChange={(e) => setDvSearch(e.target.value)}
                  placeholder={t.reports.reportSearch}
                  className="border border-[#c4c6cf] bg-white rounded-lg ps-9 pe-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                />
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 ms-auto">
              <button
                onClick={() => handleExport("xlsx")}
                disabled={exporting}
                className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">table_chart</span>
                {t.reports.exportExcelBtn}
              </button>
              <button
                onClick={() => handleExport("csv")}
                disabled={exporting}
                className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">csv</span>
                {t.reports.exportCsvBtn}
              </button>
            </div>
          </div>

          {/* Total count */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#74777f]">
              {t.reports.totalRecords}: <strong className="text-[#1a1c1e]">{dvTotal.toLocaleString()}</strong>
            </span>
          </div>

          {/* Data table */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e3e2e6] bg-[#f4f3f7]">
                    {dvColumns.map(col => (
                      <th key={col} className="table-header py-3 px-4 text-start font-semibold text-[#43474e]">
                        {COL_LABELS[col] ?? col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dvLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#e3e2e6]">
                        {(dvColumns.length > 0 ? dvColumns : Array.from({ length: 5 })).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-[#f4f3f7] rounded animate-pulse w-full max-w-[120px]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : dvData.length === 0 ? (
                    <tr>
                      <td colSpan={dvColumns.length || 5} className="text-center py-16 text-[#74777f]">
                        <span className="material-symbols-outlined text-4xl text-[#c4c6cf] block mb-2">table_rows</span>
                        {t.common.noData}
                      </td>
                    </tr>
                  ) : (
                    dvData.map((row, ri) => (
                      <tr key={ri} className="table-row border-b border-[#e3e2e6] hover:bg-[#faf9fd] transition-colors">
                        {dvColumns.map(col => (
                          <td key={col} className="table-cell px-4 py-3 text-[#1a1c1e]">
                            {renderCell(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {dvTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#e3e2e6]">
                <span className="text-xs text-[#74777f]">
                  {t.common.page} {dvPage} {t.common.of} {dvTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDvPage(p => Math.max(1, p - 1))}
                    disabled={dvPage === 1}
                    className="flex items-center gap-1 border border-[#c4c6cf] px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    {t.common.previous}
                  </button>
                  <button
                    onClick={() => setDvPage(p => Math.min(dvTotalPages, p + 1))}
                    disabled={dvPage === dvTotalPages}
                    className="flex items-center gap-1 border border-[#c4c6cf] px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t.common.next}
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportCard({
  icon, label, desc, generateLabel, viewDataLabel, exportLabels, onExport, onViewData,
}: {
  icon: string; label: string; desc: string;
  generateLabel: string;
  viewDataLabel: string;
  exportLabels: { pdf: string; excel: string; csv: string };
  onExport: (format: "pdf" | "excel" | "csv") => void;
  onViewData: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
      <div className="flex gap-2">
        <button
          onClick={onViewData}
          className="flex-1 flex items-center justify-center gap-2 border border-[#c4c6cf] py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors text-[#1a1c1e]"
        >
          <span className="material-symbols-outlined text-[16px]">table_view</span>
          {viewDataLabel}
        </button>
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center gap-2 bg-[#002045] text-white py-2 px-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            aria-haspopup="true"
            aria-expanded={open}
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            {generateLabel}
          </button>
          {open && (
            <div className="absolute bottom-full end-0 mb-1 w-36 bg-white border border-[#e3e2e6] rounded-xl shadow-[0_8px_32px_rgba(26,54,93,0.15)] overflow-hidden z-10">
              {(["excel", "csv", "pdf"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => { setOpen(false); onExport(fmt); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors font-medium text-start"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#74777f]">
                    {fmt === "pdf" ? "picture_as_pdf" : fmt === "excel" ? "table_chart" : "csv"}
                  </span>
                  {fmt === "pdf" ? exportLabels.pdf : fmt === "excel" ? exportLabels.excel : exportLabels.csv}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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

export default function ReportsPage() {
  const { t } = useLanguage();

  const FINANCIAL_REPORTS = [
    { id: "pl",         icon: "account_balance",  label: t.reports.profitLoss,          desc: t.reports.profitLossDesc },
    { id: "bs",         icon: "balance",          label: t.reports.balanceSheet,        desc: t.reports.balanceSheetDesc },
    { id: "cf",         icon: "waterfall_chart",  label: t.reports.cashFlow,            desc: t.reports.cashFlowDesc },
    { id: "tb",         icon: "receipt_long",     label: t.reports.trialBalance,        desc: t.reports.trialBalanceDesc },
    { id: "ar_aging",   icon: "pending_actions",  label: t.reports.arAging,             desc: t.reports.arAgingDesc },
    { id: "ap_aging",   icon: "payments",         label: t.reports.apAging,             desc: t.reports.apAgingDesc },
    { id: "rev_service",icon: "pie_chart",        label: t.reports.revenueByService,    desc: t.reports.revenueByServiceDesc },
    { id: "expense",    icon: "trending_down",    label: t.reports.expenseReport,       desc: t.reports.expenseReportDesc },
    { id: "depr",       icon: "category",         label: t.reports.assetDepreciation,   desc: t.reports.assetDepreciationDesc },
  ];

  const CLINICAL_REPORTS = [
    { id: "diag_freq",   icon: "diagnosis",       label: t.reports.diagnosisFrequency,  desc: t.reports.diagnosisFrequencyDesc },
    { id: "rx_pattern",  icon: "medication",      label: t.reports.prescriptionPatterns,desc: t.reports.prescriptionPatternsDesc },
    { id: "lab_tat",     icon: "biotech",         label: t.reports.labTurnaround,       desc: t.reports.labTurnaroundDesc },
    { id: "appt_stats",  icon: "calendar_today",  label: t.reports.apptStatistics,      desc: t.reports.apptStatisticsDesc },
    { id: "patient_flow",icon: "group",           label: t.reports.patientFlow,         desc: t.reports.patientFlowDesc },
  ];

  const HR_REPORTS = [
    { id: "attendance",  icon: "fact_check",      label: t.reports.attendanceOverview,  desc: t.reports.attendanceOverviewDesc },
    { id: "leave",       icon: "event_available", label: t.reports.leaveUtilization,    desc: t.reports.leaveUtilizationDesc },
    { id: "headcount",   icon: "people",          label: t.reports.headcount,           desc: t.reports.headcountDesc },
    { id: "payroll_sum", icon: "payments",        label: t.reports.payrollSummary,      desc: t.reports.payrollSummaryDesc },
  ];

  const [activeTab, setActiveTab] = useState<"overview" | "financial" | "clinical" | "hr">("overview");
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range: dateRange });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/reports/overview?${params}`);
      if (res.ok) setStats(await res.json());
    } catch { /* DB not configured */ }
    finally { setLoading(false); }
  }, [dateRange, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function handleExportCSV() {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) { setExportError("فشل التصدير"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${dateFrom || "all"}_${dateTo || "all"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setExportError("فشل التصدير — تحقق من الاتصال"); }
    finally { setExporting(false); }
  }

  function handleExportPDF() {
    window.print();
  }

  const kpiCards = [
    { label: t.reports.revenueMTD,      value: stats ? formatCurrency(stats.revenueMTD)    : "—", icon: "payments",       change: stats?.revenueChange,      iconBg: "bg-[#d3e4ff]", iconColor: "text-[#1960a3]" },
    { label: t.reports.patientsMTD,     value: stats ? String(stats.patientsMTD)           : "—", icon: "person",         change: stats?.patientsChange,     iconBg: "bg-[#d6e3ff]", iconColor: "text-[#002045]" },
    { label: t.reports.appointmentsMTD, value: stats ? String(stats.appointmentsMTD)       : "—", icon: "calendar_today", change: stats?.appointmentsChange, iconBg: "bg-[#ffddba]", iconColor: "text-[#633f0f]" },
    { label: t.reports.noShowRate,      value: stats ? `${(stats.noShowRate ?? 0).toFixed(1)}%`   : "—", icon: "event_busy",     change: stats?.noShowChange,       iconBg: "bg-[#ffdad6]", iconColor: "text-[#ba1a1a]" },
  ];

  const tabs = [
    { key: "overview",  label: t.reports.overview,    icon: "dashboard" },
    { key: "financial", label: t.reports.financial,   icon: "account_balance" },
    { key: "clinical",  label: t.reports.clinical,    icon: "clinical_notes" },
    { key: "hr",        label: t.reports.hrAnalytics, icon: "badge" },
  ] as const;

  async function handleExport(reportId: string, format: "pdf" | "excel" | "csv", range: DateRange) {
    setExportError(null);
    try {
      const res = await fetch(`/api/reports/export?id=${reportId}&format=${format}&range=${range}`);
      if (!res.ok) { setExportError(t.reports.exportFailed); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportId}_${range}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t.reports.exportRequires);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.reports.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.reports.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value as DateRange); setDateFrom(""); setDateTo(""); }}
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            aria-label="نطاق التاريخ"
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
            aria-label="من تاريخ"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            aria-label="إلى تاريخ"
          />
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {exporting ? "جارٍ التصدير..." : "Excel/CSV"}
          </button>
          <button
            onClick={handleExportPDF}
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
          <button onClick={() => setExportError(null)} className="ms-auto opacity-70 hover:opacity-100 p-1"><span className="material-symbols-outlined text-[16px]">close</span></button>
        </div>
      )}

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
                  <h3 className="text-base font-semibold text-[#1a1c1e]">{t.reports.revenueVsExpenses}</h3>
                  <p className="text-xs text-[#74777f]">{t.reports.monthlyComparison}</p>
                </div>
                <button className="flex items-center gap-1 text-xs text-[#1960a3] font-semibold border border-[#c4c6cf] px-3 py-1.5 rounded-lg hover:bg-[#f4f3f7]">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  {t.reports.export}
                </button>
              </div>
              <div className="h-52 chart-grid rounded-lg border border-[#e3e2e6] bg-[#faf9fd] flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">bar_chart</span>
                  <p className="text-xs text-[#74777f] mt-2">{t.reports.connectDb}</p>
                </div>
              </div>
              <div className="flex gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-[#43474e]"><span className="w-3 h-3 rounded-full bg-[#1960a3]"></span>{t.reports.revenue}</span>
                <span className="flex items-center gap-1.5 text-xs text-[#43474e]"><span className="w-3 h-3 rounded-full bg-[#adc7f7]"></span>{t.reports.expenses_}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e3e2e6] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-semibold text-[#1a1c1e]">{t.reports.patientVolume}</h3>
                  <p className="text-xs text-[#74777f]">{t.reports.newVsReturning}</p>
                </div>
                <button className="flex items-center gap-1 text-xs text-[#1960a3] font-semibold border border-[#c4c6cf] px-3 py-1.5 rounded-lg hover:bg-[#f4f3f7]">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  {t.reports.export}
                </button>
              </div>
              <div className="h-52 chart-grid rounded-lg border border-[#e3e2e6] bg-[#faf9fd] flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">area_chart</span>
                  <p className="text-xs text-[#74777f] mt-2">{t.reports.connectDb}</p>
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
            <ReportCard key={r.id} {...r} generateLabel={t.reports.generateReport} exportLabels={{ pdf: t.reports.exportPDF, excel: t.reports.exportExcel, csv: t.reports.exportCSV }} onExport={(format) => handleExport(r.id, format, dateRange)} />
          ))}
        </div>
      )}

      {/* Clinical Reports Tab */}
      {activeTab === "clinical" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CLINICAL_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r} generateLabel={t.reports.generateReport} exportLabels={{ pdf: t.reports.exportPDF, excel: t.reports.exportExcel, csv: t.reports.exportCSV }} onExport={(format) => handleExport(r.id, format, dateRange)} />
          ))}
        </div>
      )}

      {/* HR Analytics Tab */}
      {activeTab === "hr" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HR_REPORTS.map((r) => (
            <ReportCard key={r.id} {...r} generateLabel={t.reports.generateReport} exportLabels={{ pdf: t.reports.exportPDF, excel: t.reports.exportExcel, csv: t.reports.exportCSV }} onExport={(format) => handleExport(r.id, format, dateRange)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  icon, label, desc, generateLabel, exportLabels, onExport,
}: {
  icon: string; label: string; desc: string;
  generateLabel: string;
  exportLabels: { pdf: string; excel: string; csv: string };
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
          {generateLabel}
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
                {fmt === "pdf" ? exportLabels.pdf : fmt === "excel" ? exportLabels.excel : exportLabels.csv}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

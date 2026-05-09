"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface PayslipData {
  id: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  bonus: number;
  overtimePay: number;
  deductions: number;
  taxDeduction: number;
  absenceDays: number;
  absenceDeduction: number;
  grossSalary: number;
  netSalary: number;
  status: string;
  notes?: string;
}

interface Props {
  payrollId: string;
  onClose: () => void;
}

export function PayslipModal({ payrollId, onClose }: Props) {
  const { t, lang } = useLanguage();
  const [data, setData] = useState<PayslipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/hr/payroll/${payrollId}/payslip`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(() => setError(t.hr.payslipLoadFailed))
      .finally(() => setLoading(false));
  }, [payrollId, t.hr.payslipLoadFailed]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function getMonthName(month: number, year: number) {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-US", { month: "long" })
      .format(new Date(year, month - 1));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payslip-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:fixed print:inset-0 print:bg-white"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] print:border-b-2 print:border-[#002045]">
          <h2 id="payslip-title" className="text-base font-bold text-[var(--txt1)]">{t.hr.payslip}</h2>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => window.print()} className="btn-secondary text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">print</span>
              {t.hr.print}
            </button>
            <button onClick={onClose} aria-label={t.common.close} className="p-2 rounded-lg hover:bg-[var(--surface2)] text-[var(--txt2)]">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-[var(--blue)] text-3xl">progress_activity</span>
            </div>
          )}
          {error && <p className="text-center text-sm text-[var(--err)]">{error}</p>}
          {data && (
            <>
              {/* Employee info */}
              <div className="bg-[#f0f4ff] rounded-xl p-4 space-y-1">
                <p className="font-semibold text-[var(--txt1)]">{data.employeeName}</p>
                <p className="text-sm text-[var(--txt2)]">{data.jobTitle} · {data.department}</p>
                <p className="text-xs text-[var(--txt2)]">
                  {getMonthName(data.month, data.year)} {data.year}
                </p>
              </div>

              {/* Salary breakdown */}
              <div className="space-y-2 text-sm">
                <Row label={t.hr.baseSalary} value={data.basicSalary} positive />
                {data.allowances > 0 && <Row label={t.hr.allowances} value={data.allowances} positive />}
                {data.bonus > 0 && <Row label={t.hr.bonus} value={data.bonus} positive />}
                {data.overtimePay > 0 && <Row label={t.hr.overtimePay} value={data.overtimePay} positive />}

                <div className="border-t border-[var(--border)] pt-2 mt-2">
                  <Row label={t.hr.grossSalary} value={data.grossSalary} bold />
                </div>

                {data.absenceDays > 0 && (
                  <Row label={`${t.hr.absenceDeduction} (${data.absenceDays} ${t.hr.days})`} value={-data.absenceDeduction} negative />
                )}
                {data.deductions > 0 && <Row label={t.hr.otherDeductions} value={-data.deductions} negative />}
                {data.taxDeduction > 0 && <Row label={t.hr.incomeTax} value={-data.taxDeduction} negative />}

                <div className="border-t-2 border-[#002045] pt-2 mt-2">
                  <Row label={t.hr.netSalary} value={data.netSalary} bold large />
                </div>
              </div>

              {data.notes && (
                <p className="text-xs text-[var(--txt2)] border-t border-[var(--border)] pt-3">{data.notes}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, positive, negative, bold, large }: {
  label: string; value: number; positive?: boolean; negative?: boolean; bold?: boolean; large?: boolean;
}) {
  const colorClass = negative ? "text-[var(--err)]" : positive ? "text-[var(--ok)]" : "text-[var(--txt1)]";
  return (
    <div className={`flex justify-between items-center ${bold ? "font-semibold" : ""} ${large ? "text-base" : ""}`}>
      <span className="text-[var(--txt2)]">{label}</span>
      <span className={colorClass}>{Math.abs(value).toFixed(3)}</span>
    </div>
  );
}

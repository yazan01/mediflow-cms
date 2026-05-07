"use client";

import { useState, useEffect } from "react";

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

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export function PayslipModal({ payrollId, onClose }: Props) {
  const [data, setData] = useState<PayslipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/hr/payroll/${payrollId}/payslip`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(() => setError("فشل تحميل بيانات الراتب"))
      .finally(() => setLoading(false));
  }, [payrollId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handlePrint() {
    window.print();
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6] print:border-b-2 print:border-[#002045]">
          <h2 id="payslip-title" className="text-base font-bold text-[#1a1c1e]">إيصال الراتب</h2>
          <div className="flex gap-2 print:hidden">
            <button onClick={handlePrint} className="btn-secondary text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">print</span>
              طباعة
            </button>
            <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-[#f4f3f7] text-[#74777f]">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-[#1960a3] text-3xl">progress_activity</span>
            </div>
          )}
          {error && <p className="text-center text-sm text-[#ba1a1a]">{error}</p>}
          {data && (
            <>
              {/* Employee info */}
              <div className="bg-[#f0f4ff] rounded-xl p-4 space-y-1">
                <p className="font-semibold text-[#1a1c1e]">{data.employeeName}</p>
                <p className="text-sm text-[#43474e]">{data.jobTitle} · {data.department}</p>
                <p className="text-xs text-[#74777f]">
                  {MONTHS_AR[data.month - 1]} {data.year}
                </p>
              </div>

              {/* Salary breakdown */}
              <div className="space-y-2 text-sm">
                <Row label="الراتب الأساسي" value={data.basicSalary} positive />
                {data.allowances > 0 && <Row label="البدلات" value={data.allowances} positive />}
                {data.bonus > 0 && <Row label="المكافأة" value={data.bonus} positive />}
                {data.overtimePay > 0 && <Row label="الساعات الإضافية" value={data.overtimePay} positive />}

                <div className="border-t border-[#e3e2e6] pt-2 mt-2">
                  <Row label="الراتب الإجمالي" value={data.grossSalary} bold />
                </div>

                {data.absenceDays > 0 && (
                  <Row label={`خصم الغياب (${data.absenceDays} يوم)`} value={-data.absenceDeduction} negative />
                )}
                {data.deductions > 0 && <Row label="خصومات أخرى" value={-data.deductions} negative />}
                {data.taxDeduction > 0 && <Row label="ضريبة الدخل" value={-data.taxDeduction} negative />}

                <div className="border-t-2 border-[#002045] pt-2 mt-2">
                  <Row label="صافي الراتب" value={data.netSalary} bold large />
                </div>
              </div>

              {data.notes && (
                <p className="text-xs text-[#74777f] border-t border-[#e3e2e6] pt-3">{data.notes}</p>
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
  const colorClass = negative ? "text-[#ba1a1a]" : positive ? "text-[#0d9488]" : "text-[#1a1c1e]";
  return (
    <div className={`flex justify-between items-center ${bold ? "font-semibold" : ""} ${large ? "text-base" : ""}`}>
      <span className="text-[#43474e]">{label}</span>
      <span className={colorClass}>{Math.abs(value).toFixed(3)}</span>
    </div>
  );
}

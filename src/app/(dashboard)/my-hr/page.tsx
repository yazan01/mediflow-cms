"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTimezone } from "@/lib/TimezoneContext";
import { PayslipModal } from "@/components/PayslipModal";

type Tab = "overview" | "leaves" | "payslips" | "attendance";

interface OwnProfile {
  id: string;
  empCode: string;
  jobTitle: string;
  employmentType: string;
  status: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  hireDate: string | null;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  bankName: string | null;
  bankAccount: string | null;
  department: { name: string } | null;
  user: { name: string; email: string; phone: string | null };
}

interface LeaveRecord {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  approverName: string;
  rejectedReason: string | null;
  createdAt: string;
}

interface PayrollRecord {
  id: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  taxDeduction: number;
  grossSalary: number;
  netSalary: number;
  status: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  overtimeHrs: number | null;
  notes: string | null;
}

export default function MyHrPage() {
  const { t, lang } = useLanguage();
  const { formatDate } = useTimezone();
  const [tab, setTab] = useState<Tab>("overview");

  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);

  const [payslips, setPayslips] = useState<PayrollRecord[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attMonth, setAttMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: "ANNUAL",
    startDate: "",
    endDate: "",
    days: "",
    reason: "",
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveToast, setLeaveToast] = useState("");

  const [payslipId, setPayslipId] = useState<string | null>(null);

  const MONTH_NAMES = lang === "ar"
    ? ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const TYPE_LABELS: Record<string, string> = {
    ANNUAL: t.hr.leaveTypeAnnual,
    SICK: t.hr.leaveTypeSick,
    EMERGENCY: t.hr.leaveTypeEmergency,
    UNPAID: t.hr.leaveTypeUnpaid,
    MATERNITY: t.hr.leaveTypeMaternity,
    PATERNITY: t.hr.leaveTypePaternity,
    STUDY: lang === "ar" ? "إجازة دراسية" : "Study Leave",
  };

  const STATUS_BADGE: Record<string, string> = {
    PENDING: "bg-[#fff7ed] text-[#d97706]",
    APPROVED: "bg-[#ccfbf1] text-[#0d9488]",
    REJECTED: "bg-[#ffdad6] text-[#ba1a1a]",
    CANCELLED: "bg-[#f4f3f7] text-[#74777f]",
  };

  const ATT_BADGE: Record<string, string> = {
    PRESENT: "bg-[#ccfbf1] text-[#0d9488]",
    ABSENT: "bg-[#ffdad6] text-[#ba1a1a]",
    LATE: "bg-[#fff7ed] text-[#d97706]",
    HALF_DAY: "bg-[#eff6ff] text-[#1960a3]",
    ON_LEAVE: "bg-[#f4f3f7] text-[#74777f]",
  };

  const EMP_TYPE_LABELS: Record<string, string> = {
    FULL_TIME: t.hr.fullTime,
    PART_TIME: t.hr.partTime,
    CONTRACT: t.hr.contract,
    INTERN: t.hr.internType,
  };

  const EMP_STATUS_LABELS: Record<string, string> = {
    ACTIVE: t.hr.activeStatus,
    ON_LEAVE: t.hr.onLeaveStatus,
    SUSPENDED: t.hr.inactiveStatus,
    TERMINATED: t.hr.terminated,
  };

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const r = await fetch("/api/hr/me/profile");
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setProfileError(err.detail || t.hr.noEmployeeRecord);
        return;
      }
      setProfile(await r.json());
    } catch {
      setProfileError(t.hr.noEmployeeRecord);
    } finally {
      setProfileLoading(false);
    }
  }, [t.hr.noEmployeeRecord]);

  const loadLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const r = await fetch("/api/hr/me/leaves?pageSize=50");
      if (r.ok) {
        const d = await r.json();
        setLeaves(d.data ?? []);
      }
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  const loadPayslips = useCallback(async () => {
    setPayslipsLoading(true);
    try {
      const r = await fetch("/api/hr/me/payroll?pageSize=24");
      if (r.ok) {
        const d = await r.json();
        setPayslips(d.data ?? []);
      }
    } finally {
      setPayslipsLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const r = await fetch(`/api/hr/me/attendance?month=${attMonth}`);
      if (r.ok) {
        const d = await r.json();
        setAttendance(d.data ?? []);
      }
    } finally {
      setAttLoading(false);
    }
  }, [attMonth]);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => { if (tab === "leaves") loadLeaves(); }, [tab, loadLeaves]);
  useEffect(() => { if (tab === "payslips") loadPayslips(); }, [tab, loadPayslips]);
  useEffect(() => { if (tab === "attendance") loadAttendance(); }, [tab, attMonth, loadAttendance]);

  function computeDays() {
    if (!leaveForm.startDate || !leaveForm.endDate) return;
    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    if (end >= start) {
      const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      setLeaveForm(f => ({ ...f, days: String(days) }));
    }
  }

  async function handleSubmitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.days) return;
    setLeaveSubmitting(true);
    try {
      const res = await fetch("/api/hr/me/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: profile.id,
          type: leaveForm.type,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          days: Number(leaveForm.days),
          reason: leaveForm.reason || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLeaveToast(err.detail || t.hr.leaveCreateFailed);
        setTimeout(() => setLeaveToast(""), 4000);
        return;
      }
      setLeaveModal(false);
      setLeaveForm({ type: "ANNUAL", startDate: "", endDate: "", days: "", reason: "" });
      setLeaveToast(t.hr.leaveCreated);
      setTimeout(() => setLeaveToast(""), 3000);
      loadProfile();
      if (tab === "leaves") loadLeaves();
    } finally {
      setLeaveSubmitting(false);
    }
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "overview",   label: t.hr.myProfile,   icon: "person" },
    { key: "leaves",     label: t.hr.myLeaves,    icon: "event_note" },
    { key: "payslips",   label: t.hr.myPayslips,  icon: "receipt_long" },
    { key: "attendance", label: t.hr.myAttendance, icon: "checklist" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.hr.selfService}</h1>
        <p className="text-sm text-[#74777f] mt-0.5">{t.hr.selfServiceSubtitle}</p>
      </div>

      {/* Toast */}
      {leaveToast && (
        <div className="bg-[#ccfbf1] text-[#0d9488] text-sm px-4 py-2.5 rounded-lg font-medium">
          {leaveToast}
        </div>
      )}

      {/* Loading / error for profile */}
      {profileLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#1960a3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : profileError ? (
        <div className="bg-[#ffdad6] text-[#ba1a1a] px-4 py-6 rounded-xl text-center">
          <span className="material-symbols-outlined text-3xl block mb-2">error</span>
          {profileError}
        </div>
      ) : profile && (
        <>
          {/* Quick-stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs text-[#74777f] uppercase tracking-wider font-semibold">{t.hr.annualLeave}</p>
              <p className="text-2xl font-bold text-[#1960a3] mt-1">{profile.annualLeaveBalance}</p>
              <p className="text-xs text-[#74777f]">{t.hr.daysUnit} {t.hr.balanceAvailable}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-[#74777f] uppercase tracking-wider font-semibold">{t.hr.sickLeaveBalance}</p>
              <p className="text-2xl font-bold text-[#1960a3] mt-1">{profile.sickLeaveBalance}</p>
              <p className="text-xs text-[#74777f]">{t.hr.daysUnit} {t.hr.balanceAvailable}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-[#74777f] uppercase tracking-wider font-semibold">{t.hr.netSalary}</p>
              <p className="text-2xl font-bold text-[#002045] mt-1">
                {(profile.basicSalary + profile.housingAllowance + profile.transportAllowance + profile.medicalAllowance).toLocaleString()}
              </p>
              <p className="text-xs text-[#74777f]">{lang === "ar" ? "د.أ / شهر" : "JOD / mo"}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-[#74777f] uppercase tracking-wider font-semibold">{t.hr.status}</p>
              <p className="text-lg font-semibold text-[#0d9488] mt-1">{EMP_STATUS_LABELS[profile.status] ?? profile.status}</p>
              <p className="text-xs text-[#74777f]">{profile.empCode}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-[#e3e2e6]">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {TABS.map(tb => (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    tab === tb.key
                      ? "border-[#1960a3] text-[#1960a3]"
                      : "border-transparent text-[#74777f] hover:text-[#43474e]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tb.icon}</span>
                  {tb.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Overview ── */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal */}
              <div className="card p-5 space-y-4">
                <h2 className="font-semibold text-[#1a1c1e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1960a3]">person</span>
                  {t.hr.personalInfo}
                </h2>
                <dl className="space-y-3">
                  <Row label={t.hr.employee} val={profile.user.name} />
                  <Row label={t.hr.email} val={profile.user.email} />
                  {profile.user.phone && <Row label={t.hr.phone} val={profile.user.phone} />}
                  <Row label={t.hr.empCode} val={profile.empCode} />
                </dl>
              </div>

              {/* Employment */}
              <div className="card p-5 space-y-4">
                <h2 className="font-semibold text-[#1a1c1e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1960a3]">badge</span>
                  {t.hr.employmentInfo}
                </h2>
                <dl className="space-y-3">
                  <Row label={t.hr.deptTitle} val={`${profile.department?.name ?? "—"} / ${profile.jobTitle}`} />
                  <Row label={t.hr.type} val={EMP_TYPE_LABELS[profile.employmentType] ?? profile.employmentType} />
                  <Row label={t.hr.hireDate} val={profile.hireDate ? formatDate(profile.hireDate) : "—"} />
                  <Row label={t.hr.status} val={EMP_STATUS_LABELS[profile.status] ?? profile.status} />
                </dl>
              </div>

              {/* Compensation */}
              <div className="card p-5 space-y-4">
                <h2 className="font-semibold text-[#1a1c1e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1960a3]">payments</span>
                  {t.hr.compensationInfo}
                </h2>
                <dl className="space-y-3">
                  <Row label={t.hr.baseSalary} val={`${profile.basicSalary.toLocaleString()} JOD`} />
                  <Row label={t.hr.housingAllowance} val={`${profile.housingAllowance.toLocaleString()} JOD`} />
                  <Row label={t.hr.transportAllowance} val={`${profile.transportAllowance.toLocaleString()} JOD`} />
                  <Row label={t.hr.medicalAllowance} val={`${profile.medicalAllowance.toLocaleString()} JOD`} />
                </dl>
              </div>

              {/* Bank */}
              <div className="card p-5 space-y-4">
                <h2 className="font-semibold text-[#1a1c1e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1960a3]">account_balance</span>
                  {t.hr.bankInfo}
                </h2>
                {profile.bankName || profile.bankAccount ? (
                  <dl className="space-y-3">
                    {profile.bankName && <Row label={t.hr.bankName} val={profile.bankName} />}
                    {profile.bankAccount && <Row label={t.hr.bankAccount} val={profile.bankAccount} />}
                  </dl>
                ) : (
                  <p className="text-sm text-[#74777f]">{t.hr.noBankInfo}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Leaves ── */}
          {tab === "leaves" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[#1a1c1e]">{t.hr.myLeaves}</h2>
                <button
                  onClick={() => setLeaveModal(true)}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {t.hr.submitLeave}
                </button>
              </div>

              {leavesLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#1960a3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : leaves.length === 0 ? (
                <div className="card p-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-[#74777f] block mb-2">event_note</span>
                  <p className="text-[#74777f] text-sm">{t.hr.noLeave}</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e3e2e6]">
                        <th className="table-header">{t.hr.leaveType}</th>
                        <th className="table-header">{t.hr.startDate}</th>
                        <th className="table-header">{t.hr.endDate}</th>
                        <th className="table-header">{t.hr.days}</th>
                        <th className="table-header">{t.hr.status}</th>
                        <th className="table-header">{t.hr.approver}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e3e2e6]">
                      {leaves.map(lr => (
                        <tr key={lr.id} className="table-row">
                          <td className="table-cell font-medium">{TYPE_LABELS[lr.type] ?? lr.type}</td>
                          <td className="table-cell">{formatDate(lr.startDate)}</td>
                          <td className="table-cell">{formatDate(lr.endDate)}</td>
                          <td className="table-cell">{lr.days}</td>
                          <td className="table-cell">
                            <span className={`badge ${STATUS_BADGE[lr.status] ?? "bg-[#f4f3f7] text-[#74777f]"}`}>
                              {lr.status}
                            </span>
                          </td>
                          <td className="table-cell text-[#74777f]">
                            {lr.approverName || "—"}
                            {lr.rejectedReason && (
                              <p className="text-xs text-[#ba1a1a] mt-0.5">{lr.rejectedReason}</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Payslips ── */}
          {tab === "payslips" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-[#1a1c1e]">{t.hr.myPayslips}</h2>
              {payslipsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#1960a3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : payslips.length === 0 ? (
                <div className="card p-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-[#74777f] block mb-2">receipt_long</span>
                  <p className="text-[#74777f] text-sm">{t.hr.noPayslips}</p>
                  <p className="text-xs text-[#74777f] mt-1">{t.hr.noPayslipsDesc}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {payslips.map(p => (
                    <div key={p.id} className="card p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-[#1a1c1e]">
                            {MONTH_NAMES[p.month - 1]} {p.year}
                          </p>
                          <span className={`badge text-xs ${p.status === "PROCESSED" ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#fff7ed] text-[#d97706]"}`}>
                            {p.status === "PROCESSED" ? t.hr.processed : t.hr.pendingStatus}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[#74777f]">receipt_long</span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between text-[#74777f]">
                          <span>{t.hr.baseSalary}</span>
                          <span>{p.basicSalary.toLocaleString()} JOD</span>
                        </div>
                        <div className="flex justify-between text-[#74777f]">
                          <span>{t.hr.allowances}</span>
                          <span>+{p.allowances.toLocaleString()} JOD</span>
                        </div>
                        {p.bonus > 0 && (
                          <div className="flex justify-between text-[#0d9488]">
                            <span>{t.hr.bonus}</span>
                            <span>+{p.bonus.toLocaleString()} JOD</span>
                          </div>
                        )}
                        {(p.deductions + p.taxDeduction) > 0 && (
                          <div className="flex justify-between text-[#ba1a1a]">
                            <span>{t.hr.deductions}</span>
                            <span>-{(p.deductions + p.taxDeduction).toLocaleString()} JOD</span>
                          </div>
                        )}
                        <div className="border-t border-[#e3e2e6] pt-1.5 flex justify-between font-semibold">
                          <span>{t.hr.netSalary}</span>
                          <span className="text-[#002045]">{p.netSalary.toLocaleString()} JOD</span>
                        </div>
                      </div>
                      {p.id && (
                        <button
                          onClick={() => setPayslipId(p.id)}
                          className="mt-3 w-full btn-secondary text-sm py-1.5 flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">print</span>
                          {t.hr.viewPayslip}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Attendance ── */}
          {tab === "attendance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-semibold text-[#1a1c1e]">{t.hr.myAttendance}</h2>
                <input
                  type="month"
                  className="input-field w-44"
                  value={attMonth}
                  onChange={e => setAttMonth(e.target.value)}
                />
              </div>
              {attLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#1960a3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : attendance.length === 0 ? (
                <div className="card p-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-[#74777f] block mb-2">checklist</span>
                  <p className="text-[#74777f] text-sm">{t.hr.noAttendanceOwn}</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e3e2e6]">
                        <th className="table-header">{t.hr.attDate}</th>
                        <th className="table-header">{t.hr.attStatus}</th>
                        <th className="table-header">Check-In</th>
                        <th className="table-header">Check-Out</th>
                        <th className="table-header">{t.hr.overtimePay}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e3e2e6]">
                      {attendance.map(a => (
                        <tr key={a.id} className="table-row">
                          <td className="table-cell">{a.date}</td>
                          <td className="table-cell">
                            <span className={`badge ${ATT_BADGE[a.status] ?? "bg-[#f4f3f7] text-[#74777f]"}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="table-cell">{a.checkIn ?? "—"}</td>
                          <td className="table-cell">{a.checkOut ?? "—"}</td>
                          <td className="table-cell">{a.overtimeHrs != null ? `${a.overtimeHrs}h` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Leave Submission Modal ── */}
      {leaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 id="leave-modal-title" className="text-lg font-semibold text-[#1a1c1e]">
                {t.hr.submitLeave}
              </h2>
              <button
                onClick={() => setLeaveModal(false)}
                className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors"
                aria-label={t.common.cancel}
              >
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                  {t.hr.leaveType} *
                </label>
                <select
                  className="input-field"
                  value={leaveForm.type}
                  onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}
                  required
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                    {t.hr.startDate} *
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={leaveForm.startDate}
                    onChange={e => {
                      setLeaveForm(f => ({ ...f, startDate: e.target.value }));
                      setTimeout(computeDays, 0);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                    {t.hr.endDate} *
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={leaveForm.endDate}
                    onChange={e => {
                      setLeaveForm(f => ({ ...f, endDate: e.target.value }));
                      setTimeout(computeDays, 0);
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                  {t.hr.leaveDaysLabel}
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={leaveForm.days}
                  readOnly
                  min={1}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
                  {t.hr.leaveReason}
                </label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder={t.hr.leaveReasonPlaceholder}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e2e6]">
                <button
                  type="button"
                  onClick={() => setLeaveModal(false)}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={leaveSubmitting}
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                >
                  {leaveSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  ) : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip print modal */}
      {payslipId && (
        <PayslipModal payrollId={payslipId} onClose={() => setPayslipId(null)} />
      )}
    </div>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <dt className="text-[#74777f] shrink-0">{label}</dt>
      <dd className="text-[#1a1c1e] font-medium text-end">{val}</dd>
    </div>
  );
}

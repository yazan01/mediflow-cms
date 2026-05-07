"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { Employee, LeaveRequest } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// ─── Local types ─────────────────────────────────────────────────────────────

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  dayNames: string[];
  branchId: string | null;
  branchName: string | null;
  color: string;
  isActive: boolean;
  assignmentCount: number;
}

interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  shiftId: string;
  shiftName: string;
  startDate: string;
  endDate: string | null;
  notes: string;
}

interface Branch { id: string; name: string; }

interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  days: Record<string, "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HOLIDAY">;
}

interface PayrollRecord {
  employeeId: string;
  employeeName: string;
  department: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: "PROCESSED" | "PENDING";
}

interface HRStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  pendingLeaveRequests: number;
}

// ─── Status configs ───────────────────────────────────────────────────────────

const ATT_MARKER: Record<string, { sym: string; cls: string }> = {
  PRESENT: { sym: "check_circle", cls: "text-[#0d9488]" },
  ABSENT:  { sym: "cancel",       cls: "text-[#ba1a1a]" },
  LATE:    { sym: "schedule",     cls: "text-[#d97706]" },
  LEAVE:   { sym: "event_busy",   cls: "text-[#1960a3]" },
  HOLIDAY: { sym: "celebration",  cls: "text-[#74777f]" },
};

// ─── Helper sub-components ────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20">
      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
      <p className="text-sm text-[#74777f]">{label}</p>
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

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function StatCard({ icon, iconBg, iconColor, label, value }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex items-center gap-4">
      <div className={`p-3 ${iconBg} rounded-2xl flex-shrink-0`}>
        <span className={`material-symbols-outlined ${iconColor} text-[22px]`}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-[#1a1c1e]">{value}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HRPage() {
  const { t } = useLanguage();

  const EMP_STATUS: Record<string, { label: string; cls: string }> = {
    ACTIVE:      { label: t.hr.activeStatus,   cls: "bg-[#ccfbf1] text-[#0d9488]" },
    ON_LEAVE:    { label: t.hr.onLeaveStatus,  cls: "bg-[#fff7ed] text-[#d97706]" },
    INACTIVE:    { label: t.hr.inactiveStatus, cls: "bg-[#e3e2e6] text-[#74777f]" },
    TERMINATED:  { label: t.hr.terminated,     cls: "bg-[#ffdad6] text-[#ba1a1a]" },
  };

  const EMP_TYPE: Record<string, { label: string; cls: string }> = {
    FULL_TIME: { label: t.hr.fullTime, cls: "bg-[#d3e4ff] text-[#1960a3]" },
    PART_TIME: { label: t.hr.partTime, cls: "bg-[#e9e7eb] text-[#43474e]" },
    CONTRACT:  { label: t.hr.contract, cls: "bg-[#ffddba] text-[#633f0f]" },
  };

  const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: t.common.pending,   cls: "bg-[#fff7ed] text-[#d97706]" },
    APPROVED: { label: t.common.approved,  cls: "bg-[#ccfbf1] text-[#0d9488]" },
    REJECTED: { label: t.common.rejected,  cls: "bg-[#ffdad6] text-[#ba1a1a]" },
    CANCELLED:{ label: t.common.cancel,    cls: "bg-[#e3e2e6] text-[#74777f]" },
  };

  type Tab = "employees" | "attendance" | "leaveRequests" | "payroll" | "shifts";
  const TABS: { key: Tab; label: string }[] = [
    { key: "employees",     label: t.hr.employees },
    { key: "attendance",    label: t.hr.attendance },
    { key: "leaveRequests", label: t.hr.leaveRequests },
    { key: "payroll",       label: t.hr.payroll },
    { key: "shifts",        label: t.hr.shifts },
  ];

  const [activeTab, setActiveTab] = useState<Tab>("employees");

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("ALL");
  const [empStatusFilter, setEmpStatusFilter] = useState("ALL");
  const [empPage, setEmpPage] = useState(1);
  const [empTotal, setEmpTotal] = useState(0);

  // Attendance
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attSearch, setAttSearch] = useState("");
  const [attMonth, setAttMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Leave Requests
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL");

  // Payroll
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Stats
  const [stats, setStats] = useState<HRStats | null>(null);

  // Shifts
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shiftModal, setShiftModal] = useState<"add" | "edit" | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState({ name: "", startTime: "08:00", endTime: "17:00", daysOfWeek: [0, 1, 2, 3, 4] as number[], branchId: "", color: "#1960a3" });
  const [shiftSaving, setShiftSaving] = useState(false);
  const [shiftError, setShiftError] = useState("");
  const [assignModal, setAssignModal] = useState<Shift | null>(null);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [assignForm, setAssignForm] = useState({ employeeId: "", startDate: "", endDate: "", notes: "" });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");

  const PAGE_SIZE = 10;

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const p = new URLSearchParams({
        page: String(empPage),
        pageSize: String(PAGE_SIZE),
        ...(empSearch && { search: empSearch }),
        ...(empDeptFilter !== "ALL" && { department: empDeptFilter }),
        ...(empStatusFilter !== "ALL" && { status: empStatusFilter }),
      });
      const res = await fetch(`/api/hr/employees?${p}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data ?? []);
        setEmpTotal(data.total ?? 0);
      }
    } catch { /* network error */ } finally {
      setEmpLoading(false);
    }
  }, [empPage, empSearch, empDeptFilter, empStatusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/hr/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const p = new URLSearchParams({ month: attMonth, ...(attSearch && { search: attSearch }) });
      const res = await fetch(`/api/hr/attendance?${p}`);
      if (res.ok) {
        const data = await res.json();
        setAttendance(data.data ?? []);
      }
    } catch { /* ignore */ } finally {
      setAttLoading(false);
    }
  }, [attMonth, attSearch]);

  const fetchLeaves = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const p = new URLSearchParams({
        ...(leaveStatusFilter !== "ALL" && { status: leaveStatusFilter }),
      });
      const res = await fetch(`/api/hr/leaves?${p}`);
      if (res.ok) {
        const data = await res.json();
        setLeaves(data.data ?? []);
      }
    } catch { /* ignore */ } finally {
      setLeaveLoading(false);
    }
  }, [leaveStatusFilter]);

  const fetchPayroll = useCallback(async () => {
    setPayrollLoading(true);
    try {
      const p = new URLSearchParams({ month: payrollMonth });
      const res = await fetch(`/api/hr/payroll?${p}`);
      if (res.ok) {
        const data = await res.json();
        setPayroll(data.data ?? []);
      }
    } catch { /* ignore */ } finally {
      setPayrollLoading(false);
    }
  }, [payrollMonth]);

  const fetchShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const p = branchFilter ? `?branch_id=${branchFilter}` : "";
      const res = await fetch(`/api/shifts${p}`);
      if (res.ok) setShifts(await res.json());
    } catch { /* ignore */ } finally {
      setShiftsLoading(false);
    }
  }, [branchFilter]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch("/api/branches");
      if (res.ok) setBranches(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchAssignments = useCallback(async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/assignments`);
      if (res.ok) setAssignments(await res.json());
    } catch { /* ignore */ }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (activeTab === "attendance") fetchAttendance(); }, [activeTab, fetchAttendance]);
  useEffect(() => { if (activeTab === "leaveRequests") fetchLeaves(); }, [activeTab, fetchLeaves]);
  useEffect(() => { if (activeTab === "payroll") fetchPayroll(); }, [activeTab, fetchPayroll]);
  useEffect(() => { if (activeTab === "shifts") { fetchShifts(); fetchBranches(); } }, [activeTab, fetchShifts, fetchBranches]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleLeaveAction(id: string, action: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch(`/api/hr/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) fetchLeaves();
    } catch { /* ignore */ }
  }

  function openAddShift() {
    setShiftForm({ name: "", startTime: "08:00", endTime: "17:00", daysOfWeek: [0, 1, 2, 3, 4], branchId: "", color: "#1960a3" });
    setEditingShift(null);
    setShiftError("");
    setShiftModal("add");
  }

  function openEditShift(s: Shift) {
    setShiftForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, daysOfWeek: s.daysOfWeek, branchId: s.branchId ?? "", color: s.color });
    setEditingShift(s);
    setShiftError("");
    setShiftModal("edit");
  }

  async function saveShift() {
    if (!shiftForm.name.trim()) { setShiftError("Shift name is required."); return; }
    setShiftSaving(true);
    setShiftError("");
    try {
      const url = shiftModal === "edit" && editingShift ? `/api/shifts/${editingShift.id}` : "/api/shifts";
      const method = shiftModal === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...shiftForm, branchId: shiftForm.branchId || null }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setShiftError(e.detail || "Failed to save."); return; }
      setShiftModal(null);
      fetchShifts();
    } catch { setShiftError("Network error."); } finally { setShiftSaving(false); }
  }

  async function deleteShift(id: string) {
    if (!window.confirm(t.common.confirmDelete)) return;
    await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    fetchShifts();
  }

  function openAssignModal(s: Shift) {
    setAssignModal(s);
    setAssignForm({ employeeId: "", startDate: "", endDate: "", notes: "" });
    setAssignError("");
    fetchAssignments(s.id);
  }

  async function saveAssignment() {
    if (!assignModal || !assignForm.employeeId || !assignForm.startDate) { setAssignError("Employee and start date are required."); return; }
    setAssignSaving(true);
    setAssignError("");
    try {
      const res = await fetch("/api/shifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: assignForm.employeeId, shiftId: assignModal.id, startDate: assignForm.startDate, endDate: assignForm.endDate || null, notes: assignForm.notes }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setAssignError(e.detail || "Failed to assign."); return; }
      setAssignForm({ employeeId: "", startDate: "", endDate: "", notes: "" });
      fetchAssignments(assignModal.id);
      fetchShifts();
    } catch { setAssignError("Network error."); } finally { setAssignSaving(false); }
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/shifts/assignments/${id}`, { method: "DELETE" });
    if (assignModal) fetchAssignments(assignModal.id);
    fetchShifts();
  }

  async function handleProcessPayroll(employeeId: string) {
    try {
      const res = await fetch(`/api/hr/payroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, month: payrollMonth }),
      });
      if (res.ok) fetchPayroll();
    } catch { /* ignore */ }
  }

  // ── Attendance calendar days ───────────────────────────────────────────────

  const attDaysInMonth = (() => {
    const [yr, mo] = attMonth.split("-").map(Number);
    const count = new Date(yr, mo, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  })();

  const empTotalPages = Math.ceil(empTotal / PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.hr.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.hr.subtitle}</p>
        </div>
        <Link
          href="/hr/new"
          className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t.hr.addEmployee}
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="groups" iconBg="bg-[#d3e4ff]" iconColor="text-[#1960a3]" label={t.hr.totalEmployees} value={stats?.totalEmployees ?? "—"} />
        <StatCard icon="check_circle" iconBg="bg-[#ccfbf1]" iconColor="text-[#0d9488]" label={t.hr.active} value={stats?.activeEmployees ?? "—"} />
        <StatCard icon="event_busy" iconBg="bg-[#fff7ed]" iconColor="text-[#d97706]" label={t.hr.onLeave} value={stats?.onLeave ?? "—"} />
        <StatCard icon="pending_actions" iconBg="bg-[#ffddba]" iconColor="text-[#633f0f]" label={t.hr.pendingLeave} value={stats?.pendingLeaveRequests ?? "—"} />
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

      {/* ── Tab: Employees ── */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
                <input
                  className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                  placeholder={t.hr.searchPlaceholder}
                  value={empSearch}
                  onChange={(e) => { setEmpSearch(e.target.value); setEmpPage(1); }}
                />
              </div>
              <select
                className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                value={empStatusFilter}
                onChange={(e) => { setEmpStatusFilter(e.target.value); setEmpPage(1); }}
              >
                <option value="ALL">{t.hr.allStatuses}</option>
                <option value="ACTIVE">{t.hr.activeStatus}</option>
                <option value="ON_LEAVE">{t.hr.onLeaveStatus}</option>
                <option value="INACTIVE">{t.hr.inactiveStatus}</option>
                <option value="TERMINATED">{t.hr.terminated}</option>
              </select>
              <select
                className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                value={empDeptFilter}
                onChange={(e) => { setEmpDeptFilter(e.target.value); setEmpPage(1); }}
              >
                <option value="ALL">{t.hr.allDepts}</option>
                <option value="Medical">{t.hr.medical}</option>
                <option value="Nursing">{t.hr.nursing}</option>
                <option value="Admin">{t.hr.administration}</option>
                <option value="Finance">{t.hr.finance}</option>
                <option value="HR">{t.hr.humanResources}</option>
              </select>
              <button className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2.5 rounded-lg text-sm text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors">
                <span className="material-symbols-outlined text-[18px]">download</span>
                {t.hr.export}
              </button>
            </div>
          </div>

          {/* Employees table */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {[t.hr.employee, t.hr.code, t.hr.deptTitle, t.hr.type, t.hr.status, t.hr.salary, t.hr.hireDate, t.hr.attPct, t.hr.leaveBal, t.hr.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empLoading ? (
                    <tr><td colSpan={10}><Spinner label={t.hr.loading} /></td></tr>
                  ) : employees.length === 0 ? (
                    <EmptyRow cols={10} icon="badge" label={t.hr.noEmployees} sub={empSearch ? t.hr.searchPlaceholder : t.hr.addFirst} />
                  ) : employees.map((emp) => {
                    const statusCfg = EMP_STATUS[emp.status] ?? EMP_STATUS.INACTIVE;
                    const typeCfg = EMP_TYPE[emp.employmentType] ?? EMP_TYPE.FULL_TIME;
                    return (
                      <tr key={emp.id} className="hover:bg-[#f4f3f7] transition-colors group">
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#002045] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {getInitials(emp.user.name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors whitespace-nowrap">{emp.user.name}</p>
                              <p className="text-xs text-[#74777f]">{emp.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <span className="text-xs font-mono font-semibold text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded">{emp.empCode}</span>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <p className="text-sm text-[#1a1c1e]">{emp.department.name}</p>
                          <p className="text-xs text-[#74777f]">{emp.jobTitle}</p>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${typeCfg.cls}`}>{typeCfg.label}</span>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusCfg.cls}`}>{statusCfg.label}</span>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6] text-sm text-[#1a1c1e]">
                          {formatCurrency(emp.basicSalary)}
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6] text-sm text-[#43474e] whitespace-nowrap">
                          {formatDate(emp.hireDate)}
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <span className="text-xs text-[#74777f]">—</span>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6] text-sm text-[#43474e]">
                          {emp.annualLeaveBalance != null ? `${emp.annualLeaveBalance} days` : "—"}
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <div className="flex items-center gap-1">
                            <Link href={`/hr/${emp.id}`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="View Profile">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </Link>
                            <Link href={`/hr/${emp.id}/edit`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="Edit">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </Link>
                            <Link href={`/hr/${emp.id}/payslips`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="View Payslips">
                              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {empTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[#e3e2e6] bg-[#faf9fd]">
                <p className="text-xs text-[#74777f]">
                  {t.hr.showing} {((empPage - 1) * PAGE_SIZE) + 1}–{Math.min(empPage * PAGE_SIZE, empTotal)} of {empTotal} {t.hr.employeesLabel}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEmpPage((p) => Math.max(1, p - 1))} disabled={empPage === 1} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  {Array.from({ length: Math.min(5, empTotalPages) }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setEmpPage(p)} className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${empPage === p ? "bg-[#002045] text-white" : "hover:bg-[#f4f3f7] text-[#43474e]"}`}>{p}</button>
                  ))}
                  <button onClick={() => setEmpPage((p) => Math.min(empTotalPages, p + 1))} disabled={empPage === empTotalPages} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Attendance ── */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder={t.hr.searchPlaceholder}
                value={attSearch}
                onChange={(e) => setAttSearch(e.target.value)}
              />
            </div>
            <input
              type="month"
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={attMonth}
              onChange={(e) => setAttMonth(e.target.value)}
            />
            <div className="flex items-center gap-4 text-xs text-[#43474e]">
              {Object.entries(ATT_MARKER).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`material-symbols-outlined text-[14px] ${v.cls}`}>{v.sym}</span>
                  {k.charAt(0) + k.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    <th className="sticky left-0 bg-[#f4f3f7] text-left font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3 whitespace-nowrap z-10">{t.hr.employee}</th>
                    {attDaysInMonth.map((d) => (
                      <th key={d} className="text-center font-semibold text-[#43474e] px-2 py-3 w-8">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attLoading ? (
                    <tr><td colSpan={attDaysInMonth.length + 1}><Spinner label={t.hr.loading} /></td></tr>
                  ) : attendance.length === 0 ? (
                    <tr><td colSpan={attDaysInMonth.length + 1} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-[#74777f] text-3xl">calendar_month</span>
                        <p className="text-sm font-semibold text-[#1a1c1e]">{t.hr.noAttendance}</p>
                      </div>
                    </td></tr>
                  ) : attendance.map((rec) => (
                    <tr key={rec.employeeId} className="hover:bg-[#f4f3f7] transition-colors border-b border-[#e3e2e6]">
                      <td className="sticky left-0 bg-white hover:bg-[#f4f3f7] px-5 py-3 font-semibold text-[#1a1c1e] whitespace-nowrap z-10">{rec.employeeName}</td>
                      {attDaysInMonth.map((d) => {
                        const key = `${attMonth}-${String(d).padStart(2, "0")}`;
                        const marker = rec.days[key];
                        const cfg = marker ? ATT_MARKER[marker] : null;
                        return (
                          <td key={d} className="text-center px-1 py-3">
                            {cfg ? (
                              <span className={`material-symbols-outlined text-[14px] ${cfg.cls}`}>{cfg.sym}</span>
                            ) : (
                              <span className="text-[#e3e2e6]">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Leave Requests ── */}
      {activeTab === "leaveRequests" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex gap-3">
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={leaveStatusFilter}
              onChange={(e) => setLeaveStatusFilter(e.target.value)}
            >
              <option value="ALL">{t.hr.allRequests}</option>
              <option value="PENDING">{t.common.pending}</option>
              <option value="APPROVED">{t.common.approved}</option>
              <option value="REJECTED">{t.common.rejected}</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {[t.hr.employee, t.hr.leaveType, t.hr.startDate, t.hr.endDate, t.hr.days, t.common.status, t.hr.approver, t.common.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaveLoading ? (
                    <tr><td colSpan={8}><Spinner label={t.hr.loading} /></td></tr>
                  ) : leaves.length === 0 ? (
                    <EmptyRow cols={8} icon="event_busy" label={t.hr.noLeave} sub={t.hr.noLeaveDesc} />
                  ) : leaves.map((lr) => {
                    const sc = LEAVE_STATUS[lr.status] ?? LEAVE_STATUS.PENDING;
                    return (
                      <tr key={lr.id} className="hover:bg-[#f4f3f7] transition-colors border-b border-[#e3e2e6]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#002045] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {getInitials(lr.employeeName ?? lr.employee?.user?.name ?? "?")}
                            </div>
                            <p className="text-sm font-semibold text-[#1a1c1e] whitespace-nowrap">{lr.employeeName ?? lr.employee?.user?.name ?? "—"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#43474e] capitalize">{lr.type.replace("_", " ")}</td>
                        <td className="px-5 py-4 text-sm text-[#43474e] whitespace-nowrap">{formatDate(lr.startDate)}</td>
                        <td className="px-5 py-4 text-sm text-[#43474e] whitespace-nowrap">{formatDate(lr.endDate)}</td>
                        <td className="px-5 py-4 text-sm text-[#43474e]">{lr.days}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#43474e]">{lr.approvedById ?? "—"}</td>
                        <td className="px-5 py-4">
                          {lr.status === "PENDING" ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleLeaveAction(lr.id, "APPROVED")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#ccfbf1] text-[#0d9488] text-xs font-semibold rounded-lg hover:bg-[#0d9488] hover:text-white transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">check</span>
                                {t.hr.approve}
                              </button>
                              <button
                                onClick={() => handleLeaveAction(lr.id, "REJECTED")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#ffdad6] text-[#ba1a1a] text-xs font-semibold rounded-lg hover:bg-[#ba1a1a] hover:text-white transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                                {t.hr.reject}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#74777f]">—</span>
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

      {/* ── Tab: Payroll ── */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex items-center gap-4">
            <label className="text-sm font-semibold text-[#43474e]">{t.hr.payrollMonth}</label>
            <input
              type="month"
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
            />
            <button className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors">
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t.hr.exportPayroll}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f4f3f7] border-b border-[#e3e2e6]">
                    {[t.hr.employee, t.hr.department, t.hr.baseSalary, t.hr.allowances, t.hr.deductions, t.hr.netPay, t.common.status, t.hr.process].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrollLoading ? (
                    <tr><td colSpan={8}><Spinner label={t.hr.loading} /></td></tr>
                  ) : payroll.length === 0 ? (
                    <EmptyRow cols={8} icon="payments" label={t.hr.noPayroll} sub={t.hr.noPayrollDesc} />
                  ) : payroll.map((pr) => (
                    <tr key={pr.employeeId} className="hover:bg-[#f4f3f7] transition-colors border-b border-[#e3e2e6]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#002045] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {getInitials(pr.employeeName)}
                          </div>
                          <p className="text-sm font-semibold text-[#1a1c1e] whitespace-nowrap">{pr.employeeName}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#43474e]">{pr.department}</td>
                      <td className="px-5 py-4 text-sm text-[#43474e]">{formatCurrency(pr.baseSalary)}</td>
                      <td className="px-5 py-4 text-sm text-[#0d9488]">+{formatCurrency(pr.allowances)}</td>
                      <td className="px-5 py-4 text-sm text-[#ba1a1a]">-{formatCurrency(pr.deductions)}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#1a1c1e]">{formatCurrency(pr.netPay)}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pr.status === "PROCESSED" ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#fff7ed] text-[#d97706]"}`}>
                          {pr.status === "PROCESSED" ? t.hr.processed : t.hr.pendingStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {pr.status === "PENDING" ? (
                          <button
                            onClick={() => handleProcessPayroll(pr.employeeId)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#002045] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                          >
                            <span className="material-symbols-outlined text-[14px]">payments</span>
                            {t.hr.process}
                          </button>
                        ) : (
                          <Link
                            href={`/hr/payslips/${pr.employeeId}?month=${payrollMonth}`}
                            className="flex items-center gap-1 px-3 py-1.5 border border-[#c4c6cf] text-[#43474e] text-xs font-semibold rounded-lg hover:bg-[#f4f3f7] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                            {t.hr.payslip}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Shifts ── */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex flex-wrap items-center gap-3">
            <select
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="">{t.hr.allBranches}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div className="flex-1" />
            <button
              onClick={openAddShift}
              className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t.hr.addShift}
            </button>
          </div>

          {/* Shifts grid */}
          {shiftsLoading ? (
            <Spinner label={t.hr.loading} />
          ) : shifts.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-16 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">schedule</span>
              <p className="text-sm font-semibold text-[#43474e]">{t.hr.noShifts}</p>
              <p className="text-xs text-[#74777f]">{t.hr.noShiftsDesc}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {shifts.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <div>
                        <p className="text-sm font-semibold text-[#1a1c1e]">{s.name}</p>
                        {s.branchName && <p className="text-xs text-[#74777f]">{s.branchName}</p>}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#e3e2e6] text-[#74777f]"}`}>
                      {s.isActive ? t.hr.shiftActive : t.hr.shiftInactive}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-sm text-[#43474e]">
                    <span className="material-symbols-outlined text-[#74777f] text-[16px]">schedule</span>
                    {s.startTime} – {s.endTime}
                    <span className="text-xs text-[#74777f] bg-[#f4f3f7] px-2 py-0.5 rounded-full ms-1">
                      {calcDuration(s.startTime, s.endTime)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, i) => (
                      <span key={day} className={`text-xs px-2 py-0.5 rounded font-medium ${s.daysOfWeek.includes(i) ? "bg-[#d3e4ff] text-[#1960a3]" : "bg-[#f4f3f7] text-[#c4c6cf]"}`}>{day}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-[#e3e2e6] pt-3">
                    <button
                      onClick={() => openAssignModal(s)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#1960a3] hover:underline"
                    >
                      <span className="material-symbols-outlined text-[14px]">groups</span>
                      {s.assignmentCount} {t.hr.assignments}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditShift(s)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[#74777f] text-[16px]">edit</span>
                      </button>
                      <button onClick={() => deleteShift(s.id)} className="p-1.5 hover:bg-[#ffdad6] rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[#ba1a1a] text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shift Add/Edit Modal ── */}
      {shiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShiftModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 className="text-lg font-bold text-[#1a1c1e]">{shiftModal === "add" ? t.hr.addShift : t.hr.editShift}</h2>
              <button onClick={() => setShiftModal(null)} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {shiftError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{shiftError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.shiftName} *</label>
                <input className="input-field" placeholder="Morning Shift" value={shiftForm.name} onChange={(e) => setShiftForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.startTime}</label>
                  <input type="time" className="input-field" value={shiftForm.startTime} onChange={(e) => setShiftForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.endTime}</label>
                  <input type="time" className="input-field" value={shiftForm.endTime} onChange={(e) => setShiftForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.daysOfWeek}</label>
                <div className="flex gap-2 flex-wrap">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setShiftForm(f => ({ ...f, daysOfWeek: f.daysOfWeek.includes(i) ? f.daysOfWeek.filter(d => d !== i) : [...f.daysOfWeek, i].sort() }))}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${shiftForm.daysOfWeek.includes(i) ? "bg-[#002045] text-white border-[#002045]" : "bg-white text-[#43474e] border-[#c4c6cf] hover:bg-[#f4f3f7]"}`}
                    >{day}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.branch}</label>
                  <select className="input-field" value={shiftForm.branchId} onChange={(e) => setShiftForm(f => ({ ...f, branchId: e.target.value }))}>
                    <option value="">{t.hr.allBranches}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.color}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-10 h-9 rounded-lg border border-[#c4c6cf] cursor-pointer" value={shiftForm.color} onChange={(e) => setShiftForm(f => ({ ...f, color: e.target.value }))} />
                    <span className="text-xs text-[#74777f] font-mono">{shiftForm.color}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
              <button onClick={() => setShiftModal(null)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={saveShift} disabled={shiftSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {shiftSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assignments Modal ── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setAssignModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <div>
                <h2 className="text-lg font-bold text-[#1a1c1e]">{t.hr.assignments}</h2>
                <p className="text-xs text-[#74777f]">{assignModal.name} · {assignModal.startTime}–{assignModal.endTime}</p>
              </div>
              <button onClick={() => setAssignModal(null)} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Add assignment form */}
              <div className="bg-[#f8f7fb] rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">{t.hr.assignEmployee}</p>
                {assignError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-xs px-3 py-2 rounded-lg">{assignError}</div>}
                <select className="input-field text-sm" value={assignForm.employeeId} onChange={(e) => setAssignForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">{t.hr.searchPlaceholder}</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.user.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[#74777f] mb-1 block">{t.hr.startDate}</label>
                    <input type="date" className="input-field text-sm" value={assignForm.startDate} onChange={(e) => setAssignForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#74777f] mb-1 block">{t.hr.endDate}</label>
                    <input type="date" className="input-field text-sm" value={assignForm.endDate} onChange={(e) => setAssignForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <button onClick={saveAssignment} disabled={assignSaving} className="w-full btn-primary py-2 text-sm disabled:opacity-60">
                  {assignSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.hr.assignEmployee}
                </button>
              </div>

              {/* Current assignments list */}
              <div>
                <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{t.hr.assignments} ({assignments.length})</p>
                {assignments.length === 0 ? (
                  <p className="text-sm text-[#74777f] text-center py-4">{t.hr.noShifts}</p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-white border border-[#e3e2e6] rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1a1c1e]">{a.employeeName}</p>
                          <p className="text-xs text-[#74777f]">{a.jobTitle} · from {a.startDate?.slice(0, 10)}</p>
                        </div>
                        <button onClick={() => removeAssignment(a.id)} className="p-1.5 hover:bg-[#ffdad6] rounded-lg transition-colors">
                          <span className="material-symbols-outlined text-[#ba1a1a] text-[16px]">remove_circle</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

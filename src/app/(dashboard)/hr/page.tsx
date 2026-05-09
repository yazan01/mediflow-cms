"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { Employee, LeaveRequest } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { apiFetch } from "@/lib/hooks/useDataFetch";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PayslipModal } from "@/components/PayslipModal";

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
interface Department { id: string; name: string; }

interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  days: Record<string, "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HOLIDAY">;
}

interface PayrollRecord {
  id: string | null;
  employeeId: string;
  employeeName: string;
  department: string;
  basicSalary: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  netSalary: number;
  status: "PROCESSED" | "PENDING";
}

interface HRStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  pendingLeaveRequests: number;
}

interface AnalyticsData {
  headcount: { total: number; active: number; onLeave: number };
  attritionThisYear: number;
  byDepartment: { name: string; count: number }[];
  byType: Record<string, number>;
  leaveStats: { pendingCount: number; approvedThisMonth: number; byType: Record<string, number> };
  payrollSummary: { totalNetSalary: number; totalGrossSalary: number; processedCount: number };
  contractsExpiring: { employeeName: string; contractType: string; endDate: string; daysUntilExpiry: number }[];
  headcountTrend: { month: string; count: number }[];
}

// ─── Status configs ───────────────────────────────────────────────────────────

const ATT_MARKER: Record<string, { sym: string; cls: string }> = {
  PRESENT: { sym: "check_circle", cls: "text-[var(--ok)]" },
  ABSENT:  { sym: "cancel",       cls: "text-[var(--err)]" },
  LATE:    { sym: "schedule",     cls: "text-[var(--warn)]" },
  LEAVE:   { sym: "event_busy",   cls: "text-[var(--blue)]" },
  HOLIDAY: { sym: "celebration",  cls: "text-[var(--txt2)]" },
};

const ATT_STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE", "HOLIDAY"] as const;
type AttStatus = typeof ATT_STATUSES[number];

// ─── Org Chart Tree ───────────────────────────────────────────────────────────

interface OrgNode { id: string; name: string; jobTitle: string; department: string; reportsToId: string | null; status: string; empCode: string; }

function OrgCard({ node }: { node: OrgNode }) {
  const STATUS_CLS: Record<string, string> = {
    ACTIVE: "bg-[var(--ok-bg)] text-[var(--ok)]",
    ON_LEAVE: "bg-[var(--warn-bg)] text-[var(--warn)]",
    INACTIVE: "bg-[var(--surface2)] text-[var(--txt2)]",
  };
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 shadow-[var(--sh-sm)] min-w-[180px] max-w-[220px] text-center">
      <div className="w-9 h-9 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">
        {node.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
      </div>
      <p className="text-sm font-semibold text-[var(--txt1)] truncate">{node.name}</p>
      <p className="text-xs text-[var(--txt2)] truncate">{node.jobTitle}</p>
      <p className="text-[10px] text-[var(--txt2)] mt-0.5 truncate">{node.department}</p>
      <span className={`mt-1.5 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[node.status] ?? "bg-[var(--surface2)] text-[var(--txt2)]"}`}>{node.status}</span>
    </div>
  );
}

function OrgTreeNode({ node, allNodes, depth }: { node: OrgNode; allNodes: OrgNode[]; depth: number }) {
  const children = allNodes.filter(n => n.reportsToId === node.id);
  return (
    <div className="flex flex-col items-center">
      <OrgCard node={node} />
      {children.length > 0 && (
        <>
          <div className="w-px h-5 bg-[#c4c6cf]" />
          <div className="flex gap-6 items-start">
            {children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                {children.length > 1 && (
                  <div className={`h-px bg-[#c4c6cf] mb-0 ${i === 0 ? "w-1/2 self-end" : i === children.length - 1 ? "w-1/2 self-start" : "w-full"}`} />
                )}
                <div className="w-px h-5 bg-[#c4c6cf]" />
                <OrgTreeNode node={child} allNodes={allNodes} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrgTree({ nodes, search, noResultsText }: { nodes: OrgNode[]; search: string; noResultsText: string }) {
  const filtered = search
    ? nodes.filter(n =>
        n.name.toLowerCase().includes(search.toLowerCase()) ||
        n.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
        n.department.toLowerCase().includes(search.toLowerCase())
      )
    : nodes;

  if (search) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(n => <OrgCard key={n.id} node={n} />)}
        {filtered.length === 0 && (
          <div className="col-span-4 text-center py-10 text-sm text-[var(--txt2)]">{noResultsText}</div>
        )}
      </div>
    );
  }

  const roots = nodes.filter(n => !n.reportsToId || !nodes.find(x => x.id === n.reportsToId));
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-12 items-start min-w-max px-4 py-4">
        {roots.map(root => (
          <OrgTreeNode key={root.id} node={root} allNodes={nodes} depth={0} />
        ))}
      </div>
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20">
      <span className="spinner" />
      <p className="text-sm text-[var(--txt2)]">{label}</p>
    </div>
  );
}

function EmptyRow({ cols, icon, label, sub }: { cols: number; icon: string; label: string; sub?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-20 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">{icon}</span>
          </div>
          <p className="text-sm font-semibold text-[var(--txt1)]">{label}</p>
          {sub && <p className="text-xs text-[var(--txt2)]">{sub}</p>}
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
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-5 flex items-center gap-4">
      <div className={`p-3 ${iconBg} rounded-2xl flex-shrink-0`}>
        <span className={`material-symbols-outlined ${iconColor} text-[22px]`}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-[var(--txt1)]">{value}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HRPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const highlightedEmployeeRef = useRef<HTMLTableRowElement | null>(null);

  const EMP_STATUS: Record<string, { label: string; cls: string }> = {
    ACTIVE:      { label: t.hr.activeStatus,   cls: "bg-[var(--ok-bg)] text-[var(--ok)]" },
    ON_LEAVE:    { label: t.hr.onLeaveStatus,  cls: "bg-[var(--warn-bg)] text-[var(--warn)]" },
    INACTIVE:    { label: t.hr.inactiveStatus, cls: "bg-[#e3e2e6] text-[var(--txt2)]" },
    TERMINATED:  { label: t.hr.terminated,     cls: "bg-[var(--err-bg)] text-[var(--err)]" },
  };

  const EMP_TYPE: Record<string, { label: string; cls: string }> = {
    FULL_TIME: { label: t.hr.fullTime, cls: "bg-[#d3e4ff] text-[var(--blue)]" },
    PART_TIME: { label: t.hr.partTime, cls: "bg-[#e9e7eb] text-[var(--txt2)]" },
    CONTRACT:  { label: t.hr.contract, cls: "bg-[#ffddba] text-[#633f0f]" },
  };

  const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: t.common.pending,   cls: "bg-[var(--warn-bg)] text-[var(--warn)]" },
    APPROVED: { label: t.common.approved,  cls: "bg-[var(--ok-bg)] text-[var(--ok)]" },
    REJECTED: { label: t.common.rejected,  cls: "bg-[var(--err-bg)] text-[var(--err)]" },
    CANCELLED:{ label: t.common.cancel,    cls: "bg-[#e3e2e6] text-[var(--txt2)]" },
  };

  const ATT_LABEL: Record<string, string> = {
    PRESENT: t.hr.presentFull,
    ABSENT:  t.hr.absentFull,
    LATE:    t.hr.lateFull,
    LEAVE:   t.hr.leaveFull,
    HOLIDAY: t.hr.holidayFull,
  };

  const LEAVE_TYPE_LABEL: Record<string, string> = {
    ANNUAL:       t.hr.leaveTypeAnnual,
    ANNUAL_LEAVE: t.hr.leaveTypeAnnual,
    SICK:         t.hr.leaveTypeSick,
    SICK_LEAVE:   t.hr.leaveTypeSick,
    EMERGENCY:    t.hr.leaveTypeEmergency,
    UNPAID:       t.hr.leaveTypeUnpaid,
    MATERNITY:    t.hr.leaveTypeMaternity,
    PATERNITY:    t.hr.leaveTypePaternity,
  };

  function leaveTypeLabel(type: string): string {
    return LEAVE_TYPE_LABEL[type?.toUpperCase()] ?? type?.replace(/_/g, " ");
  }

  type Tab = "employees" | "attendance" | "leaveRequests" | "payroll" | "shifts" | "analytics" | "leavePolicies" | "orgChart";
  const TABS: { key: Tab; label: string }[] = [
    { key: "employees",     label: t.hr.employees },
    { key: "attendance",    label: t.hr.attendance },
    { key: "leaveRequests", label: t.hr.leaveRequests },
    { key: "payroll",       label: t.hr.payroll },
    { key: "shifts",        label: t.hr.shifts },
    { key: "analytics",     label: t.hr.analytics },
    { key: "leavePolicies", label: t.hr.leavePolicies },
    { key: "orgChart",      label: t.hr.orgChart },
  ];

  const [activeTab, setActiveTab] = useState<Tab>("employees");
  const [empFetchError, setEmpFetchError] = useState<Error | null>(null);

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("ALL");
  const [empStatusFilter, setEmpStatusFilter] = useState("ALL");
  const [empBranchFilter, setEmpBranchFilter] = useState("ALL");
  const [empPage, setEmpPage] = useState(1);
  const [empTotal, setEmpTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());

  // Attendance
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attSearch, setAttSearch] = useState("");
  const [attMonth, setAttMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  // Attendance marking modal
  const [attMarkModal, setAttMarkModal] = useState<{ employeeId: string; employeeName: string; date: string } | null>(null);
  const [attMarkStatus, setAttMarkStatus] = useState<AttStatus>("PRESENT");
  const [attMarkCheckIn, setAttMarkCheckIn] = useState("");
  const [attMarkCheckOut, setAttMarkCheckOut] = useState("");
  const [attMarkOvertimeHrs, setAttMarkOvertimeHrs] = useState("");
  const [attMarkSaving, setAttMarkSaving] = useState(false);
  const [attMarkError, setAttMarkError] = useState("");

  // Leave Requests
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL");
  // Leave creation modal
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employeeId: "", type: "ANNUAL", startDate: "", endDate: "", days: "", reason: "", medicalCert: false });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveSuccess, setLeaveSuccess] = useState("");

  // Payroll
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payrollBranchFilter, setPayrollBranchFilter] = useState("ALL");
  const [payslipPayrollId, setPayslipPayrollId] = useState<string | null>(null);
  const [processAllLoading, setProcessAllLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<HRStats | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsBranchFilter, setAnalyticsBranchFilter] = useState("ALL");

  // Leave Policies
  interface LeavePolicy { id: string; leaveType: string; maxDaysPerYear: number; carryForwardMax: number; requiresMedicalCert: boolean; probationAllowed: boolean; minServiceDays: number; encashmentAllowed: boolean; }
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyEditing, setPolicyEditing] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState<Partial<LeavePolicy>>({});
  const [policySaving, setPolicySaving] = useState(false);

  // Org Chart
  interface OrgNode { id: string; name: string; jobTitle: string; department: string; reportsToId: string | null; status: string; empCode: string; }
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");

  // Reject leave modal
  const [rejectModal, setRejectModal] = useState<{ leaveId: string; employeeName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Shifts
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shiftModal, setShiftModal] = useState<"add" | "edit" | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState({ name: "", startTime: "08:00", endTime: "17:00", daysOfWeek: [0, 1, 2, 3, 4] as number[], branchId: "", color: "var(--blue)" });
  const [shiftSaving, setShiftSaving] = useState(false);
  const [shiftError, setShiftError] = useState("");
  const [assignModal, setAssignModal] = useState<Shift | null>(null);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [assignForm, setAssignForm] = useState({ employeeId: "", startDate: "", endDate: "", notes: "" });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [confirmDeleteShiftId, setConfirmDeleteShiftId] = useState<string | null>(null);

  const PAGE_SIZE = 10;

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    setEmpFetchError(null);
    try {
      const p = new URLSearchParams({
        page: String(empPage),
        pageSize: String(PAGE_SIZE),
        ...(empSearch && { search: empSearch }),
        ...(empDeptFilter !== "ALL" && { department: empDeptFilter }),
        ...(empStatusFilter !== "ALL" && { status: empStatusFilter }),
        ...(empBranchFilter !== "ALL" && { branch_id: empBranchFilter }),
      });
      const res = await fetch(`/api/hr/employees?${p}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      setEmployees(data.data ?? []);
      setEmpTotal(data.total ?? 0);
    } catch (err) {
      setEmpFetchError(err as Error);
    } finally {
      setEmpLoading(false);
    }
  }, [empPage, empSearch, empDeptFilter, empStatusFilter, empBranchFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/hr/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data ?? []);
      }
    } catch { /* ignore */ }
  }, []);

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
      const p = new URLSearchParams({
        month: payrollMonth,
        ...(payrollBranchFilter !== "ALL" && { branch_id: payrollBranchFilter }),
      });
      const res = await fetch(`/api/hr/payroll?${p}`);
      if (res.ok) {
        const data = await res.json();
        setPayroll(data.data ?? []);
      }
    } catch { /* ignore */ } finally {
      setPayrollLoading(false);
    }
  }, [payrollMonth, payrollBranchFilter]);

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

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const p = analyticsBranchFilter !== "ALL" ? `?branch_id=${analyticsBranchFilter}` : "";
      const res = await fetch(`/api/hr/reports/analytics${p}`);
      if (res.ok) setAnalytics(await res.json());
    } catch { /* ignore */ } finally { setAnalyticsLoading(false); }
  }, [analyticsBranchFilter]);

  const fetchLeavePolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const res = await fetch("/api/hr/leave-policies");
      if (res.ok) setLeavePolicies(await res.json());
    } catch { /* ignore */ } finally { setPoliciesLoading(false); }
  }, []);

  const fetchOrgChart = useCallback(async () => {
    setOrgLoading(true);
    try {
      const res = await fetch("/api/hr/org-chart");
      if (res.ok) setOrgNodes(await res.json());
    } catch { /* ignore */ } finally { setOrgLoading(false); }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  // Deep-link: /hr?employee=<id> — switch to employees tab and highlight the row
  const deepLinkEmployeeId = searchParams.get("employee");
  useEffect(() => {
    if (!deepLinkEmployeeId) return;
    setActiveTab("employees");
  }, [deepLinkEmployeeId]);

  useEffect(() => {
    if (!deepLinkEmployeeId || empLoading) return;
    const timer = setTimeout(() => {
      highlightedEmployeeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(timer);
  }, [deepLinkEmployeeId, empLoading]);
  useEffect(() => { if (activeTab === "attendance") fetchAttendance(); }, [activeTab, fetchAttendance]);
  useEffect(() => { if (activeTab === "leaveRequests") fetchLeaves(); }, [activeTab, fetchLeaves]);
  useEffect(() => { if (activeTab === "payroll") fetchPayroll(); }, [activeTab, fetchPayroll]);
  useEffect(() => { if (activeTab === "shifts") fetchShifts(); }, [activeTab, fetchShifts]);
  useEffect(() => { if (activeTab === "analytics") fetchAnalytics(); }, [activeTab, fetchAnalytics]);
  useEffect(() => { if (activeTab === "leavePolicies") fetchLeavePolicies(); }, [activeTab, fetchLeavePolicies]);
  useEffect(() => { if (activeTab === "orgChart") fetchOrgChart(); }, [activeTab, fetchOrgChart]);

  async function handleSavePolicy(policyId: string) {
    setPolicySaving(true);
    try {
      const res = await fetch(`/api/hr/leave-policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeavePolicies(ps => ps.map(p => p.id === policyId ? { ...p, ...updated } : p));
        setPolicyEditing(null);
      }
    } catch { /* ignore */ } finally { setPolicySaving(false); }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleLeaveAction(id: string, action: "APPROVED" | "REJECTED", rejectionReason?: string) {
    try {
      const res = await fetch(`/api/hr/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, ...(rejectionReason && { rejectionReason }) }),
      });
      if (res.ok) {
        fetchLeaves();
        fetchStats();
      }
    } catch { /* ignore */ }
  }

  async function handleRejectWithReason() {
    if (!rejectModal) return;
    await handleLeaveAction(rejectModal.leaveId, "REJECTED", rejectReason || undefined);
    setRejectModal(null);
    setRejectReason("");
  }

  async function handleCreateLeave() {
    setLeaveError("");
    if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.days) {
      setLeaveError(t.hr.assignRequired);
      return;
    }
    setLeaveSaving(true);
    try {
      const res = await fetch("/api/hr/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: leaveForm.employeeId,
          type: leaveForm.type,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          days: Number(leaveForm.days),
          reason: leaveForm.reason || null,
          ...(leaveForm.type === "SICK" && { medicalCert: leaveForm.medicalCert }),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setLeaveError(e.detail || t.hr.leaveCreateFailed);
        return;
      }
      setLeaveModal(false);
      setLeaveForm({ employeeId: "", type: "ANNUAL", startDate: "", endDate: "", days: "", reason: "", medicalCert: false });
      setLeaveSuccess(t.hr.leaveCreated);
      setTimeout(() => setLeaveSuccess(""), 3000);
      fetchLeaves();
      fetchStats();
    } catch { setLeaveError(t.hr.networkError); } finally { setLeaveSaving(false); }
  }

  async function handleMarkAttendance() {
    if (!attMarkModal) return;
    setAttMarkSaving(true);
    setAttMarkError("");
    try {
      const res = await fetch("/api/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: attMarkModal.employeeId,
          date: attMarkModal.date,
          status: attMarkStatus,
          ...(attMarkCheckIn && { checkIn: attMarkCheckIn }),
          ...(attMarkCheckOut && { checkOut: attMarkCheckOut }),
          ...(attMarkOvertimeHrs && { overtimeHrs: Number(attMarkOvertimeHrs) }),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setAttMarkError(e.detail || t.hr.attSaveFailed);
        return;
      }
      setAttMarkModal(null);
      fetchAttendance();
    } catch { setAttMarkError(t.hr.networkError); } finally { setAttMarkSaving(false); }
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

  async function handleProcessAllPayroll() {
    const pending = payroll.filter((p) => p.status === "PENDING");
    if (pending.length === 0) return;
    if (!confirm(t.hr.processAllConfirm)) return;
    setProcessAllLoading(true);
    try {
      const res = await fetch("/api/hr/payroll/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: payrollMonth }),
      });
      if (res.ok) fetchPayroll();
    } catch { /* ignore */ } finally { setProcessAllLoading(false); }
  }

  async function handleExportCsv() {
    const params = new URLSearchParams({ page: "1", pageSize: "5000" });
    if (empSearch) params.set("search", empSearch);
    if (empDeptFilter !== "ALL") params.set("department", empDeptFilter);
    if (empStatusFilter !== "ALL") params.set("status", empStatusFilter);
    const res = await fetch(`/api/hr/employees?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    const all: Record<string, unknown>[] = data.data ?? [];
    if (all.length === 0) return;
    const headers = [t.common.name, t.common.email, t.hr.empCode, t.hr.department, t.hr.jobTitle, t.hr.type, t.hr.status, t.hr.basicSalaryLabel, t.hr.hireDate, t.hr.annualLeave];
    const rows = all.map((e) => {
      const u = e.user as Record<string, unknown>;
      const d = e.department as Record<string, unknown>;
      return [u?.name, u?.email, e.empCode, d?.name, e.jobTitle, e.employmentType, e.status, e.basicSalary, String(e.hireDate ?? "").slice(0, 10), e.annualLeaveBalance];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportSelectedCsv() {
    const selected = employees.filter(e => selectedEmpIds.has(e.id as string));
    if (selected.length === 0) return;
    const headers = [t.common.name, t.common.email, t.hr.empCode, t.hr.department, t.hr.jobTitle, t.hr.type, t.hr.status, t.hr.basicSalaryLabel, t.hr.hireDate, t.hr.annualLeave];
    const rows = selected.map((e) => [
      e.user.name, e.user.email, e.empCode, e.department.name, e.jobTitle,
      e.employmentType, e.status, e.basicSalary, e.hireDate?.slice(0, 10) ?? "", e.annualLeaveBalance,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-selected-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openAddShift() {
    setShiftForm({ name: "", startTime: "08:00", endTime: "17:00", daysOfWeek: [0, 1, 2, 3, 4], branchId: "", color: "var(--blue)" });
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
    if (!shiftForm.name.trim()) { setShiftError(t.hr.shiftRequired); return; }
    setShiftSaving(true);
    setShiftError("");
    try {
      const url = shiftModal === "edit" && editingShift ? `/api/shifts/${editingShift.id}` : "/api/shifts";
      const method = shiftModal === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...shiftForm, branchId: shiftForm.branchId || null }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setShiftError(e.detail || t.hr.shiftSaveFailed); return; }
      setShiftModal(null);
      fetchShifts();
    } catch { setShiftError(t.hr.networkError); } finally { setShiftSaving(false); }
  }

  async function confirmDeleteShift() {
    if (!confirmDeleteShiftId) return;
    await apiFetch(`/api/shifts/${confirmDeleteShiftId}`, { method: "DELETE" });
    setConfirmDeleteShiftId(null);
    fetchShifts();
  }

  function openAssignModal(s: Shift) {
    setAssignModal(s);
    setAssignForm({ employeeId: "", startDate: "", endDate: "", notes: "" });
    setAssignError("");
    fetchAssignments(s.id);
  }

  async function saveAssignment() {
    if (!assignModal || !assignForm.employeeId || !assignForm.startDate) { setAssignError(t.hr.assignRequired); return; }
    setAssignSaving(true);
    setAssignError("");
    try {
      const res = await fetch("/api/shifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: assignForm.employeeId, shiftId: assignModal.id, startDate: assignForm.startDate, endDate: assignForm.endDate || null, notes: assignForm.notes }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setAssignError(e.detail || t.hr.assignFailed); return; }
      setAssignForm({ employeeId: "", startDate: "", endDate: "", notes: "" });
      fetchAssignments(assignModal.id);
      fetchShifts();
    } catch { setAssignError(t.hr.networkError); } finally { setAssignSaving(false); }
  }

  async function removeAssignment(id: string) {
    await apiFetch(`/api/shifts/assignments/${id}`, { method: "DELETE" });
    if (assignModal) fetchAssignments(assignModal.id);
    fetchShifts();
  }

  // ── Attendance calendar days ───────────────────────────────────────────────

  const attDaysInMonth = (() => {
    const [yr, mo] = attMonth.split("-").map(Number);
    const count = new Date(yr, mo, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  })();

  const empTotalPages = Math.ceil(empTotal / PAGE_SIZE);
  const pendingPayrollCount = payroll.filter((p) => p.status === "PENDING").length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--txt1)]">{t.hr.title}</h1>
          <p className="text-sm text-[var(--txt2)] mt-0.5">{t.hr.subtitle}</p>
        </div>
        <Link
          href="/hr/new"
          className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t.hr.addEmployee}
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="groups" iconBg="bg-[#d3e4ff]" iconColor="text-[var(--blue)]" label={t.hr.totalEmployees} value={stats?.totalEmployees ?? "—"} />
        <StatCard icon="check_circle" iconBg="bg-[var(--ok-bg)]" iconColor="text-[var(--ok)]" label={t.hr.active} value={stats?.activeEmployees ?? "—"} />
        <StatCard icon="event_busy" iconBg="bg-[var(--warn-bg)]" iconColor="text-[var(--warn)]" label={t.hr.onLeave} value={stats?.onLeave ?? "—"} />
        <StatCard icon="pending_actions" iconBg="bg-[#ffddba]" iconColor="text-[#633f0f]" label={t.hr.pendingLeave} value={stats?.pendingLeaveRequests ?? "—"} />
      </div>

      {/* Global success toast */}
      {leaveSuccess && (
        <div className="flex items-center gap-3 bg-[var(--ok-bg)] text-[var(--ok)] px-4 py-3 rounded-xl text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {leaveSuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--txt2)] hover:text-[var(--txt1)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Employees ── */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {empFetchError && <ErrorBanner error={empFetchError} onRetry={fetchEmployees} />}
          {/* Filters */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--txt2)] text-[18px]">search</span>
                <input
                  className="w-full bg-[var(--surface2)] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[var(--txt1)] placeholder:text-[var(--txt2)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                  placeholder={t.hr.searchPlaceholder}
                  value={empSearch}
                  onChange={(e) => { setEmpSearch(e.target.value); setEmpPage(1); }}
                />
              </div>
              <select
                className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
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
                className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                value={empDeptFilter}
                onChange={(e) => { setEmpDeptFilter(e.target.value); setEmpPage(1); }}
              >
                <option value="ALL">{t.hr.allDepts}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {branches.length > 0 && (
                <select
                  className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                  value={empBranchFilter}
                  onChange={(e) => { setEmpBranchFilter(e.target.value); setEmpPage(1); }}
                >
                  <option value="ALL">{t.hr.allBranches ?? "All Branches"}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] px-4 py-2.5 rounded-lg text-sm text-[var(--txt1)] hover:bg-[var(--surface2)] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                {t.hr.exportCsv}
              </button>
              {selectedEmpIds.size > 0 && (
                <button
                  onClick={handleExportSelectedCsv}
                  className="flex items-center gap-2 bg-[var(--blue)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  {t.hr.exportSelected} ({selectedEmpIds.size} {t.hr.nSelected})
                </button>
              )}
            </div>
          </div>

          {/* Employees table */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--surface2)] border-b border-[var(--border)]">
                    <th className="px-5 py-3.5 w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-[var(--blue)]"
                        checked={employees.length > 0 && employees.every(e => selectedEmpIds.has(e.id as string))}
                        onChange={(ev) => {
                          if (ev.target.checked) setSelectedEmpIds(new Set(employees.map(e => e.id as string)));
                          else setSelectedEmpIds(new Set());
                        }}
                        aria-label={t.hr.selectAll}
                      />
                    </th>
                    {[t.hr.employee, t.hr.code, t.hr.deptTitle, t.hr.type, t.hr.status, t.hr.salary, t.hr.hireDate, t.hr.leaveBal, t.common.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
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
                    const isSelected = selectedEmpIds.has(emp.id as string);
                    const isHighlighted = emp.id === deepLinkEmployeeId;
                    return (
                      <tr
                        key={emp.id}
                        ref={isHighlighted ? highlightedEmployeeRef : null}
                        className={`hover:bg-[var(--surface2)] transition-colors group ${isSelected ? "bg-[#eef4ff]" : ""} ${isHighlighted ? "ring-2 ring-inset ring-[var(--blue)] bg-[#d3e4ff]/30" : ""}`}
                      >
                        <td className="px-5 py-4 border-b border-[var(--border)] w-10">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded accent-[var(--blue)]"
                            checked={isSelected}
                            onChange={() => setSelectedEmpIds(prev => {
                              const next = new Set(prev);
                              if (next.has(emp.id as string)) next.delete(emp.id as string);
                              else next.add(emp.id as string);
                              return next;
                            })}
                            aria-label={`Select ${emp.user.name}`}
                          />
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <div className="flex items-center gap-3">
                            {/* Avatar: real photo or colored initials */}
                            {emp.user.photo ? (
                              <img src={emp.user.photo} alt={emp.user.name}
                                className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-[#e3e2e6]" />
                            ) : (
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                emp.user.isActive ? "bg-[var(--brand)] text-white" : "bg-[#94a3b8] text-white"
                              }`}>
                                {getInitials(emp.user.name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-semibold text-[var(--txt1)] group-hover:text-[var(--blue)] transition-colors whitespace-nowrap">{emp.user.name}</p>
                                {!emp.user.isActive && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#fee2e2] text-[#991b1b] whitespace-nowrap">INACTIVE</span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--txt2)] truncate">{emp.user.email}</p>
                              {/* Role badges */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(emp.user.roles as string[] ?? []).map((role: string) => (
                                  <span key={role} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] whitespace-nowrap">
                                    {role.replace("_", " ")}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <span className="text-xs font-mono font-semibold text-[var(--txt2)] bg-[var(--surface2)] px-2 py-1 rounded">{emp.empCode}</span>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <p className="text-sm text-[var(--txt1)]">{emp.department.name}</p>
                          <p className="text-xs text-[var(--txt2)]">{emp.jobTitle}</p>
                          {emp.branchName && (
                            <p className="text-[10px] text-[var(--blue)] mt-0.5 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">location_on</span>
                              {emp.branchName}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${typeCfg.cls}`}>{typeCfg.label}</span>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusCfg.cls}`}>{statusCfg.label}</span>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)] text-sm text-[var(--txt1)]">
                          {formatCurrency(emp.basicSalary)}
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)] text-sm text-[var(--txt2)] whitespace-nowrap">
                          {formatDate(emp.hireDate)}
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)] text-sm text-[var(--txt2)]">
                          {emp.annualLeaveBalance != null ? `${emp.annualLeaveBalance} ${t.hr.daysUnit}` : "—"}
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <div className="flex items-center gap-1">
                            <Link href={`/hr/${emp.id}`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--blue)]" aria-label={t.common.view}>
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </Link>
                            <Link href={`/hr/${emp.id}/edit`} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--blue)]" aria-label={t.common.edit}>
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </Link>
                            {/* Link to user account */}
                            <Link
                              href={`/users?search=${encodeURIComponent(emp.user.email)}`}
                              className="p-1.5 hover:bg-[#ede9fe] rounded-lg transition-colors text-[var(--txt2)] hover:text-[#7c3aed]"
                              aria-label="View system account"
                              title="View system account"
                            >
                              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                            </Link>
                          </div>
                          {/* Last login */}
                          {(emp.user as { lastLogin?: string | null }).lastLogin ? (
                            <p className="text-[10px] text-[#94a3b8] mt-1 whitespace-nowrap">
                              <span className="material-symbols-outlined text-[11px] align-middle">login</span>
                              {" "}{new Date((emp.user as { lastLogin?: string | null }).lastLogin!).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}
                            </p>
                          ) : (
                            <p className="text-[10px] text-[#c4c6cf] mt-1">Never logged in</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {empTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
                <p className="text-xs text-[var(--txt2)]">
                  {t.hr.showing} {((empPage - 1) * PAGE_SIZE) + 1}–{Math.min(empPage * PAGE_SIZE, empTotal)} of {empTotal} {t.hr.employeesLabel}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEmpPage((p) => Math.max(1, p - 1))} disabled={empPage === 1} aria-label="Previous page" className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  {(() => {
                    const delta = 2;
                    const start = Math.max(1, Math.min(empPage - delta, empTotalPages - delta * 2));
                    const end = Math.min(empTotalPages, start + delta * 2);
                    return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                      <button key={p} onClick={() => setEmpPage(p)} className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${empPage === p ? "bg-[var(--brand)] text-white" : "hover:bg-[var(--surface2)] text-[var(--txt2)]"}`}>{p}</button>
                    ));
                  })()}
                  <button onClick={() => setEmpPage((p) => Math.min(empTotalPages, p + 1))} disabled={empPage === empTotalPages} aria-label="Next page" className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--txt2)] text-[18px]">search</span>
              <input
                className="w-full bg-[var(--surface2)] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm text-[var(--txt1)] placeholder:text-[var(--txt2)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                placeholder={t.hr.searchPlaceholder}
                value={attSearch}
                onChange={(e) => setAttSearch(e.target.value)}
              />
            </div>
            <input
              type="month"
              className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              value={attMonth}
              onChange={(e) => setAttMonth(e.target.value)}
            />
            <div className="flex items-center gap-4 text-xs text-[var(--txt2)] flex-wrap">
              {Object.entries(ATT_MARKER).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`material-symbols-outlined text-[14px] ${v.cls}`}>{v.sym}</span>
                  {ATT_LABEL[k] ?? k}
                </span>
              ))}
            </div>
            <p className="text-xs text-[var(--txt2)] self-center">{t.hr.markAttendance}</p>
          </div>

          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--surface2)] border-b border-[var(--border)]">
                    <th className="sticky start-0 bg-[var(--surface2)] text-left font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3 whitespace-nowrap z-10">{t.hr.employee}</th>
                    {attDaysInMonth.map((d) => (
                      <th key={d} className="text-center font-semibold text-[var(--txt2)] px-2 py-3 w-8">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attLoading ? (
                    <tr><td colSpan={attDaysInMonth.length + 1}><Spinner label={t.hr.loading} /></td></tr>
                  ) : attendance.length === 0 ? (
                    <tr><td colSpan={attDaysInMonth.length + 1} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">calendar_month</span>
                        <p className="text-sm font-semibold text-[var(--txt1)]">{t.hr.noAttendance}</p>
                      </div>
                    </td></tr>
                  ) : attendance.map((rec) => (
                    <tr key={rec.employeeId} className="hover:bg-[var(--surface2)] transition-colors border-b border-[var(--border)]">
                      <td className="sticky start-0 bg-[var(--surface)] hover:bg-[var(--surface2)] px-5 py-3 font-semibold text-[var(--txt1)] whitespace-nowrap z-10">{rec.employeeName}</td>
                      {attDaysInMonth.map((d) => {
                        const key = `${attMonth}-${String(d).padStart(2, "0")}`;
                        const marker = rec.days[key];
                        const cfg = marker ? ATT_MARKER[marker] : null;
                        return (
                          <td
                            key={d}
                            className="text-center px-1 py-3 cursor-pointer hover:bg-[#d3e4ff]/40 rounded transition-colors"
                            title={t.hr.markAttendance}
                            onClick={() => {
                              setAttMarkModal({ employeeId: rec.employeeId, employeeName: rec.employeeName, date: key });
                              setAttMarkStatus(marker ?? "PRESENT");
                              setAttMarkCheckIn("");
                              setAttMarkCheckOut("");
                              setAttMarkOvertimeHrs("");
                              setAttMarkError("");
                            }}
                          >
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
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-4 flex gap-3 flex-wrap items-center">
            <select
              className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              value={leaveStatusFilter}
              onChange={(e) => setLeaveStatusFilter(e.target.value)}
            >
              <option value="ALL">{t.hr.allRequests}</option>
              <option value="PENDING">{t.common.pending}</option>
              <option value="APPROVED">{t.common.approved}</option>
              <option value="REJECTED">{t.common.rejected}</option>
            </select>
            <div className="flex-1" />
            <button
              onClick={() => { setLeaveModal(true); setLeaveError(""); setLeaveForm({ employeeId: "", type: "ANNUAL", startDate: "", endDate: "", days: "", reason: "", medicalCert: false }); }}
              className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t.hr.newLeaveRequest}
            </button>
          </div>

          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--surface2)] border-b border-[var(--border)]">
                    {[t.hr.employee, t.hr.leaveType, t.hr.startDate, t.hr.endDate, t.hr.days, t.common.status, t.hr.approver, t.common.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
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
                      <tr key={lr.id} className="hover:bg-[var(--surface2)] transition-colors border-b border-[var(--border)]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {getInitials(lr.employeeName ?? lr.employee?.user?.name ?? "?")}
                            </div>
                            <p className="text-sm font-semibold text-[var(--txt1)] whitespace-nowrap">{lr.employeeName ?? lr.employee?.user?.name ?? "—"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-[var(--txt2)]">{leaveTypeLabel(lr.type)}</p>
                          {lr.type?.toUpperCase().includes("ANNUAL") && lr.annualLeaveBalance != null && (
                            <p className="text-xs text-[var(--txt2)] mt-0.5">{t.hr.leaveBal}: {lr.annualLeaveBalance} {t.hr.daysUnit}</p>
                          )}
                          {lr.type?.toUpperCase().includes("SICK") && lr.sickLeaveBalance != null && (
                            <p className="text-xs text-[var(--txt2)] mt-0.5">{t.hr.leaveBal}: {lr.sickLeaveBalance} {t.hr.daysUnit}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--txt2)] whitespace-nowrap">{formatDate(lr.startDate)}</td>
                        <td className="px-5 py-4 text-sm text-[var(--txt2)] whitespace-nowrap">{formatDate(lr.endDate)}</td>
                        <td className="px-5 py-4 text-sm text-[var(--txt2)]">{lr.days}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--txt2)]">{lr.approverName || "—"}</td>
                        <td className="px-5 py-4">
                          {lr.status === "PENDING" ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleLeaveAction(lr.id, "APPROVED")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[var(--ok-bg)] text-[var(--ok)] text-xs font-semibold rounded-lg hover:bg-[var(--ok)] hover:text-white transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">check</span>
                                {t.hr.approve}
                              </button>
                              <button
                                onClick={() => { setRejectReason(""); setRejectModal({ leaveId: lr.id, employeeName: lr.employeeName ?? lr.employee?.user?.name ?? "" }); }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[var(--err-bg)] text-[var(--err)] text-xs font-semibold rounded-lg hover:bg-[var(--err)] hover:text-white transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                                {t.hr.reject}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--txt2)]">—</span>
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
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-4 flex flex-wrap items-center gap-4">
            <label className="text-sm font-semibold text-[var(--txt2)]">{t.hr.payrollMonth}</label>
            <input
              type="month"
              className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              value={payrollMonth}
              min="2020-01"
              max={new Date().toISOString().slice(0, 7)}
              onChange={(e) => setPayrollMonth(e.target.value)}
            />
            {branches.length > 0 && (
              <select
                className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                value={payrollBranchFilter}
                onChange={(e) => setPayrollBranchFilter(e.target.value)}
              >
                <option value="ALL">{t.hr.allBranches ?? "All Branches"}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <div className="flex-1" />
            {pendingPayrollCount > 0 && (
              <button
                onClick={handleProcessAllPayroll}
                disabled={processAllLoading}
                className="flex items-center gap-2 bg-[var(--ok)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm disabled:opacity-60"
              >
                {processAllLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                )}
                {t.hr.processAll} ({pendingPayrollCount})
              </button>
            )}
            <button className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] px-4 py-2 rounded-lg text-sm text-[var(--txt1)] hover:bg-[var(--surface2)] transition-colors">
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t.hr.exportPayroll}
            </button>
          </div>

          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--surface2)] border-b border-[var(--border)]">
                    {[t.hr.employee, t.hr.department, t.hr.baseSalary, t.hr.allowances, t.hr.deductions, t.hr.netPay, t.common.status, t.hr.process].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrollLoading ? (
                    <tr><td colSpan={8}><Spinner label={t.hr.loading} /></td></tr>
                  ) : payroll.length === 0 ? (
                    <EmptyRow cols={8} icon="payments" label={t.hr.noPayroll} sub={t.hr.noPayrollDesc} />
                  ) : payroll.map((pr) => (
                    <tr key={pr.employeeId} className="hover:bg-[var(--surface2)] transition-colors border-b border-[var(--border)]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {getInitials(pr.employeeName)}
                          </div>
                          <p className="text-sm font-semibold text-[var(--txt1)] whitespace-nowrap">{pr.employeeName}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--txt2)]">{pr.department}</td>
                      <td className="px-5 py-4 text-sm text-[var(--txt2)]">{formatCurrency(pr.basicSalary ?? pr.baseSalary)}</td>
                      <td className="px-5 py-4 text-sm text-[var(--ok)]">+{formatCurrency(pr.allowances)}</td>
                      <td className="px-5 py-4 text-sm text-[var(--err)]">-{formatCurrency(pr.deductions)}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-[var(--txt1)]">{formatCurrency(pr.netSalary ?? pr.netPay)}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pr.status === "PROCESSED" ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--warn-bg)] text-[var(--warn)]"}`}>
                          {pr.status === "PROCESSED" ? t.hr.processed : t.hr.pendingStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {pr.status === "PENDING" ? (
                            <button
                              onClick={() => handleProcessPayroll(pr.employeeId)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--brand)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                            >
                              <span className="material-symbols-outlined text-[14px]">payments</span>
                              {t.hr.process}
                            </button>
                          ) : pr.status === "PROCESSED" && pr.id ? (
                            <>
                              <button
                                onClick={() => setPayslipPayrollId(pr.id)}
                                className="flex items-center gap-1 px-3 py-1.5 border border-[var(--border2)] text-[var(--txt2)] text-xs font-semibold rounded-lg hover:bg-[var(--surface2)] transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                {t.hr.payslip}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(t.hr.reverseConfirm)) return;
                                  try { await apiFetch(`/api/hr/payroll/${pr.id}/reverse`, { method: "PATCH" }); fetchPayroll(); } catch { /* ignore */ }
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 border border-[#ffdad6] text-[var(--err)] text-xs font-semibold rounded-lg hover:bg-[var(--err-bg)]/30 transition-colors"
                                title={t.hr.reversePayroll}
                              >
                                <span className="material-symbols-outlined text-[14px]">undo</span>
                                {t.hr.reverse}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {payroll.length > 0 && !payrollLoading && (
                  <tfoot>
                    <tr className="bg-[var(--surface2)] border-t-2 border-[var(--border)]">
                      <td className="px-5 py-3.5 text-sm font-bold text-[var(--txt1)]" colSpan={2}>{t.hr.payrollTotals}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[var(--txt2)]">{formatCurrency(payroll.reduce((s, p) => s + (p.basicSalary ?? p.baseSalary), 0))}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[var(--ok)]">+{formatCurrency(payroll.reduce((s, p) => s + p.allowances, 0))}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[var(--err)]">-{formatCurrency(payroll.reduce((s, p) => s + p.deductions, 0))}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-[var(--txt1)]">{formatCurrency(payroll.reduce((s, p) => s + (p.netSalary ?? p.netPay), 0))}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Shifts ── */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-4 flex flex-wrap items-center gap-3">
            <select
              className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="">{t.hr.allBranches}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div className="flex-1" />
            <button
              onClick={openAddShift}
              className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t.hr.addShift}
            </button>
          </div>

          {/* Shifts grid */}
          {shiftsLoading ? (
            <Spinner label={t.hr.loading} />
          ) : shifts.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-16 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">schedule</span>
              <p className="text-sm font-semibold text-[var(--txt2)]">{t.hr.noShifts}</p>
              <p className="text-xs text-[var(--txt2)]">{t.hr.noShiftsDesc}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {shifts.map((s) => (
                <div key={s.id} className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <div>
                        <p className="text-sm font-semibold text-[var(--txt1)]">{s.name}</p>
                        {s.branchName && <p className="text-xs text-[var(--txt2)]">{s.branchName}</p>}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.isActive ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[#e3e2e6] text-[var(--txt2)]"}`}>
                      {s.isActive ? t.hr.shiftActive : t.hr.shiftInactive}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-sm text-[var(--txt2)]">
                    <span className="material-symbols-outlined text-[var(--txt2)] text-[16px]">schedule</span>
                    {s.startTime} – {s.endTime}
                    <span className="text-xs text-[var(--txt2)] bg-[var(--surface2)] px-2 py-0.5 rounded-full ms-1">
                      {calcDuration(s.startTime, s.endTime)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {t.hr.daysShort.map((day, i) => (
                      <span key={day} className={`text-xs px-2 py-0.5 rounded font-medium ${s.daysOfWeek.includes(i) ? "bg-[#d3e4ff] text-[var(--blue)]" : "bg-[var(--surface2)] text-[#c4c6cf]"}`}>{day}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <button
                      onClick={() => openAssignModal(s)}
                      className="flex items-center gap-1 text-xs font-semibold text-[var(--blue)] hover:underline"
                    >
                      <span className="material-symbols-outlined text-[14px]">groups</span>
                      {s.assignmentCount} {t.hr.assignments}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditShift(s)} aria-label="Edit" className="p-1.5 hover:bg-[var(--surface2)] rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[var(--txt2)] text-[16px]">edit</span>
                      </button>
                      <button onClick={() => setConfirmDeleteShiftId(s.id)} aria-label="Delete" className="p-1.5 hover:bg-[var(--err-bg)] rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[var(--err)] text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Analytics ── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {branches.length > 0 && (
              <select
                className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                value={analyticsBranchFilter}
                onChange={(e) => setAnalyticsBranchFilter(e.target.value)}
              >
                <option value="ALL">{t.hr.allBranches ?? "All Branches"}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={async () => {
                if (!confirm(t.hr.carryForwardConfirm)) return;
                try {
                  await apiFetch("/api/hr/leaves/carry-forward", { method: "POST", body: JSON.stringify({}) });
                  alert(t.hr.carryForwardDone); fetchStats();
                } catch { alert(t.hr.carryForwardFailed); }
              }}
              className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] px-4 py-2 rounded-lg text-sm text-[var(--txt1)] hover:bg-[var(--surface2)] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">event_repeat</span>
              {t.hr.carryForward}
            </button>
          </div>

          {analyticsLoading ? (
            <Spinner label={t.hr.loading} />
          ) : analytics ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="groups" iconBg="bg-[#d3e4ff]" iconColor="text-[var(--blue)]" label={t.hr.totalEmployees} value={analytics.headcount.total} />
                <StatCard icon="check_circle" iconBg="bg-[var(--ok-bg)]" iconColor="text-[var(--ok)]" label={t.hr.active} value={analytics.headcount.active} />
                <StatCard icon="event_busy" iconBg="bg-[var(--warn-bg)]" iconColor="text-[var(--warn)]" label={t.hr.onLeave} value={analytics.headcount.onLeave} />
                <StatCard icon="trending_down" iconBg="bg-[var(--err-bg)]" iconColor="text-[var(--err)]" label={t.hr.attritionThisYear} value={analytics.attritionThisYear} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-5">
                  <h3 className="text-sm font-bold text-[var(--txt1)] mb-4">{t.hr.headcountByDept}</h3>
                  {analytics.byDepartment.length === 0 ? (
                    <p className="text-sm text-[var(--txt2)] py-4 text-center">{t.common.noData}</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.byDepartment.map((d) => (
                        <div key={d.name} className="flex items-center gap-3">
                          <span className="text-sm text-[var(--txt2)] flex-1 truncate">{d.name}</span>
                          <div className="w-24 bg-[#e3e2e6] rounded-full h-2 flex-shrink-0">
                            <div
                              className="bg-[var(--blue)] h-2 rounded-full"
                              style={{ width: `${Math.min(100, (d.count / (analytics.headcount.total || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-[var(--txt1)] w-6 text-end">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-5">
                  <h3 className="text-sm font-bold text-[var(--txt1)] mb-4">{t.hr.leaveTypeBreakdown}</h3>
                  <div className="space-y-1 mb-4">
                    {Object.entries(analytics.leaveStats.byType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center py-1.5 border-b border-[#f4f3f7]">
                        <span className="text-sm text-[var(--txt2)]">{LEAVE_TYPE_LABEL[type] ?? type.replace(/_/g, " ")}</span>
                        <span className="text-sm font-semibold text-[var(--txt1)]">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-2 text-xs text-[var(--txt2)]">
                    <span>{t.common.pending}: <strong className="text-[var(--warn)]">{analytics.leaveStats.pendingCount}</strong></span>
                    <span>{t.common.approved}: <strong className="text-[var(--ok)]">{analytics.leaveStats.approvedThisMonth}</strong></span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-5">
                <h3 className="text-sm font-bold text-[var(--txt1)] mb-4">{t.hr.payrollOverview}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[var(--surface2)] rounded-xl p-4">
                    <p className="text-xs text-[var(--txt2)] mb-1">{t.hr.totalNetPayroll}</p>
                    <p className="text-xl font-bold text-[var(--txt1)]">{formatCurrency(analytics.payrollSummary.totalNetSalary)}</p>
                  </div>
                  <div className="bg-[var(--surface2)] rounded-xl p-4">
                    <p className="text-xs text-[var(--txt2)] mb-1">{t.hr.grossSalary}</p>
                    <p className="text-xl font-bold text-[var(--txt1)]">{formatCurrency(analytics.payrollSummary.totalGrossSalary)}</p>
                  </div>
                  <div className="bg-[var(--surface2)] rounded-xl p-4">
                    <p className="text-xs text-[var(--txt2)] mb-1">{t.hr.processed}</p>
                    <p className="text-xl font-bold text-[var(--txt1)]">{analytics.payrollSummary.processedCount}</p>
                  </div>
                </div>
              </div>

              {analytics.contractsExpiring.length > 0 && (
                <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-5">
                  <h3 className="text-sm font-bold text-[var(--txt1)] mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--warn)] text-[18px]">warning</span>
                    {t.hr.contractsExpiring}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          {[t.hr.employee, t.hr.contractType, t.common.date, ""].map((h, i) => (
                            <th key={i} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider pb-2 pe-4 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.contractsExpiring.map((c, i) => (
                          <tr key={i} className="border-b border-[#f4f3f7]">
                            <td className="py-2.5 pe-4 font-semibold text-[var(--txt1)]">{c.employeeName}</td>
                            <td className="py-2.5 pe-4 text-[var(--txt2)]">{c.contractType.replace(/_/g, " ")}</td>
                            <td className="py-2.5 pe-4 text-[var(--txt2)] whitespace-nowrap">{c.endDate?.slice(0, 10) ?? "—"}</td>
                            <td className="py-2.5">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.daysUntilExpiry <= 0 ? "bg-[var(--err-bg)] text-[var(--err)]" : "bg-[var(--warn-bg)] text-[var(--warn)]"}`}>
                                {c.daysUntilExpiry <= 0 ? t.hr.expired : `${c.daysUntilExpiry}d`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-16 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">analytics</span>
              <p className="text-sm text-[var(--txt2)]">{t.common.noData}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Leave Policies ── */}
      {activeTab === "leavePolicies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--txt1)]">{t.hr.leavePolicies}</h2>
              <p className="text-sm text-[var(--txt2)] mt-0.5">{t.hr.leavePoliciesDesc}</p>
            </div>
          </div>
          {policiesLoading ? (
            <Spinner label={t.hr.loading} />
          ) : leavePolicies.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#c4c6cf] block mb-2">policy</span>
              <p className="text-sm text-[var(--txt2)]">{t.hr.noPolicies}</p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface2)] border-b border-[var(--border)]">
                    {[t.hr.leaveType, t.hr.maxDays, t.hr.carryForwardMax, t.hr.medicalCertLabel, t.hr.probationAllowed, t.hr.minService, ""].map((h, i) => (
                      <th key={i} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e2e6]">
                  {leavePolicies.map(p => (
                    <tr key={p.id} className="hover:bg-[var(--surface2)] transition-colors">
                      {policyEditing === p.id ? (
                        <>
                          <td className="px-5 py-3 font-semibold text-[var(--txt1)]">{leaveTypeLabel(p.leaveType)}</td>
                          <td className="px-5 py-3"><input type="number" className="input-field w-20 text-sm" min={0} value={policyForm.maxDaysPerYear ?? p.maxDaysPerYear} onChange={e => setPolicyForm(f => ({ ...f, maxDaysPerYear: Number(e.target.value) }))} /></td>
                          <td className="px-5 py-3"><input type="number" className="input-field w-20 text-sm" min={0} value={policyForm.carryForwardMax ?? p.carryForwardMax} onChange={e => setPolicyForm(f => ({ ...f, carryForwardMax: Number(e.target.value) }))} /></td>
                          <td className="px-5 py-3"><input type="checkbox" checked={policyForm.requiresMedicalCert ?? p.requiresMedicalCert} onChange={e => setPolicyForm(f => ({ ...f, requiresMedicalCert: e.target.checked }))} className="w-4 h-4 accent-[var(--blue)]" /></td>
                          <td className="px-5 py-3"><input type="checkbox" checked={policyForm.probationAllowed ?? p.probationAllowed} onChange={e => setPolicyForm(f => ({ ...f, probationAllowed: e.target.checked }))} className="w-4 h-4 accent-[var(--blue)]" /></td>
                          <td className="px-5 py-3"><input type="number" className="input-field w-20 text-sm" min={0} value={policyForm.minServiceDays ?? p.minServiceDays} onChange={e => setPolicyForm(f => ({ ...f, minServiceDays: Number(e.target.value) }))} /></td>
                          <td className="px-5 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => handleSavePolicy(p.id)} disabled={policySaving} className="btn-primary px-3 py-1 text-xs disabled:opacity-60">{policySaving ? "…" : t.common.save}</button>
                              <button onClick={() => setPolicyEditing(null)} className="btn-secondary px-3 py-1 text-xs">{t.common.cancel}</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3.5 font-semibold text-[var(--txt1)]">{leaveTypeLabel(p.leaveType)}</td>
                          <td className="px-5 py-3.5 text-[var(--txt2)]">{p.maxDaysPerYear} {t.hr.daysUnit}</td>
                          <td className="px-5 py-3.5 text-[var(--txt2)]">{p.carryForwardMax} {t.hr.daysUnit}</td>
                          <td className="px-5 py-3.5"><span className={`badge ${p.requiresMedicalCert ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--surface2)] text-[var(--txt2)]"}`}>{p.requiresMedicalCert ? t.common.yes : t.common.no}</span></td>
                          <td className="px-5 py-3.5"><span className={`badge ${p.probationAllowed ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--surface2)] text-[var(--txt2)]"}`}>{p.probationAllowed ? t.common.yes : t.common.no}</span></td>
                          <td className="px-5 py-3.5 text-[var(--txt2)]">{p.minServiceDays} {t.hr.daysUnit}</td>
                          <td className="px-5 py-3.5">
                            <button onClick={() => { setPolicyEditing(p.id); setPolicyForm({}); }} className="text-xs text-[var(--blue)] hover:underline font-semibold">
                              {t.common.edit}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Org Chart ── */}
      {activeTab === "orgChart" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--txt1)]">{t.hr.orgChart}</h2>
              <p className="text-sm text-[var(--txt2)] mt-0.5">{t.hr.orgChartDesc}</p>
            </div>
            <input
              className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2 text-sm text-[var(--txt1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20 w-56"
              placeholder={t.hr.searchPlaceholder}
              value={orgSearch}
              onChange={e => setOrgSearch(e.target.value)}
            />
          </div>
          {orgLoading ? (
            <Spinner label={t.hr.loading} />
          ) : orgNodes.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#c4c6cf] block mb-2">account_tree</span>
              <p className="text-sm text-[var(--txt2)]">{t.hr.noOrgData}</p>
            </div>
          ) : (
            <OrgTree nodes={orgNodes} search={orgSearch} noResultsText={t.hr.noEmployees} />
          )}
        </div>
      )}

      {/* ── Payslip Modal ── */}
      {payslipPayrollId && (
        <PayslipModal payrollId={payslipPayrollId} onClose={() => setPayslipPayrollId(null)} />
      )}

      {/* ── Rejection Reason Modal ── */}
      {rejectModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="reject-leave-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <div>
                <h2 id="reject-leave-title" className="text-base font-bold text-[var(--txt1)]">{t.hr.rejectLeave}</h2>
                <p className="text-xs text-[var(--txt2)] mt-0.5">{rejectModal.employeeName}</p>
              </div>
              <button onClick={() => setRejectModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[var(--surface2)] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[var(--txt2)]">close</span>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.rejectionReason}</label>
              <textarea
                rows={3}
                className="input-field resize-none w-full"
                placeholder={t.hr.rejectionReasonPlaceholder}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button onClick={() => setRejectModal(null)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button
                onClick={handleRejectWithReason}
                className="flex items-center gap-2 bg-[var(--err)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                {t.hr.reject}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave Creation Modal ── */}
      {leaveModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="leave-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setLeaveModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <h2 id="leave-modal-title" className="text-lg font-bold text-[var(--txt1)]">{t.hr.newLeaveRequest}</h2>
              <button onClick={() => setLeaveModal(false)} aria-label={t.common.close} className="p-2 hover:bg-[var(--surface2)] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[var(--txt2)]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {leaveError && <div className="bg-[var(--err-bg)] text-[var(--err)] text-sm px-4 py-2.5 rounded-lg">{leaveError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.employee} *</label>
                <select className="input-field" value={leaveForm.employeeId} onChange={(e) => setLeaveForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">{t.hr.searchPlaceholder}</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.user.name} ({emp.empCode})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.leaveType} *</label>
                <select className="input-field" value={leaveForm.type} onChange={(e) => setLeaveForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="ANNUAL">{t.hr.leaveTypeAnnual}</option>
                  <option value="SICK">{t.hr.leaveTypeSick}</option>
                  <option value="EMERGENCY">{t.hr.leaveTypeEmergency}</option>
                  <option value="MATERNITY">{t.hr.leaveTypeMaternity}</option>
                  <option value="PATERNITY">{t.hr.leaveTypePaternity}</option>
                  <option value="UNPAID">{t.hr.leaveTypeUnpaid}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.startDate} *</label>
                  <input type="date" className="input-field" value={leaveForm.startDate} onChange={(e) => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.endDate} *</label>
                  <input type="date" className="input-field" value={leaveForm.endDate} onChange={(e) => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.leaveDaysLabel} *</label>
                <input type="number" min="1" className="input-field" value={leaveForm.days} onChange={(e) => setLeaveForm(f => ({ ...f, days: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.leaveReason}</label>
                <textarea rows={3} className="input-field resize-none" placeholder={t.hr.leaveReasonPlaceholder} value={leaveForm.reason} onChange={(e) => setLeaveForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
              {leaveForm.type === "SICK" && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 rounded accent-[var(--blue)]" checked={leaveForm.medicalCert} onChange={(e) => setLeaveForm(f => ({ ...f, medicalCert: e.target.checked }))} />
                  <span className="text-sm text-[var(--txt1)]">{t.hr.medicalCertLabel}</span>
                </label>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button onClick={() => setLeaveModal(false)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={handleCreateLeave} disabled={leaveSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {leaveSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attendance Mark Modal ── */}
      {attMarkModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="att-mark-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setAttMarkModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <div>
                <h2 id="att-mark-title" className="text-base font-bold text-[var(--txt1)]">{t.hr.markAttendance}</h2>
                <p className="text-xs text-[var(--txt2)] mt-0.5">{attMarkModal.employeeName} · {attMarkModal.date}</p>
              </div>
              <button onClick={() => setAttMarkModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[var(--surface2)] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[var(--txt2)]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {ATT_STATUSES.map((s) => {
                  const cfg = ATT_MARKER[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setAttMarkStatus(s)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${attMarkStatus === s ? "border-[var(--brand)] bg-[#f0f4ff]" : "border-[var(--border)] hover:bg-[var(--surface2)]"}`}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${cfg.cls}`}>{cfg.sym}</span>
                      {ATT_LABEL[s] ?? s}
                    </button>
                  );
                })}
              </div>
            </div>
            {attMarkStatus === "PRESENT" && (
              <div className="px-6 pb-4 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1">{t.hr.checkIn}</label>
                  <input type="time" className="input-field text-sm" value={attMarkCheckIn} onChange={(e) => setAttMarkCheckIn(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1">{t.hr.checkOut}</label>
                  <input type="time" className="input-field text-sm" value={attMarkCheckOut} onChange={(e) => setAttMarkCheckOut(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1">{t.hr.overtimeHrs}</label>
                  <input type="number" className="input-field text-sm" value={attMarkOvertimeHrs} min="0" step="0.5" onChange={(e) => setAttMarkOvertimeHrs(e.target.value)} />
                </div>
              </div>
            )}
            {attMarkError && <p className="px-6 pb-3 text-xs text-[var(--err)]">{attMarkError}</p>}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button onClick={() => setAttMarkModal(null)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={handleMarkAttendance} disabled={attMarkSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {attMarkSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shift Add/Edit Modal ── */}
      {shiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShiftModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold text-[var(--txt1)]">{shiftModal === "add" ? t.hr.addShift : t.hr.editShift}</h2>
              <button onClick={() => setShiftModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[var(--surface2)] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[var(--txt2)]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {shiftError && <div className="bg-[var(--err-bg)] text-[var(--err)] text-sm px-4 py-2.5 rounded-lg">{shiftError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.shiftName} *</label>
                <input className="input-field" placeholder={t.hr.shiftNamePlaceholder} value={shiftForm.name} onChange={(e) => setShiftForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.startTime}</label>
                  <input type="time" className="input-field" value={shiftForm.startTime} onChange={(e) => setShiftForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.endTime}</label>
                  <input type="time" className="input-field" value={shiftForm.endTime} onChange={(e) => setShiftForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.daysOfWeek}</label>
                <div className="flex gap-2 flex-wrap">
                  {t.hr.daysShort.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setShiftForm(f => ({ ...f, daysOfWeek: f.daysOfWeek.includes(i) ? f.daysOfWeek.filter(d => d !== i) : [...f.daysOfWeek, i].sort() }))}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${shiftForm.daysOfWeek.includes(i) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-[var(--surface)] text-[var(--txt2)] border-[var(--border2)] hover:bg-[var(--surface2)]"}`}
                    >{day}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.branch}</label>
                  <select className="input-field" value={shiftForm.branchId} onChange={(e) => setShiftForm(f => ({ ...f, branchId: e.target.value }))}>
                    <option value="">{t.hr.allBranches}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.hr.color}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-10 h-9 rounded-lg border border-[var(--border2)] cursor-pointer" value={shiftForm.color} onChange={(e) => setShiftForm(f => ({ ...f, color: e.target.value }))} />
                    <span className="text-xs text-[var(--txt2)] font-mono">{shiftForm.color}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
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
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--txt1)]">{t.hr.assignments}</h2>
                <p className="text-xs text-[var(--txt2)]">{assignModal.name} · {assignModal.startTime}–{assignModal.endTime}</p>
              </div>
              <button onClick={() => setAssignModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[var(--surface2)] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[var(--txt2)]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Add assignment form */}
              <div className="bg-[#f8f7fb] rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider">{t.hr.assignEmployee}</p>
                {assignError && <div className="bg-[var(--err-bg)] text-[var(--err)] text-xs px-3 py-2 rounded-lg">{assignError}</div>}
                <select className="input-field text-sm" value={assignForm.employeeId} onChange={(e) => setAssignForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">{t.hr.searchPlaceholder}</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.user.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[var(--txt2)] mb-1 block">{t.hr.startDate}</label>
                    <input type="date" className="input-field text-sm" value={assignForm.startDate} onChange={(e) => setAssignForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--txt2)] mb-1 block">{t.hr.endDate}</label>
                    <input type="date" className="input-field text-sm" value={assignForm.endDate} onChange={(e) => setAssignForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <button onClick={saveAssignment} disabled={assignSaving} className="w-full btn-primary py-2 text-sm disabled:opacity-60">
                  {assignSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.hr.assignEmployee}
                </button>
              </div>

              {/* Current assignments list */}
              <div>
                <p className="text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-2">{t.hr.assignments} ({assignments.length})</p>
                {assignments.length === 0 ? (
                  <p className="text-sm text-[var(--txt2)] text-center py-4">{t.hr.noShifts}</p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--txt1)]">{a.employeeName}</p>
                          <p className="text-xs text-[var(--txt2)]">{a.jobTitle} · {t.hr.assignedFrom} {a.startDate?.slice(0, 10)}</p>
                        </div>
                        <button onClick={() => removeAssignment(a.id)} aria-label="Remove" className="p-1.5 hover:bg-[var(--err-bg)] rounded-lg transition-colors">
                          <span className="material-symbols-outlined text-[var(--err)] text-[16px]">remove_circle</span>
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

      {/* ── Delete Shift Confirmation ── */}
      {confirmDeleteShiftId && (
        <div role="dialog" aria-modal="true" aria-labelledby="del-shift-title" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--err-bg)] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[28px] text-[var(--err)]">delete</span>
            </div>
            <h2 id="del-shift-title" className="text-base font-bold text-[var(--txt1)] mb-2">{t.common.delete}</h2>
            <p className="text-sm text-[var(--txt2)] mb-6">{t.common.confirmDelete}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteShiftId(null)} className="btn-secondary flex-1">{t.common.cancel}</button>
              <button onClick={confirmDeleteShift} className="flex-1 bg-[var(--err)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">{t.common.delete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

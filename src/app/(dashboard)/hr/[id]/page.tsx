"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, formatCurrency, getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import EditLog from "@/components/layout/EditLog";

type Employee = Record<string, unknown>;
type Department = { id: string; name: string };
type Branch = { id: string; name: string };

const ALL_ROLES = [
  "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "RECEPTIONIST",
  "NURSE", "ACCOUNTANT", "HR_OFFICER", "PHARMACIST",
  "LAB_TECHNICIAN", "RADIOLOGIST", "AUDITOR", "STAFF",
] as const;

const EMP_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const;
const EMP_STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"] as const;

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  interface LeaveRecord {
    id: string; type: string; startDate: string; endDate: string;
    days: number; status: string; reason?: string; approverName?: string; rejectedReason?: string;
  }
  interface SalaryRecord {
    id: string; basicSalary: number; housingAllowance: number; transportAllowance: number;
    medicalAllowance: number; effectiveDate: string; reason: string; changedBy: string;
  }

  interface ContractRecord {
    id: string; contractType: string; startDate: string; endDate?: string;
    notes?: string; isExpiringSoon: boolean;
  }
  interface EosData {
    yearsOfService: number; fractionYear: number;
    resignationEos: number; terminationEos: number; monthlySalary: number;
  }
  interface ReviewRecord { id: string; period: string; rating: number; reviewerName: string | null; status: string; strengths: string | null; improvements: string | null; comments: string | null; goals: { title: string; status: string }[]; }
  interface DocRecord { id: string; name: string; docType: string; notes: string | null; expiryDate: string | null; uploadedBy: string | null; isExpiringSoon: boolean; }

  const [emp, setEmp] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveRecord[]>([]);
  const [leaveHistoryLoading, setLeaveHistoryLoading] = useState(false);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [eos, setEos] = useState<EosData | null>(null);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecord[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ period: "", rating: "3", strengths: "", improvements: "", comments: "" });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", docType: "NATIONAL_ID", notes: "", expiryDate: "" });
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ name: "", email: "", password: "", roles: [] as string[] });
  const [createUserSaving, setCreateUserSaving] = useState(false);
  const [createUserError, setCreateUserError] = useState("");
  const [contractModal, setContractModal] = useState(false);
  const [contractForm, setContractForm] = useState({ contractType: "PERMANENT", startDate: "", endDate: "", notes: "" });
  const [contractSaving, setContractSaving] = useState(false);
  const [contractError, setContractError] = useState("");

  async function handleAddContract(e: React.FormEvent) {
    e.preventDefault();
    if (!contractForm.startDate) { setContractError(t.common.required); return; }
    setContractSaving(true);
    setContractError("");
    try {
      const res = await fetch(`/api/hr/employees/${id}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType: contractForm.contractType,
          startDate: contractForm.startDate,
          endDate: contractForm.endDate || undefined,
          notes: contractForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setContractError(err.detail || t.hr.contractFailed);
        return;
      }
      setContractModal(false);
      setContractForm({ contractType: "PERMANENT", startDate: "", endDate: "", notes: "" });
      const cr = await fetch(`/api/hr/employees/${id}/contracts`);
      if (cr.ok) setContracts(await cr.json());
    } catch {
      setContractError(t.hr.contractFailed);
    } finally {
      setContractSaving(false);
    }
  }

  async function handleAddReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewForm.period) { setReviewError(t.common.required); return; }
    setReviewSaving(true); setReviewError("");
    try {
      const res = await fetch("/api/hr/performance-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: id,
          period: reviewForm.period,
          rating: Number(reviewForm.rating),
          strengths: reviewForm.strengths || undefined,
          improvements: reviewForm.improvements || undefined,
          comments: reviewForm.comments || undefined,
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setReviewError(err.detail || t.hr.reviewFailed); return; }
      setReviewModal(false);
      setReviewForm({ period: "", rating: "3", strengths: "", improvements: "", comments: "" });
      const rr = await fetch(`/api/hr/performance-reviews?employeeId=${id}`);
      if (rr.ok) setReviews(await rr.json());
    } catch { setReviewError(t.hr.reviewFailed); } finally { setReviewSaving(false); }
  }

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docForm.name) { setDocError(t.common.required); return; }
    setDocSaving(true); setDocError("");
    try {
      const res = await fetch(`/api/hr/employees/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docForm.name,
          docType: docForm.docType,
          notes: docForm.notes || undefined,
          expiryDate: docForm.expiryDate || undefined,
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setDocError(err.detail || t.hr.docFailed); return; }
      setDocModal(false);
      setDocForm({ name: "", docType: "NATIONAL_ID", notes: "", expiryDate: "" });
      const dr = await fetch(`/api/hr/employees/${id}/documents`);
      if (dr.ok) setDocs(await dr.json());
    } catch { setDocError(t.hr.docFailed); } finally { setDocSaving(false); }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm(t.common.confirmDelete)) return;
    await fetch(`/api/hr/documents/${docId}`, { method: "DELETE" });
    setDocs(ds => ds.filter(d => d.id !== docId));
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!createUserForm.name || !createUserForm.email || !createUserForm.password) {
      setCreateUserError("Name, email and password are required");
      return;
    }
    if (createUserForm.roles.length === 0) {
      setCreateUserError("Select at least one role");
      return;
    }
    setCreateUserSaving(true);
    setCreateUserError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createUserForm.name,
          email: createUserForm.email,
          password: createUserForm.password,
          roles: createUserForm.roles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateUserError(data.detail ?? data.error ?? "Failed to create user");
        return;
      }
      // Link the new user to this employee
      const linkRes = await fetch(`/api/hr/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.id }),
      });
      if (!linkRes.ok) {
        const err = await linkRes.json().catch(() => ({}));
        setCreateUserError(err.detail ?? "User created but failed to link employee");
        return;
      }
      const updated = await linkRes.json();
      setEmp(updated);
      setCreateUserModal(false);
      setCreateUserForm({ name: "", email: "", password: "", roles: [] });
    } catch {
      setCreateUserError("An unexpected error occurred");
    } finally {
      setCreateUserSaving(false);
    }
  }

  const load = useCallback(async () => {
    const [empRes, deptRes, branchRes] = await Promise.all([
      fetch(`/api/hr/employees/${id}`),
      fetch("/api/hr/departments"),
      fetch("/api/branches"),
    ]);
    if (empRes.ok) setEmp(await empRes.json());
    if (deptRes.ok) setDepartments(await deptRes.json());
    if (branchRes.ok) setBranches(await branchRes.json());
    setLoading(false);
    setLeaveHistoryLoading(true);
    setContractsLoading(true);
    setSalaryLoading(true);
    setReviewsLoading(true);
    setDocsLoading(true);
    try {
      const [lr, cr, eosRes, salRes, revRes, docRes] = await Promise.all([
        fetch(`/api/hr/leaves?employeeId=${id}`),
        fetch(`/api/hr/employees/${id}/contracts`),
        fetch(`/api/hr/employees/${id}/eos?reason=resigned`),
        fetch(`/api/hr/salary-history/${id}`),
        fetch(`/api/hr/performance-reviews?employeeId=${id}`),
        fetch(`/api/hr/employees/${id}/documents`),
      ]);
      if (lr.ok) { const d = await lr.json(); setLeaveHistory(d.data ?? []); }
      if (cr.ok) setContracts(await cr.json());
      if (eosRes.ok) setEos(await eosRes.json());
      if (salRes.ok) setSalaryHistory(await salRes.json());
      if (revRes.ok) setReviews(await revRes.json());
      if (docRes.ok) setDocs(await docRes.json());
    } catch { /* ignore */ } finally {
      setLeaveHistoryLoading(false);
      setContractsLoading(false);
      setSalaryLoading(false);
      setReviewsLoading(false);
      setDocsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
    </div>
  );

  if (!emp) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">person_off</span>
      <p className="text-sm font-semibold text-[#1a1c1e]">{t.hr.noEmployees}</p>
      <button onClick={() => router.push("/hr")} className="text-sm text-[#1960a3] hover:underline">{t.hr.backToHR}</button>
    </div>
  );

  const user = (emp.user as Record<string, unknown>) ?? {};
  const dept = (emp.department as Record<string, unknown>) ?? {};
  const userRoles = (user.roles as string[]) ?? [];
  const totalComp = [emp.basicSalary, emp.housingAllowance, emp.transportAllowance, emp.medicalAllowance]
    .reduce((sum: number, v) => sum + (Number(v) || 0), 0);
  const yearsOfService = emp.hireDate
    ? Math.floor((Date.now() - new Date(emp.hireDate as string).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const probationDaysLeft = emp.probationEndDate
    ? Math.ceil((new Date(emp.probationEndDate as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const probationEndingSoon = probationDaysLeft !== null && probationDaysLeft >= 0 && probationDaysLeft <= 30;

  const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
    ACTIVE:     { label: t.hr.activeStatus,   cls: "bg-[#ccfbf1] text-[#0d9488]" },
    ON_LEAVE:   { label: t.hr.onLeaveStatus,  cls: "bg-[#fff7ed] text-[#d97706]" },
    INACTIVE:   { label: t.hr.inactiveStatus, cls: "bg-[#f4f3f7] text-[#74777f]" },
    TERMINATED: { label: t.hr.terminated,     cls: "bg-[#ffdad6] text-[#ba1a1a]" },
  };

  const TYPE_LABELS: Record<string, string> = {
    FULL_TIME: t.hr.fullTime,
    PART_TIME: t.hr.partTime,
    CONTRACT:  t.hr.contract,
  };

  const LEAVE_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: t.common.pending,   cls: "bg-[#fff7ed] text-[#d97706]" },
    APPROVED: { label: t.common.approved,  cls: "bg-[#ccfbf1] text-[#0d9488]" },
    REJECTED: { label: t.common.rejected,  cls: "bg-[#ffdad6] text-[#ba1a1a]" },
    CANCELLED:{ label: t.common.cancel,    cls: "bg-[#e3e2e6] text-[#74777f]" },
  };

  const LEAVE_TYPE_LABELS: Record<string, string> = {
    ANNUAL: t.hr.leaveTypeAnnual, SICK: t.hr.leaveTypeSick,
    EMERGENCY: t.hr.leaveTypeEmergency, MATERNITY: t.hr.leaveTypeMaternity,
    PATERNITY: t.hr.leaveTypePaternity, UNPAID: t.hr.leaveTypeUnpaid,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/hr")} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{user.name as string}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{emp.empCode as string} · {dept.name as string} · {emp.jobTitle as string}</p>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          {t.hr.editEmployee}
        </button>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-[#002045] flex items-center justify-center flex-shrink-0 text-white text-2xl font-bold">
            {getInitials(user.name as string ?? "")}
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
            <InfoItem label={t.hr.empCode} value={emp.empCode as string} />
            <InfoItem label={t.hr.hireDate2} value={emp.hireDate ? formatDate(emp.hireDate as string) : "—"} />
            {yearsOfService !== null && <InfoItem label={t.hr.yearsOfService} value={`${yearsOfService} ${t.common.yrs}`} />}
            <InfoItem label={t.hr.type} value={TYPE_LABELS[emp.employmentType as string] ?? (emp.employmentType as string)} />
            <InfoItem label={t.hr.status}>
              {(() => { const s = STATUS_STYLES[emp.status as string] ?? STATUS_STYLES.INACTIVE; return (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
              ); })()}
            </InfoItem>
            <InfoItem label={t.hr.phone} value={(user.phone as string) ?? "—"} />
            <InfoItem label={t.hr.email} value={(user.email as string) ?? "—"} />
            <InfoItem label="System Account">
              {(user.id as string) ? (
                <Link
                  href={`/users?search=${encodeURIComponent(user.email as string)}`}
                  className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1.5 rounded-lg bg-[#d3e4ff] hover:bg-[#b8d4ff] text-[#1960a3] text-xs font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">manage_accounts</span>
                  {user.name as string}
                  <span className="material-symbols-outlined text-[12px] opacity-60">open_in_new</span>
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setCreateUserForm({ name: "", email: "", password: "", roles: [] });
                    setCreateUserError("");
                    setCreateUserModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1.5 rounded-lg bg-[#ccfbf1] hover:bg-[#a7f3d0] text-[#0d9488] text-xs font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">person_add</span>
                  Create Account
                </button>
              )}
            </InfoItem>
            <InfoItem label={t.hr.branch} value={branches.find(b => b.id === (emp.branchId as string))?.name ?? "—"} />
            <InfoItem label={t.hr.department} value={dept.name as string ?? "—"} />
            {!!emp.probationEndDate && (
              <InfoItem label={t.hr.probationEnd}>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-[#1a1c1e]">{formatDate(emp.probationEndDate as string)}</p>
                  {probationEndingSoon && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#fff7ed] text-[#d97706] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px]">warning</span>
                      {probationDaysLeft}d
                    </span>
                  )}
                </div>
              </InfoItem>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compensation */}
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1960a3] text-[18px]">payments</span>
            {t.hr.compensationInfo}
          </h3>
          <div className="space-y-3">
            <CompRow label={t.hr.baseSalary} value={Number(emp.basicSalary).toFixed(2)} />
            <CompRow label={t.hr.housingAllowance} value={Number(emp.housingAllowance || 0).toFixed(2)} />
            <CompRow label={t.hr.transportAllowance} value={Number(emp.transportAllowance || 0).toFixed(2)} />
            <CompRow label={t.hr.medicalAllowance} value={Number(emp.medicalAllowance || 0).toFixed(2)} />
            <div className="border-t border-[#e3e2e6] pt-3">
              <CompRow label={t.hr.totalComp} value={(totalComp as number).toFixed(2)} bold />
            </div>
          </div>
        </div>

        {/* Leave balances */}
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0d9488] text-[18px]">beach_access</span>
            {t.hr.leaveRequests}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <LeaveCard label={t.hr.annualLeave} value={emp.annualLeaveBalance as number} color="bg-[#d3e4ff] text-[#1960a3]" />
            <LeaveCard label={t.hr.sickLeave} value={emp.sickLeaveBalance as number} color="bg-[#ccfbf1] text-[#0d9488]" />
          </div>
        </div>
      </div>

      {/* Bank info */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1960a3] text-[18px]">account_balance</span>
          {t.hr.bankInfo}
        </h3>
        {emp.bankName || emp.bankAccount ? (
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label={t.hr.bankName} value={(emp.bankName as string) || "—"} />
            <InfoItem label={t.hr.bankAccount} value={(emp.bankAccount as string) || "—"} />
          </div>
        ) : (
          <p className="text-sm text-[#74777f]">{t.hr.noBankInfo}</p>
        )}
      </div>

      {/* Contracts */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1a1c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1960a3] text-[18px]">description</span>
            {t.hr.contractType}
          </h3>
          <button
            onClick={() => { setContractModal(true); setContractError(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1960a3] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            {t.hr.addContract}
          </button>
        </div>
        {contractsLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-[#74777f]">{t.hr.noContracts}</p>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-[#f8f7fb] rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-[#1a1c1e]">{c.contractType.replace(/_/g, " ")}</p>
                  <p className="text-xs text-[#74777f]">{c.startDate?.slice(0, 10)}{c.endDate ? ` → ${c.endDate.slice(0, 10)}` : ""}</p>
                  {c.notes && <p className="text-xs text-[#74777f] mt-0.5 italic">{c.notes}</p>}
                </div>
                {c.isExpiringSoon && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#fff7ed] text-[#d97706] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">warning</span>
                    {t.hr.contractsExpiring}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EOS Estimate */}
      {eos && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#d97706] text-[18px]">calculate</span>
            {t.hr.eosEstimate}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#f4f3f7] rounded-xl p-4">
              <p className="text-xs text-[#74777f] mb-1">{t.hr.yearsOfService}</p>
              <p className="text-xl font-bold text-[#1a1c1e]">{eos.yearsOfService} <span className="text-sm font-normal text-[#74777f]">{t.common.yrs}</span></p>
            </div>
            <div className="bg-[#fff7ed] rounded-xl p-4">
              <p className="text-xs text-[#d97706] mb-1">{t.hr.eosResignation}</p>
              <p className="text-xl font-bold text-[#1a1c1e]">{formatCurrency(eos.resignationEos)}</p>
            </div>
            <div className="bg-[#ffdad6] rounded-xl p-4">
              <p className="text-xs text-[#ba1a1a] mb-1">{t.hr.eosTerminated}</p>
              <p className="text-xl font-bold text-[#1a1c1e]">{formatCurrency(eos.terminationEos)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Leave History */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#d97706] text-[18px]">event_busy</span>
          {t.hr.leaveHistory}
        </h3>
        {leaveHistoryLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
          </div>
        ) : leaveHistory.length === 0 ? (
          <p className="text-sm text-[#74777f]">{t.hr.noLeaveHistory}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e3e2e6]">
                  {[t.hr.leaveType, t.hr.startDate, t.hr.endDate, t.hr.days, t.common.status, t.hr.approverName, t.hr.rejectionReason].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-[#74777f] uppercase tracking-wider pb-2 pe-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaveHistory.map(lr => {
                  const sc = LEAVE_STATUS_STYLES[lr.status] ?? LEAVE_STATUS_STYLES.PENDING;
                  return (
                    <tr key={lr.id} className="border-b border-[#f4f3f7]">
                      <td className="py-2.5 pe-4 text-[#1a1c1e]">{LEAVE_TYPE_LABELS[lr.type] ?? lr.type}</td>
                      <td className="py-2.5 pe-4 text-[#43474e] whitespace-nowrap">{formatDate(lr.startDate)}</td>
                      <td className="py-2.5 pe-4 text-[#43474e] whitespace-nowrap">{formatDate(lr.endDate)}</td>
                      <td className="py-2.5 pe-4 text-[#43474e]">{lr.days}</td>
                      <td className="py-2.5 pe-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>{sc.label}</span>
                      </td>
                      <td className="py-2.5 pe-4 text-xs text-[#43474e]">{lr.approverName || "—"}</td>
                      <td className="py-2.5 text-xs text-[#74777f] max-w-[180px] truncate">{lr.rejectedReason || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Salary History */}
      {salaryHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1960a3] text-[18px]">trending_up</span>
            {t.hr.salaryHistory}
          </h3>
          {salaryLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e3e2e6]">
                    {[t.hr.effectiveDate, t.hr.baseSalary, t.hr.totalComp, t.common.reason].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-[#74777f] uppercase tracking-wider pb-2 pe-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salaryHistory.map(sh => {
                    const total = sh.basicSalary + (sh.housingAllowance || 0) + (sh.transportAllowance || 0) + (sh.medicalAllowance || 0);
                    return (
                      <tr key={sh.id} className="border-b border-[#f4f3f7]">
                        <td className="py-2.5 pe-4 text-[#43474e] whitespace-nowrap">{formatDate(sh.effectiveDate)}</td>
                        <td className="py-2.5 pe-4 font-semibold text-[#1a1c1e]">{formatCurrency(sh.basicSalary)}</td>
                        <td className="py-2.5 pe-4 text-[#43474e]">{formatCurrency(total)}</td>
                        <td className="py-2.5 text-xs text-[#74777f]">{sh.reason || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Roles */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#d97706] text-[18px]">admin_panel_settings</span>
          {t.hr.rolesPermissions}
        </h3>
        <div className="flex flex-wrap gap-2">
          {userRoles.length === 0 ? (
            <p className="text-sm text-[#74777f]">—</p>
          ) : (
            userRoles.map((r) => (
              <span key={r} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#002045] text-white">{r}</span>
            ))
          )}
        </div>
      </div>

      {/* Performance Reviews */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1a1c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1960a3] text-[18px]">star_rate</span>
            {t.hr.performanceReviews}
          </h3>
          <button onClick={() => { setReviewModal(true); setReviewError(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1960a3] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[14px]">add</span>
            {t.hr.addReview}
          </button>
        </div>
        {reviewsLoading ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-[#74777f]">{t.hr.noReviews}</p>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="p-4 bg-[#f8f7fb] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#1a1c1e]">{r.period}</span>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <span key={s} className={`material-symbols-outlined text-[16px] ${s <= r.rating ? "text-[#d97706]" : "text-[#c4c6cf]"}`}>star</span>)}</div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "ACKNOWLEDGED" ? "bg-[#ccfbf1] text-[#0d9488]" : r.status === "SUBMITTED" ? "bg-[#d3e4ff] text-[#1960a3]" : "bg-[#f4f3f7] text-[#74777f]"}`}>{r.status}</span>
                  </div>
                  <span className="text-xs text-[#74777f]">{r.reviewerName ?? "—"}</span>
                </div>
                {r.strengths && <p className="text-xs text-[#43474e] mt-1"><span className="font-semibold">{t.hr.strengths}:</span> {r.strengths}</p>}
                {r.improvements && <p className="text-xs text-[#43474e]"><span className="font-semibold">{t.hr.improvements}:</span> {r.improvements}</p>}
                {r.comments && <p className="text-xs text-[#74777f] mt-1 italic">{r.comments}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1a1c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1960a3] text-[18px]">folder_open</span>
            {t.hr.documents}
          </h3>
          <button onClick={() => { setDocModal(true); setDocError(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1960a3] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[14px]">add</span>
            {t.hr.addDocument}
          </button>
        </div>
        {docsLoading ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-[#74777f]">{t.hr.noDocuments}</p>
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-[#f8f7fb] rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#1960a3] text-[20px]">description</span>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1c1e]">{d.name}</p>
                    <p className="text-xs text-[#74777f]">{d.docType.replace(/_/g, " ")} {d.expiryDate ? `· ${t.hr.expires}: ${d.expiryDate}` : ""}</p>
                    {d.notes && <p className="text-xs text-[#74777f] italic">{d.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.isExpiringSoon && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#fff7ed] text-[#d97706]">{t.hr.expiringSoon}</span>}
                  <button onClick={() => handleDeleteDoc(d.id)} aria-label={t.common.delete} className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Log */}
      <EditLog entityId={id as string} />

      {/* Create User Account Modal */}
      {createUserModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="create-user-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setCreateUserModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <div>
                <h2 id="create-user-modal-title" className="text-base font-bold text-[#1a1c1e]">Create System Account</h2>
                <p className="text-xs text-[#74777f] mt-0.5">Link a login account to this employee</p>
              </div>
              <button onClick={() => setCreateUserModal(false)} aria-label="Close" className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {createUserError && (
                <div className="flex items-center gap-2 bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {createUserError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  className="input-field"
                  placeholder="Employee full name"
                  value={createUserForm.name}
                  onChange={e => setCreateUserForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Email *</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="user@clinic.com"
                  value={createUserForm.email}
                  onChange={e => setCreateUserForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Password *</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Min 8 chars, 1 uppercase, 1 digit"
                  value={createUserForm.password}
                  onChange={e => setCreateUserForm(f => ({ ...f, password: e.target.value }))}
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">Roles *</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map(role => {
                    const active = createUserForm.roles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setCreateUserForm(f => ({
                          ...f,
                          roles: active ? f.roles.filter(r => r !== role) : [...f.roles, role],
                        }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                          active ? "bg-[#002045] text-white border-[#002045]" : "bg-white text-[#43474e] border-[#c4c6cf] hover:border-[#1960a3]"
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-[#e3e2e6]">
                <button type="button" onClick={() => setCreateUserModal(false)} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserSaving || createUserForm.roles.length === 0}
                  className="flex-1 bg-[#002045] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {createUserSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[16px]">person_add</span>}
                  Create & Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <EditEmployeeModal
          emp={emp}
          departments={departments}
          branches={branches}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => { setEmp(updated); setEditOpen(false); }}
        />
      )}

      {/* Add Contract Modal */}
      {contractModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="contract-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setContractModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="contract-modal-title" className="text-base font-bold text-[#1a1c1e]">{t.hr.addContract}</h2>
              <button onClick={() => setContractModal(false)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddContract} className="p-6 space-y-4">
              {contractError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{contractError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.contractType} *</label>
                <select className="input-field" value={contractForm.contractType} onChange={e => setContractForm(f => ({ ...f, contractType: e.target.value }))} required>
                  {["PERMANENT", "FIXED_TERM", "PART_TIME", "PROBATION", "INTERNSHIP"].map(ct => (
                    <option key={ct} value={ct}>{ct.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.contractStart} *</label>
                  <input type="date" className="input-field" value={contractForm.startDate} onChange={e => setContractForm(f => ({ ...f, startDate: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.contractEnd}</label>
                  <input type="date" className="input-field" value={contractForm.endDate} onChange={e => setContractForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.common.notes}</label>
                <textarea className="input-field resize-none" rows={2} value={contractForm.notes} onChange={e => setContractForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e2e6]">
                <button type="button" onClick={() => setContractModal(false)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
                <button type="submit" disabled={contractSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                  {contractSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.hr.contractSaved}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {reviewModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="review-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setReviewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="review-modal-title" className="text-base font-bold text-[#1a1c1e]">{t.hr.addReview}</h2>
              <button onClick={() => setReviewModal(false)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors"><span className="material-symbols-outlined text-[#74777f]">close</span></button>
            </div>
            <form onSubmit={handleAddReview} className="p-6 space-y-4">
              {reviewError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{reviewError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.reviewPeriod} *</label>
                  <input className="input-field" placeholder="2025-Q2" value={reviewForm.period} onChange={e => setReviewForm(f => ({ ...f, period: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.rating} (1-5) *</label>
                  <select className="input-field" value={reviewForm.rating} onChange={e => setReviewForm(f => ({ ...f, rating: e.target.value }))} required>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {'★'.repeat(n)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.strengths}</label>
                <textarea className="input-field resize-none" rows={2} value={reviewForm.strengths} onChange={e => setReviewForm(f => ({ ...f, strengths: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.improvements}</label>
                <textarea className="input-field resize-none" rows={2} value={reviewForm.improvements} onChange={e => setReviewForm(f => ({ ...f, improvements: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.common.notes}</label>
                <textarea className="input-field resize-none" rows={2} value={reviewForm.comments} onChange={e => setReviewForm(f => ({ ...f, comments: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e2e6]">
                <button type="button" onClick={() => setReviewModal(false)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
                <button type="submit" disabled={reviewSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                  {reviewSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {docModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="doc-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDocModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="doc-modal-title" className="text-base font-bold text-[#1a1c1e]">{t.hr.addDocument}</h2>
              <button onClick={() => setDocModal(false)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors"><span className="material-symbols-outlined text-[#74777f]">close</span></button>
            </div>
            <form onSubmit={handleAddDoc} className="p-6 space-y-4">
              {docError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{docError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.docName} *</label>
                <input className="input-field" value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="National ID — Front" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.docType} *</label>
                  <select className="input-field" value={docForm.docType} onChange={e => setDocForm(f => ({ ...f, docType: e.target.value }))} required>
                    {["NATIONAL_ID","PASSPORT","CERTIFICATE","CONTRACT","OFFER_LETTER","OTHER"].map(dt => (
                      <option key={dt} value={dt}>{dt.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.expiryDate}</label>
                  <input type="date" className="input-field" value={docForm.expiryDate} onChange={e => setDocForm(f => ({ ...f, expiryDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.common.notes}</label>
                <textarea className="input-field resize-none" rows={2} value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e2e6]">
                <button type="button" onClick={() => setDocModal(false)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
                <button type="submit" disabled={docSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                  {docSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────────────────────
function EditEmployeeModal({ emp, departments, branches, onClose, onSaved }: {
  emp: Employee;
  departments: Department[];
  branches: Branch[];
  onClose: () => void;
  onSaved: (e: Employee) => void;
}) {
  const { t } = useLanguage();
  const user = (emp.user as Record<string, unknown>) ?? {};
  const dept = (emp.department as Record<string, unknown>) ?? {};

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"personal" | "employment" | "compensation" | "roles">("personal");

  const [form, setForm] = useState({
    // user-level
    userName:           (user.name as string) ?? "",
    userPhone:          (user.phone as string) ?? "",
    userRoles:          ((user.roles as string[]) ?? []) as string[],
    // employee-level
    jobTitle:           (emp.jobTitle as string) ?? "",
    employmentType:     (emp.employmentType as string) ?? "FULL_TIME",
    status:             (emp.status as string) ?? "ACTIVE",
    departmentId:       (dept.id as string) ?? "",
    branchId:           (emp.branchId as string) ?? "",
    basicSalary:        String(emp.basicSalary ?? 0),
    housingAllowance:   String(emp.housingAllowance ?? 0),
    transportAllowance: String(emp.transportAllowance ?? 0),
    medicalAllowance:   String(emp.medicalAllowance ?? 0),
    annualLeaveBalance: String(emp.annualLeaveBalance ?? 21),
    sickLeaveBalance:   String(emp.sickLeaveBalance ?? 14),
  });

  function setF(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function toggleRole(r: string) {
    setForm(f => ({
      ...f,
      userRoles: f.userRoles.includes(r) ? f.userRoles.filter(x => x !== r) : [...f.userRoles, r],
    }));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!form.userName || !form.jobTitle) { setError(t.common.required); return; }
    if (form.userRoles.length === 0) { setError(t.hr.rolesNote); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/hr/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: form.userName,
          userPhone: form.userPhone || undefined,
          userRoles: form.userRoles,
          jobTitle: form.jobTitle,
          employmentType: form.employmentType,
          status: form.status,
          departmentId: form.departmentId || undefined,
          branchId: form.branchId || undefined,
          basicSalary: Number(form.basicSalary) || 0,
          housingAllowance: Number(form.housingAllowance) || 0,
          transportAllowance: Number(form.transportAllowance) || 0,
          medicalAllowance: Number(form.medicalAllowance) || 0,
          annualLeaveBalance: Number(form.annualLeaveBalance) || 21,
          sickLeaveBalance: Number(form.sickLeaveBalance) || 14,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.detail || t.common.error); return; }
      onSaved(await res.json());
    } catch { setError(t.common.error); }
    finally { setSaving(false); }
  }

  const SECTIONS = [
    { key: "personal" as const,     label: t.hr.personalInfo,     icon: "person" },
    { key: "employment" as const,   label: t.hr.employmentInfo,   icon: "work" },
    { key: "compensation" as const, label: t.hr.compensationInfo, icon: "payments" },
    { key: "roles" as const,        label: t.hr.rolesPermissions, icon: "admin_panel_settings" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
          <h2 className="text-lg font-bold text-[#1a1c1e]">{t.hr.editEmployee}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
            <span className="material-symbols-outlined text-[#74777f]">close</span>
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-[#e3e2e6] px-6 overflow-x-auto">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                section === s.key ? "border-[#1960a3] text-[#1960a3]" : "border-transparent text-[#74777f] hover:text-[#43474e]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{error}</div>}

          {section === "personal" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.common.name + " *"} full>
                <input className="input-field" value={form.userName} onChange={e => setF("userName", e.target.value)} />
              </Field>
              <Field label={t.hr.phone}>
                <input className="input-field" value={form.userPhone} onChange={e => setF("userPhone", e.target.value)} />
              </Field>
              <Field label={t.hr.email}>
                <input className="input-field bg-[#f4f3f7] text-[#74777f] cursor-not-allowed" value={(user.email as string) ?? ""} disabled readOnly />
              </Field>
            </div>
          )}

          {section === "employment" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.hr.deptTitle + " *"} full>
                <input className="input-field" value={form.jobTitle} onChange={e => setF("jobTitle", e.target.value)} />
              </Field>
              <Field label={t.hr.type}>
                <select className="input-field" value={form.employmentType} onChange={e => setF("employmentType", e.target.value)}>
                  <option value="FULL_TIME">{t.hr.fullTime}</option>
                  <option value="PART_TIME">{t.hr.partTime}</option>
                  <option value="CONTRACT">{t.hr.contract}</option>
                </select>
              </Field>
              <Field label={t.hr.status}>
                <select className="input-field" value={form.status} onChange={e => setF("status", e.target.value)}>
                  <option value="ACTIVE">{t.hr.activeStatus}</option>
                  <option value="ON_LEAVE">{t.hr.onLeaveStatus}</option>
                  <option value="INACTIVE">{t.hr.inactiveStatus}</option>
                  <option value="TERMINATED">{t.hr.terminated}</option>
                </select>
              </Field>
              <Field label={t.hr.department}>
                <select className="input-field" value={form.departmentId} onChange={e => setF("departmentId", e.target.value)}>
                  <option value="">{t.hr.allDepts}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label={t.hr.branch}>
                <select className="input-field" value={form.branchId} onChange={e => setF("branchId", e.target.value)}>
                  <option value="">{t.hr.allBranches}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label={t.hr.annualLeave}>
                <input type="number" className="input-field" value={form.annualLeaveBalance} onChange={e => setF("annualLeaveBalance", e.target.value)} min="0" />
              </Field>
              <Field label={t.hr.sickLeave}>
                <input type="number" className="input-field" value={form.sickLeaveBalance} onChange={e => setF("sickLeaveBalance", e.target.value)} min="0" />
              </Field>
            </div>
          )}

          {section === "compensation" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.hr.baseSalary}>
                <input type="number" className="input-field" value={form.basicSalary} onChange={e => setF("basicSalary", e.target.value)} min="0" step="0.01" />
              </Field>
              <Field label={t.hr.housingAllowance}>
                <input type="number" className="input-field" value={form.housingAllowance} onChange={e => setF("housingAllowance", e.target.value)} min="0" step="0.01" />
              </Field>
              <Field label={t.hr.transportAllowance}>
                <input type="number" className="input-field" value={form.transportAllowance} onChange={e => setF("transportAllowance", e.target.value)} min="0" step="0.01" />
              </Field>
              <Field label={t.hr.medicalAllowance}>
                <input type="number" className="input-field" value={form.medicalAllowance} onChange={e => setF("medicalAllowance", e.target.value)} min="0" step="0.01" />
              </Field>
              <div className="sm:col-span-2 bg-[#f4f3f7] rounded-lg p-4">
                <p className="text-xs text-[#74777f]">{t.hr.totalComp}</p>
                <p className="text-xl font-bold text-[#1a1c1e] mt-1">
                  {([form.basicSalary, form.housingAllowance, form.transportAllowance, form.medicalAllowance]
                    .reduce((s, v) => s + (Number(v) || 0), 0)).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {section === "roles" && (
            <div className="space-y-4">
              <p className="text-sm text-[#74777f]">{t.hr.rolesNote}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_ROLES.map(role => {
                  const active = form.userRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                        active
                          ? "border-[#1960a3] bg-[#d3e4ff] text-[#1960a3]"
                          : "border-[#e3e2e6] bg-white text-[#43474e] hover:border-[#1960a3]/40"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{active ? "check_circle" : "radio_button_unchecked"}</span>
                      {role}
                    </button>
                  );
                })}
              </div>
              {form.userRoles.length > 0 && (
                <div className="bg-[#f4f3f7] rounded-lg p-3">
                  <p className="text-xs text-[#74777f] mb-1.5">{t.hr.selectedRoles}: {form.userRoles.length}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.userRoles.map(r => (
                      <span key={r} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#002045] text-white">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.hr.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small components ─────────────────────────────────────────────────────────
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InfoItem({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider">{label}</p>
      {children ?? <p className="text-sm text-[#1a1c1e] mt-0.5">{value ?? "—"}</p>}
    </div>
  );
}

function CompRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? "font-bold text-[#1a1c1e]" : "text-[#43474e]"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-[#1a1c1e]" : "text-[#1a1c1e]"}`}>{value}</span>
    </div>
  );
}

function LeaveCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color.split(" ")[0]}`}>
      <p className={`text-3xl font-bold ${color.split(" ")[1]}`}>{value ?? 0}</p>
      <p className={`text-xs mt-1 ${color.split(" ")[1]} opacity-80`}>{label}</p>
    </div>
  );
}

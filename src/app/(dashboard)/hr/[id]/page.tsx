"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate, getInitials } from "@/lib/utils";
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

  const [emp, setEmp] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

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

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-[#ccfbf1] text-[#0d9488]",
    ON_LEAVE: "bg-[#fffbeb] text-[#d97706]",
    INACTIVE: "bg-[#f4f3f7] text-[#74777f]",
    TERMINATED: "bg-[#ffdad6] text-[#ba1a1a]",
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
            <InfoItem label={t.hr.type} value={emp.employmentType as string} />
            <InfoItem label={t.hr.status}>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[emp.status as string] ?? "bg-[#f4f3f7] text-[#74777f]"}`}>
                {emp.status as string}
              </span>
            </InfoItem>
            <InfoItem label={t.hr.phone} value={(user.phone as string) ?? "—"} />
            <InfoItem label={t.hr.email} value={(user.email as string) ?? "—"} />
            <InfoItem label={t.hr.branch} value={branches.find(b => b.id === (emp.branchId as string))?.name ?? "—"} />
            <InfoItem label={t.hr.department} value={dept.name as string ?? "—"} />
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

      {/* Edit Log */}
      <EditLog entityId={id as string} />

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

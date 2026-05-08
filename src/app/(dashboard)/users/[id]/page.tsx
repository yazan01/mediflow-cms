"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getInitials, formatDateTime } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { UserRole } from "@/types";

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = [
  "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "RECEPTIONIST", "NURSE",
  "ACCOUNTANT", "HR_OFFICER", "PHARMACIST", "LAB_TECHNICIAN", "RADIOLOGIST", "AUDITOR", "STAFF",
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:    "bg-[#002045] text-white",
  CLINIC_MANAGER: "bg-[#1a365d] text-white",
  DOCTOR:         "bg-[#1960a3] text-white",
  RECEPTIONIST:   "bg-[#d3e4ff] text-[#00477f]",
  NURSE:          "bg-[#ccfbf1] text-[#0d9488]",
  ACCOUNTANT:     "bg-[#ffddba] text-[#633f0f]",
  HR_OFFICER:     "bg-[#e9e7eb] text-[#43474e]",
  PHARMACIST:     "bg-[#dbeafe] text-[#1960a3]",
  LAB_TECHNICIAN: "bg-[#f0fdf4] text-[#16a34a]",
  RADIOLOGIST:    "bg-[#fdf4ff] text-[#9333ea]",
  AUDITOR:        "bg-[#f4f3f7] text-[#74777f]",
  STAFF:          "bg-[#f1f0f4] text-[#43474e]",
};

const ACTION_ICON: Record<string, string> = {
  CREATE: "add_circle", UPDATE: "edit", DELETE: "delete",
  LOGIN: "login", LOGOUT: "logout", VIEW: "visibility",
};
const ACTION_COLOR: Record<string, string> = {
  CREATE: "text-[#0d9488]", UPDATE: "text-[#1960a3]", DELETE: "text-[#ba1a1a]",
  LOGIN: "text-[#7c3aed]", LOGOUT: "text-[#74777f]", VIEW: "text-[#43474e]",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  roles: UserRole[];
  isActive: boolean;
  twoFAEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
  department?: { id: string; name: string } | null;
  employeeId?: string | null;
  hasEmployee?: boolean;
}

interface Dept { id: string; name: string; }
interface AuditEntry {
  id: string; action: string; module: string;
  entityType?: string; ipAddress?: string; timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoItem({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#74777f] uppercase tracking-wider mb-1">{label}</p>
      {children ?? <p className="text-sm text-[#1a1c1e]">{value ?? "—"}</p>}
    </div>
  );
}

function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 end-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${ok ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#ffdad6] text-[#ba1a1a]"}`}>
      <span className="material-symbols-outlined text-[18px]">{ok ? "check_circle" : "error"}</span>
      {msg}
      <button onClick={onClose}><span className="material-symbols-outlined text-[16px] opacity-60">close</span></button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Modal states
  const [editModal, setEditModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({ name: "", phone: "", departmentId: "", roles: [] as UserRole[] });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Password form
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwShow, setPwShow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [uRes, dRes] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetch("/api/hr/departments"),
      ]);
      if (!uRes.ok) throw new Error(uRes.status === 404 ? t.users.noUsers : "Failed to load user");
      const u = await uRes.json();
      setUser(u);
      setEditForm({ name: u.name, phone: u.phone ?? "", departmentId: u.department?.id ?? "", roles: u.roles });
      if (dRes.ok) setDepartments(await dRes.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id, t.users.noUsers]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/audit?userId=${id}&pageSize=25`);
      if (res.ok) { const d = await res.json(); setAudit(d.data ?? d ?? []); }
    } catch { /* ignore */ } finally { setAuditLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  async function toggleActive() {
    if (!user) return;
    setToggling(true);
    setConfirmToggle(false);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setToast({ msg: updated.isActive ? t.users.userActivatedMsg : t.users.userDeactivatedMsg, ok: true });
      } else {
        setToast({ msg: t.users.failedUpdateStatus, ok: false });
      }
    } finally { setToggling(false); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim()) { setEditError(t.users.fullName); return; }
    if (editForm.roles.length === 0) { setEditError(t.users.rolesLabel); return; }
    setEditSaving(true); setEditError("");
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone || undefined,
          departmentId: editForm.departmentId || undefined,
          roles: editForm.roles,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.detail ?? "Failed to save"); return; }
      setUser(data);
      setEditModal(false);
      setToast({ msg: t.users.userUpdatedMsg, ok: true });
    } catch { setEditError("An error occurred"); }
    finally { setEditSaving(false); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError(t.users.passwordLabel); return; }
    if (pwForm.newPassword.length < 8) { setPwError(t.users.passwordHint); return; }
    setPwSaving(true); setPwError("");
    try {
      const res = await fetch(`/api/users/${id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.detail ?? "Failed to reset password"); return; }
      setPwModal(false);
      setPwForm({ newPassword: "", confirmPassword: "" });
      setToast({ msg: t.users.passwordResetMsg, ok: true });
    } catch { setPwError("An error occurred"); }
    finally { setPwSaving(false); }
  }

  function toggleRole(r: UserRole) {
    setEditForm(f => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r],
    }));
  }

  const pwStrength = (() => {
    const p = pwForm.newPassword;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  })();

  const pwStrengthLabel = pwStrength <= 2 ? t.users.pwWeak : pwStrength <= 3 ? t.users.pwFair : pwStrength === 4 ? t.users.pwStrong : t.users.pwVeryStrong;
  const pwStrengthColor = pwStrength <= 2 ? "text-[#ba1a1a]" : pwStrength <= 3 ? "text-[#d97706]" : "text-[#0d9488]";
  const pwBarColor = pwStrength <= 2 ? "bg-[#ba1a1a]" : pwStrength <= 3 ? "bg-[#d97706]" : "bg-[#0d9488]";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
    </div>
  );

  if (error || !user) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">person_off</span>
      <p className="text-sm font-semibold text-[#1a1c1e]">{error || t.users.noUsers}</p>
      <button onClick={() => router.push("/users")} className="text-sm text-[#1960a3] hover:underline">
        {t.users.backToUsers}
      </button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/users")}
          className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors"
          aria-label={t.users.backToUsers}
        >
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#1a1c1e] truncate">{user.name}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditForm({ name: user.name, phone: user.phone ?? "", departmentId: user.department?.id ?? "", roles: user.roles }); setEditError(""); setEditModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#002045] text-white hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            {t.common.edit}
          </button>
          <button
            onClick={() => { setPwForm({ newPassword: "", confirmPassword: "" }); setPwError(""); setPwModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-[#1960a3] text-[#1960a3] hover:bg-[#d3e4ff] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
            {t.users.resetPassword}
          </button>
          <button
            onClick={() => setConfirmToggle(true)}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
              user.isActive ? "border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]" : "border-[#0d9488] text-[#0d9488] hover:bg-[#ccfbf1]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toggling ? "hourglass_empty" : user.isActive ? "person_off" : "person_check"}
            </span>
            {user.isActive ? t.users.deactivate : t.users.activate}
          </button>
        </div>
      </div>

      {/* ── Profile card ── */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {user.photo ? (
              <img src={user.photo} alt={user.name} className="w-24 h-24 rounded-2xl object-cover ring-4 ring-[#e3e2e6]" />
            ) : (
              <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold ${user.isActive ? "bg-[#002045] text-white" : "bg-[#94a3b8] text-white"}`}>
                {getInitials(user.name)}
              </div>
            )}
            <span className={`absolute -bottom-1.5 -end-1.5 w-5 h-5 rounded-full border-2 border-white ${user.isActive ? "bg-[#0d9488]" : "bg-[#94a3b8]"}`} />
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <InfoItem label={t.users.status}>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${user.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#e3e2e6] text-[#74777f]"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {user.isActive ? t.users.activeStatus : t.users.inactiveStatus}
              </span>
            </InfoItem>

            <InfoItem label={t.users.twoFactorAuthLabel}>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${user.twoFAEnabled ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                <span className="material-symbols-outlined text-[13px]">{user.twoFAEnabled ? "verified_user" : "security"}</span>
                {user.twoFAEnabled ? t.users.twoFAEnabled : t.users.twoFANotEnabled}
              </span>
            </InfoItem>

            <InfoItem label={t.users.department} value={user.department?.name ?? "—"} />
            <InfoItem label={t.users.phoneLabel} value={user.phone ?? "—"} />
            <InfoItem label={t.users.lastLogin} value={user.lastLogin ? formatDateTime(user.lastLogin) : t.users.neverLoggedIn} />
            <InfoItem label={t.users.memberSince} value={user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />

            <InfoItem label={t.users.employeeProfile}>
              {user.hasEmployee && user.employeeId ? (
                <Link href={`/hr/${user.employeeId}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d3e4ff] hover:bg-[#b8d4ff] text-[#1960a3] text-xs font-semibold transition-colors">
                  <span className="material-symbols-outlined text-[14px]">badge</span>
                  {t.users.viewUserProfile}
                  <span className="material-symbols-outlined text-[12px] opacity-60">open_in_new</span>
                </Link>
              ) : (
                <span className="text-sm text-[#74777f]">{t.users.noEmployeeRecord}</span>
              )}
            </InfoItem>

            <InfoItem label={t.users.accountId}>
              <p className="text-[11px] font-mono text-[#74777f] mt-0.5 select-all">{user.id}</p>
            </InfoItem>
          </div>
        </div>

        {/* Roles */}
        <div className="mt-6 pt-5 border-t border-[#e3e2e6]">
          <p className="text-[10px] font-semibold text-[#74777f] uppercase tracking-wider mb-3">{t.users.rolesAccess}</p>
          <div className="flex flex-wrap gap-2">
            {user.roles.length === 0 ? (
              <span className="text-sm text-[#74777f]">{t.users.noRolesAssigned}</span>
            ) : user.roles.map(r => (
              <span key={r} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${ROLE_COLORS[r] ?? "bg-[#e9e7eb] text-[#43474e]"}`}>
                {r.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Account Settings card ── */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1960a3] text-[18px]">manage_accounts</span>
          {t.users.accountSettingsTitle}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Password */}
          <div className="flex items-center gap-4 p-4 bg-[#f8f7fb] rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-[#d3e4ff] flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[#1960a3] text-[20px]">lock</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#1a1c1e]">{t.users.passwordLabel}</p>
              <p className="text-xs text-[#74777f]">{t.users.encryptedBcrypt}</p>
            </div>
            <button
              onClick={() => { setPwForm({ newPassword: "", confirmPassword: "" }); setPwError(""); setPwModal(true); }}
              className="text-xs font-semibold text-[#1960a3] hover:underline whitespace-nowrap"
            >
              {t.users.resetBtn}
            </button>
          </div>

          {/* 2FA */}
          <div className="flex items-center gap-4 p-4 bg-[#f8f7fb] rounded-xl">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${user.twoFAEnabled ? "bg-[#ccfbf1]" : "bg-[#f4f3f7]"}`}>
              <span className={`material-symbols-outlined text-[20px] ${user.twoFAEnabled ? "text-[#0d9488]" : "text-[#74777f]"}`}>verified_user</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a1c1e]">{t.users.twoFactorAuthLabel}</p>
              <p className={`text-xs font-semibold ${user.twoFAEnabled ? "text-[#0d9488]" : "text-[#74777f]"}`}>
                {user.twoFAEnabled ? t.users.twoFAEnabled : t.users.twoFANotEnabled}
              </p>
            </div>
          </div>

          {/* Account status */}
          <div className="flex items-center gap-4 p-4 bg-[#f8f7fb] rounded-xl">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${user.isActive ? "bg-[#ccfbf1]" : "bg-[#ffdad6]"}`}>
              <span className={`material-symbols-outlined text-[20px] ${user.isActive ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>
                {user.isActive ? "person_check" : "person_off"}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#1a1c1e]">{t.users.accountAccess}</p>
              <p className={`text-xs font-semibold ${user.isActive ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>
                {user.isActive ? t.users.fullAccess : t.users.suspended}
              </p>
            </div>
            <button
              onClick={() => setConfirmToggle(true)}
              className={`text-xs font-semibold hover:underline whitespace-nowrap ${user.isActive ? "text-[#ba1a1a]" : "text-[#0d9488]"}`}
            >
              {user.isActive ? t.users.suspendBtn : t.users.enableBtn}
            </button>
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1960a3] text-[18px]">history</span>
          {t.users.recentActivity}
        </h3>
        {auditLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
          </div>
        ) : audit.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <span className="material-symbols-outlined text-[#c4c6cf] text-3xl">history_toggle_off</span>
            <p className="text-sm text-[#74777f]">{t.users.noActivityYet}</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute start-[19px] top-3 bottom-3 w-px bg-[#e3e2e6]" />
            <div className="space-y-0.5">
              {audit.map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 ps-1 py-2.5 hover:bg-[#f8f7fb] rounded-lg transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#f4f3f7] border border-[#e3e2e6] flex items-center justify-center flex-shrink-0 z-10">
                    <span className={`material-symbols-outlined text-[16px] ${ACTION_COLOR[entry.action] ?? "text-[#43474e]"}`}>
                      {ACTION_ICON[entry.action] ?? "info"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#1a1c1e]">{entry.action}</span>
                      <span className="text-xs text-[#74777f]">{entry.module}</span>
                      {entry.entityType && entry.entityType !== entry.module && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f4f3f7] text-[#74777f]">{entry.entityType}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-[#74777f]">{formatDateTime(entry.timestamp)}</p>
                      {entry.ipAddress && <span className="text-[10px] text-[#c4c6cf]">· {entry.ipAddress}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
              <h2 id="edit-user-title" className="text-base font-bold text-[#1a1c1e]">{t.users.editUserTitle}</h2>
              <button onClick={() => setEditModal(false)} className="p-2 hover:bg-[#f4f3f7] rounded-lg" aria-label={t.common.close}>
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <form onSubmit={saveEdit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {editError && (
                <div className="flex items-center gap-2 bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">
                  <span className="material-symbols-outlined text-[16px]">error</span>{editError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.users.fullName}</label>
                  <input className="input-field" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.users.phoneLabel}</label>
                  <input className="input-field" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+962..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.users.department}</label>
                  <select className="input-field" value={editForm.departmentId} onChange={e => setEditForm(f => ({ ...f, departmentId: e.target.value }))}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{t.users.emailLabel}</label>
                <input className="input-field bg-[#f4f3f7] text-[#74777f] cursor-not-allowed" value={user.email} disabled readOnly />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{t.users.rolesLabel}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_ROLES.map(role => {
                    const active = editForm.roles.includes(role);
                    return (
                      <button key={role} type="button" onClick={() => toggleRole(role)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                          active ? "border-[#1960a3] bg-[#d3e4ff] text-[#1960a3]" : "border-[#e3e2e6] bg-white text-[#43474e] hover:border-[#1960a3]/40"
                        }`}>
                        <span className="material-symbols-outlined text-[13px]">{active ? "check_circle" : "radio_button_unchecked"}</span>
                        {role.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
                {editForm.roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {editForm.roles.map(r => (
                      <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? "bg-[#e9e7eb] text-[#43474e]"}`}>{r}</span>
                    ))}
                  </div>
                )}
              </div>
            </form>
            <div className="flex gap-3 px-6 py-4 border-t border-[#e3e2e6]">
              <button type="button" onClick={() => setEditModal(false)} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">{t.users.cancel}</button>
              <button onClick={saveEdit} disabled={editSaving || editForm.roles.length === 0} className="flex-1 bg-[#002045] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {editSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[16px]">save</span>}
                {t.users.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {pwModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="pw-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPwModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
              <div>
                <h2 id="pw-modal-title" className="text-base font-bold text-[#1a1c1e]">{t.users.resetPassword}</h2>
                <p className="text-xs text-[#74777f] mt-0.5"><span className="font-semibold">{user.name}</span></p>
              </div>
              <button onClick={() => setPwModal(false)} className="p-2 hover:bg-[#f4f3f7] rounded-lg" aria-label={t.common.close}>
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <form onSubmit={savePassword} className="p-6 space-y-4">
              {pwError && (
                <div className="flex items-center gap-2 bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">
                  <span className="material-symbols-outlined text-[16px]">error</span>{pwError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.users.newPasswordLabel} *</label>
                <div className="relative">
                  <input
                    type={pwShow ? "text" : "password"}
                    className="input-field pe-10"
                    placeholder={t.users.passwordPlaceholder}
                    value={pwForm.newPassword}
                    onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                    required
                  />
                  <button type="button" onClick={() => setPwShow(s => !s)} className="absolute end-3 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#1a1c1e]" aria-label="toggle password">
                    <span className="material-symbols-outlined text-[18px]">{pwShow ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                {pwForm.newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= pwStrength ? pwBarColor : "bg-[#e3e2e6]"}`} />
                      ))}
                    </div>
                    <p className={`text-[11px] mt-1 ${pwStrengthColor}`}>{pwStrengthLabel}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.users.confirmPasswordLabel} *</label>
                <div className="relative">
                  <input
                    type={pwShow ? "text" : "password"}
                    className={`input-field pe-10 ${pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? "ring-2 ring-[#ba1a1a]/40 border-[#ba1a1a]" : ""}`}
                    placeholder={t.users.repeatPassword}
                    value={pwForm.confirmPassword}
                    onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    required
                  />
                  {pwForm.confirmPassword && (
                    <span className={`absolute end-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] ${pwForm.newPassword === pwForm.confirmPassword ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>
                      {pwForm.newPassword === pwForm.confirmPassword ? "check_circle" : "cancel"}
                    </span>
                  )}
                </div>
              </div>
              {/* Requirements checklist */}
              <div className="bg-[#f8f7fb] rounded-xl p-3 space-y-1.5">
                {[
                  { label: t.users.reqMinChars,   ok: pwForm.newPassword.length >= 8 },
                  { label: t.users.reqUppercase,  ok: /[A-Z]/.test(pwForm.newPassword) },
                  { label: t.users.reqLowercase,  ok: /[a-z]/.test(pwForm.newPassword) },
                  { label: t.users.reqDigit,      ok: /\d/.test(pwForm.newPassword) },
                ].map(req => (
                  <div key={req.label} className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[14px] ${req.ok ? "text-[#0d9488]" : "text-[#c4c6cf]"}`}>{req.ok ? "check_circle" : "radio_button_unchecked"}</span>
                    <span className={`text-xs ${req.ok ? "text-[#0d9488]" : "text-[#74777f]"}`}>{req.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPwModal(false)} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">{t.users.cancel}</button>
                <button type="submit" disabled={pwSaving || pwStrength < 3 || pwForm.newPassword !== pwForm.confirmPassword}
                  className="flex-1 bg-[#1960a3] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {pwSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[16px]">lock_reset</span>}
                  {t.users.resetPassword}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Toggle ── */}
      {confirmToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-3xl ${user.isActive ? "text-[#ba1a1a]" : "text-[#0d9488]"}`}>
                {user.isActive ? "person_off" : "person_check"}
              </span>
              <div>
                <p className="font-semibold text-[#1a1c1e]">{user.isActive ? t.users.deactivateUserConfirm : t.users.activateUserConfirm}</p>
                <p className="text-sm text-[#74777f]">{user.name}</p>
              </div>
            </div>
            <p className="text-sm text-[#74777f]">
              {user.isActive ? t.users.userLoseAccess : t.users.userRegainAccess}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmToggle(false)} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">{t.users.cancel}</button>
              <button onClick={toggleActive} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white ${user.isActive ? "bg-[#ba1a1a]" : "bg-[#0d9488]"} hover:opacity-90`}>
                {user.isActive ? t.users.deactivate : t.users.activate}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  );
}

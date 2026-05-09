"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { User, UserRole } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { apiFetch } from "@/lib/hooks/useDataFetch";

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 end-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${type === "success" ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--err-bg)] text-[var(--err)]"}`}>
      <span className="material-symbols-outlined text-[18px]">{type === "success" ? "check_circle" : "error"}</span>
      {message}
      <button onClick={onClose} className="ms-1 opacity-70 hover:opacity-100"><span className="material-symbols-outlined text-[16px]">close</span></button>
    </div>
  );
}

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN:    "bg-[var(--brand)] text-white",
  CLINIC_MANAGER: "bg-[#1a365d] text-white",
  DOCTOR:         "bg-[var(--blue)] text-white",
  RECEPTIONIST:   "bg-[var(--blue-bg)] text-[#00477f]",
  NURSE:          "bg-[var(--ok-bg)] text-[var(--ok)]",
  ACCOUNTANT:     "bg-[#ffddba] text-[#633f0f]",
  HR_OFFICER:     "bg-[#e9e7eb] text-[var(--txt2)]",
  PHARMACIST:     "bg-[var(--blue-bg)] text-[var(--blue)]",
  LAB_TECHNICIAN: "bg-[#f0fdf4] text-[#16a34a]",
  RADIOLOGIST:    "bg-[#fdf4ff] text-[#9333ea]",
  AUDITOR:        "bg-[var(--surface2)] text-[var(--txt2)]",
  STAFF:          "bg-[#f1f0f4] text-[var(--txt2)]",
};

const SYSTEM_ROLE_KEYS: UserRole[] = [
  "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "RECEPTIONIST", "NURSE",
  "ACCOUNTANT", "HR_OFFICER", "PHARMACIST", "LAB_TECHNICIAN", "RADIOLOGIST", "AUDITOR", "STAFF",
];

type RolePermissionMatrix = Record<string, Record<string, boolean>>;

export default function UsersPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const ROLE_LABELS: Record<UserRole, string> = {
    SUPER_ADMIN:    t.users.superAdmin,
    CLINIC_MANAGER: t.users.clinicManager,
    DOCTOR:         t.users.doctor,
    RECEPTIONIST:   t.users.receptionist,
    NURSE:          t.users.nurse,
    ACCOUNTANT:     t.users.accountant,
    HR_OFFICER:     t.users.hrOfficer,
    PHARMACIST:     t.users.pharmacist,
    LAB_TECHNICIAN: t.users.labTech,
    RADIOLOGIST:    t.users.radiologist,
    AUDITOR:        t.users.auditor,
    STAFF:          t.users.staff,
  };

  const MODULES = [
    t.users.patientsModule, t.users.appointmentsModule, t.users.emrModule,
    t.users.billingModule, t.users.pharmacyModule, t.users.hrModule,
    t.users.accountingModule, t.users.reportsModule, t.users.usersModule,
  ];

  const PERMISSIONS = [
    t.users.permView, t.users.permCreate, t.users.permEdit,
    t.users.permDelete, t.users.permExport, t.users.permApprove,
  ];

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionMatrix>({});
  const [showAddUser, setShowAddUser] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  const pageSize = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(roleFilter !== "ALL" && { role: roleFilter }),
      });
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      const data = await res.json();
      setUsers(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setFetchError(err as Error);
    } finally { setLoading(false); }
  }, [page, debouncedSearch, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handlePermissionToggle(module: string, permission: string) {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...(prev[module] ?? {}),
        [permission]: !(prev[module]?.[permission] ?? false),
      },
    }));
  }

  async function confirmAndToggle() {
    if (!confirmToggle) return;
    setTogglingId(confirmToggle.id);
    setConfirmToggle(null);
    try {
      await apiFetch(`/api/users/${confirmToggle.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !confirmToggle.isActive }),
      });
      fetchUsers();
    } finally {
      setTogglingId(null);
    }
  }

  async function resetPassword(id: string) {
    try {
      await apiFetch(`/api/users/${id}/reset-password`, { method: "POST" });
      setToast({ message: t.users.passwordResetSent, type: "success" });
    } catch {
      setToast({ message: t.users.passwordResetFailed, type: "error" });
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--txt1)]">{t.users.title}</h1>
          <p className="text-sm text-[var(--txt2)] mt-0.5">{t.users.showing} {total} {t.users.usersLabel}</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t.users.addUser}
        </button>
      </div>

      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchUsers} />}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--surface2)] rounded-xl w-fit">
        {[
          { key: "users", label: t.users.usersTab, icon: "people" },
          { key: "roles", label: t.users.rolesPermissions, icon: "admin_panel_settings" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "users" | "roles")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key ? "bg-white text-[var(--blue)] shadow-sm" : "text-[var(--txt2)] hover:text-[var(--txt1)]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--txt2)] text-[18px]">search</span>
              <input
                className="w-full bg-[var(--surface2)] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder={t.users.searchPlaceholder}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="border border-[var(--border2)] bg-[var(--surface)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">{t.users.allRoles}</option>
              {SYSTEM_ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[t.users.user, t.users.emailPhone, t.users.roles, t.users.department, t.users.status, t.users.lastLogin, t.users.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-5 py-3.5 bg-[var(--surface2)] border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                        <p className="text-sm text-[var(--txt2)]">{t.users.loading}</p>
                      </div>
                    </td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                          <span className="material-symbols-outlined text-[var(--txt2)] text-2xl">manage_accounts</span>
                        </div>
                        <p className="text-sm font-semibold text-[var(--txt1)]">{t.users.noUsers}</p>
                        <button onClick={() => setShowAddUser(true)} className="text-sm text-[var(--blue)] font-semibold hover:underline">{t.users.addFirstUser}</button>
                      </div>
                    </td></tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-[var(--surface2)] transition-colors group">
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <button
                            onClick={() => router.push(`/users/${user.id}`)}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-start"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[var(--txt1)] group-hover:text-[var(--blue)] transition-colors">{user.name}</p>
                              {user.hasEmployee && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--blue)] bg-[var(--blue-bg)] px-1.5 py-0.5 rounded-full mt-0.5">
                                  <span className="material-symbols-outlined text-[10px]">badge</span>
                                  {t.common.employeeSingular}
                                </span>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <p className="text-sm text-[var(--txt1)]">{user.email}</p>
                          {user.phone && <p className="text-xs text-[var(--txt2)]">{user.phone}</p>}
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((r) => (
                              <span key={r} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? "bg-[#e9e7eb] text-[var(--txt2)]"}`}>
                                {ROLE_LABELS[r] ?? r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <p className="text-sm text-[var(--txt2)]">{user.department?.name ?? "—"}</p>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.isActive ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[#e3e2e6] text-[var(--txt2)]"}`}>
                            {user.isActive ? t.users.activeStatus : t.users.inactiveStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <p className="text-xs text-[var(--txt2)]">{user.lastLogin ? formatDateTime(user.lastLogin) : t.users.neverLoggedIn}</p>
                        </td>
                        <td className="px-5 py-4 border-b border-[var(--border)]">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setConfirmToggle({ id: user.id, name: user.name, isActive: user.isActive })}
                              disabled={togglingId === user.id}
                              title={user.isActive ? t.users.deactivate : t.users.activate}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${user.isActive ? "hover:bg-[var(--err-bg)] text-[var(--txt2)] hover:text-[var(--err)]" : "hover:bg-[var(--ok-bg)] text-[var(--txt2)] hover:text-[var(--ok)]"}`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {togglingId === user.id ? "hourglass_empty" : user.isActive ? "person_off" : "person_check"}
                              </span>
                            </button>
                            <button onClick={() => resetPassword(user.id)} title={t.users.resetPassword} className="p-1.5 hover:bg-[var(--blue-bg)] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--blue)]">
                              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                            </button>
                            <button title={t.users.viewAudit} className="p-1.5 hover:bg-[var(--blue-bg)] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--blue)]">
                              <span className="material-symbols-outlined text-[18px]">history</span>
                            </button>
                            {user.hasEmployee && user.employeeId && (
                              <a
                                href={`/hr/${user.employeeId}`}
                                title={t.users.viewEmployeeProfile}
                                className="p-1.5 hover:bg-[#e9fdf4] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--ok)]"
                              >
                                <span className="material-symbols-outlined text-[18px]">badge</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
                <p className="text-xs text-[var(--txt2)]">{t.users.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} {t.common.of} {total}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[var(--border2)] hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roles & Permissions Tab */}
      {activeTab === "roles" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Role list */}
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--txt1)]">{t.users.systemRoles}</h3>
            </div>
            <div className="divide-y divide-[#e3e2e6]">
              {SYSTEM_ROLE_KEYS.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--surface2)] ${selectedRole === role ? "bg-[var(--blue-bg)]/30 border-l-4 border-l-[#1960a3]" : ""}`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${selectedRole === role ? "text-[var(--blue)]" : "text-[var(--txt1)]"}`}>{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-[var(--txt2)]">{t.users.systemRole}</p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[var(--txt2)]">chevron_right</span>
                </button>
              ))}
            </div>
          </div>

          {/* Permissions matrix */}
          <div className="lg:col-span-2 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--txt1)]">
                {selectedRole ? `${t.users.permissionsTitle}${ROLE_LABELS[selectedRole]}` : t.users.selectRole}
              </h3>
              {selectedRole && (
                <button className="flex items-center gap-1 text-xs text-[var(--blue)] font-semibold border border-[var(--border2)] px-3 py-1.5 rounded-lg hover:bg-[var(--surface2)]">
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  {t.users.saveChanges}
                </button>
              )}
            </div>
            {selectedRole ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-4 py-3 bg-[var(--surface2)] border-b border-[var(--border)]">{t.common.type}</th>
                      {PERMISSIONS.map((p) => (
                        <th key={p} className="text-center text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider px-3 py-3 bg-[var(--surface2)] border-b border-[var(--border)]">{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod) => (
                      <tr key={mod} className="hover:bg-[var(--surface2)] transition-colors">
                        <td className="px-4 py-3 border-b border-[var(--border)] text-sm font-medium text-[var(--txt1)]">{mod}</td>
                        {PERMISSIONS.map((perm) => (
                          <td key={perm} className="px-3 py-3 border-b border-[var(--border)] text-center">
                            <input
                              type="checkbox"
                              checked={selectedRole === "SUPER_ADMIN" ? true : (permissions[mod]?.[perm] ?? false)}
                              disabled={selectedRole === "SUPER_ADMIN"}
                              onChange={() => handlePermissionToggle(mod, perm)}
                              className="w-4 h-4 rounded border-[var(--border2)] text-[var(--blue)] focus:ring-[#1960a3] cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">admin_panel_settings</span>
                <p className="text-sm text-[var(--txt2)]">{t.users.selectRole}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} onSaved={() => { setShowAddUser(false); fetchUsers(); }} />}

      {/* Confirm Toggle Status Modal */}
      {confirmToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-[var(--sh-xl)] w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-3xl ${confirmToggle.isActive ? "text-[var(--err)]" : "text-[var(--ok)]"}`}>
                {confirmToggle.isActive ? "person_off" : "person_check"}
              </span>
              <div>
                <p className="font-semibold text-[var(--txt1)]">
                  {confirmToggle.isActive ? t.users.deactivate : t.users.activate} {t.users.usersLabel}?
                </p>
                <p className="text-sm text-[var(--txt2)]">{confirmToggle.name}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--txt2)]">
              {confirmToggle.isActive ? t.users.userLoseAccess : t.users.userRegainAccess}
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmToggle(null)} className="flex-1 border border-[var(--border2)] bg-[var(--surface)] py-2.5 rounded-lg text-sm font-semibold hover:bg-[var(--surface2)]">
                {t.common.cancel}
              </button>
              <button
                onClick={confirmAndToggle}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white ${confirmToggle.isActive ? "bg-[var(--err)] hover:opacity-90" : "bg-[var(--ok)] hover:opacity-90"}`}
              >
                {confirmToggle.isActive ? t.users.deactivate : t.users.activate}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();

  const ROLE_LABELS: Record<UserRole, string> = {
    SUPER_ADMIN:    t.users.superAdmin,
    CLINIC_MANAGER: t.users.clinicManager,
    DOCTOR:         t.users.doctor,
    RECEPTIONIST:   t.users.receptionist,
    NURSE:          t.users.nurse,
    ACCOUNTANT:     t.users.accountant,
    HR_OFFICER:     t.users.hrOfficer,
    PHARMACIST:     t.users.pharmacist,
    LAB_TECHNICIAN: t.users.labTech,
    RADIOLOGIST:    t.users.radiologist,
    AUDITOR:        t.users.auditor,
    STAFF:          t.users.staff,
  };

  const SYSTEM_ROLE_KEYS: UserRole[] = [
    "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "RECEPTIONIST", "NURSE",
    "ACCOUNTANT", "HR_OFFICER", "PHARMACIST", "LAB_TECHNICIAN", "RADIOLOGIST", "AUDITOR", "STAFF",
  ];

  const [form, setForm] = useState({ name: "", email: "", phone: "", roles: [] as UserRole[], password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/users", { method: "POST", body: JSON.stringify(form) });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  function toggleRole(role: UserRole) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-[var(--sh-xl)] p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--txt1)]">{t.users.addUserTitle}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--surface2)] rounded-lg"><span className="material-symbols-outlined text-[20px] text-[var(--txt2)]">close</span></button>
        </div>
        {error && <div className="flex items-center gap-2 p-3 bg-[var(--err-bg)] border border-[var(--err)]/20 rounded-lg mb-4"><span className="material-symbols-outlined text-[var(--err)] text-[18px]">error</span><p className="text-sm text-[#93000a]">{error}</p></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t.users.fullName}><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field" placeholder={t.users.fullNamePlaceholder} /></Field>
          <Field label={t.users.emailLabel}><input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-field" placeholder={t.users.emailPlaceholder} /></Field>
          <Field label={t.users.phoneLabel}><input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" placeholder={t.users.phonePlaceholder} /></Field>
          <Field label={t.users.passwordLabel}>
            <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input-field" placeholder={t.users.passwordHint} minLength={8} />
          </Field>
          <div>
            <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-2">{t.users.rolesLabel}</label>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_ROLE_KEYS.map((role) => (
                <button key={role} type="button" onClick={() => toggleRole(role)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${form.roles.includes(role) ? "bg-[var(--brand)] text-white border-[#002045]" : "bg-white text-[var(--txt2)] border-[var(--border2)] hover:border-[#1960a3]"}`}>
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[var(--border2)] bg-[var(--surface)] py-2.5 rounded-lg text-sm font-semibold hover:bg-[var(--surface2)]">{t.users.cancel}</button>
            <button type="submit" disabled={loading || form.roles.length === 0} className="flex-1 bg-[var(--brand)] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
              {t.users.createUser}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

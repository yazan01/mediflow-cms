"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { User, UserRole } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useDebounce } from "@/lib/hooks/useDebounce";

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 end-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${type === "success" ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#ffdad6] text-[#ba1a1a]"}`}>
      <span className="material-symbols-outlined text-[18px]">{type === "success" ? "check_circle" : "error"}</span>
      {message}
      <button onClick={onClose} className="ms-1 opacity-70 hover:opacity-100"><span className="material-symbols-outlined text-[16px]">close</span></button>
    </div>
  );
}

const ROLE_COLORS: Record<UserRole, string> = {
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
      await fetch(`/api/users/${confirmToggle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !confirmToggle.isActive }),
      });
      fetchUsers();
    } finally {
      setTogglingId(null);
    }
  }

  async function resetPassword(id: string) {
    const res = await fetch(`/api/users/${id}/reset-password`, { method: "POST" });
    setToast(res.ok
      ? { message: t.users.passwordResetSent, type: "success" }
      : { message: t.users.passwordResetFailed, type: "error" }
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.users.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.users.showing} {total} {t.users.usersLabel}</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t.users.addUser}
        </button>
      </div>

      {fetchError && <ErrorBanner error={fetchError} onRetry={fetchUsers} />}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#f4f3f7] rounded-xl w-fit">
        {[
          { key: "users", label: t.users.usersTab, icon: "people" },
          { key: "roles", label: t.users.rolesPermissions, icon: "admin_panel_settings" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "users" | "roles")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key ? "bg-white text-[#1960a3] shadow-sm" : "text-[#74777f] hover:text-[#1a1c1e]"
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
          <div className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder={t.users.searchPlaceholder}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">{t.users.allRoles}</option>
              {SYSTEM_ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[t.users.user, t.users.emailPhone, t.users.roles, t.users.department, t.users.status, t.users.lastLogin, t.users.actions].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                        <p className="text-sm text-[#74777f]">{t.users.loading}</p>
                      </div>
                    </td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                          <span className="material-symbols-outlined text-[#74777f] text-2xl">manage_accounts</span>
                        </div>
                        <p className="text-sm font-semibold text-[#1a1c1e]">{t.users.noUsers}</p>
                        <button onClick={() => setShowAddUser(true)} className="text-sm text-[#1960a3] font-semibold hover:underline">{t.users.addFirstUser}</button>
                      </div>
                    </td></tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-[#f4f3f7] transition-colors group">
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <button
                            onClick={() => router.push(`/users/${user.id}`)}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-start"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors">{user.name}</p>
                              {user.hasEmployee && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#1960a3] bg-[#d3e4ff] px-1.5 py-0.5 rounded-full mt-0.5">
                                  <span className="material-symbols-outlined text-[10px]">badge</span>
                                  Employee
                                </span>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <p className="text-sm text-[#1a1c1e]">{user.email}</p>
                          {user.phone && <p className="text-xs text-[#74777f]">{user.phone}</p>}
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((r) => (
                              <span key={r} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? "bg-[#e9e7eb] text-[#43474e]"}`}>
                                {ROLE_LABELS[r] ?? r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <p className="text-sm text-[#43474e]">{user.department?.name ?? "—"}</p>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#e3e2e6] text-[#74777f]"}`}>
                            {user.isActive ? t.users.activeStatus : t.users.inactiveStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <p className="text-xs text-[#74777f]">{user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}</p>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setConfirmToggle({ id: user.id, name: user.name, isActive: user.isActive })}
                              disabled={togglingId === user.id}
                              title={user.isActive ? t.users.deactivate : t.users.activate}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${user.isActive ? "hover:bg-[#ffdad6] text-[#74777f] hover:text-[#ba1a1a]" : "hover:bg-[#ccfbf1] text-[#74777f] hover:text-[#0d9488]"}`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {togglingId === user.id ? "hourglass_empty" : user.isActive ? "person_off" : "person_check"}
                              </span>
                            </button>
                            <button onClick={() => resetPassword(user.id)} title={t.users.resetPassword} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]">
                              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                            </button>
                            <button title={t.users.viewAudit} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]">
                              <span className="material-symbols-outlined text-[18px]">history</span>
                            </button>
                            {user.hasEmployee && user.employeeId && (
                              <a
                                href={`/hr/${user.employeeId}`}
                                title="View Employee Profile"
                                className="p-1.5 hover:bg-[#e9fdf4] rounded-lg transition-colors text-[#74777f] hover:text-[#0d9488]"
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
              <div className="flex items-center justify-between px-5 py-4 border-t border-[#e3e2e6] bg-[#faf9fd]">
                <p className="text-xs text-[#74777f]">{t.users.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} {t.common.of} {total}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[#c4c6cf] hover:bg-[#f4f3f7] disabled:opacity-40 disabled:cursor-not-allowed">
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
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 border-b border-[#e3e2e6]">
              <h3 className="text-sm font-semibold text-[#1a1c1e]">{t.users.systemRoles}</h3>
            </div>
            <div className="divide-y divide-[#e3e2e6]">
              {SYSTEM_ROLE_KEYS.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#f4f3f7] ${selectedRole === role ? "bg-[#d3e4ff]/30 border-l-4 border-l-[#1960a3]" : ""}`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${selectedRole === role ? "text-[#1960a3]" : "text-[#1a1c1e]"}`}>{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-[#74777f]">{t.users.systemRole}</p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[#74777f]">chevron_right</span>
                </button>
              ))}
            </div>
          </div>

          {/* Permissions matrix */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 border-b border-[#e3e2e6] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1a1c1e]">
                {selectedRole ? `${t.users.permissionsTitle}${ROLE_LABELS[selectedRole]}` : t.users.selectRole}
              </h3>
              {selectedRole && (
                <button className="flex items-center gap-1 text-xs text-[#1960a3] font-semibold border border-[#c4c6cf] px-3 py-1.5 rounded-lg hover:bg-[#f4f3f7]">
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
                      <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-4 py-3 bg-[#f4f3f7] border-b border-[#e3e2e6]">{t.common.type}</th>
                      {PERMISSIONS.map((p) => (
                        <th key={p} className="text-center text-xs font-semibold text-[#43474e] uppercase tracking-wider px-3 py-3 bg-[#f4f3f7] border-b border-[#e3e2e6]">{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod) => (
                      <tr key={mod} className="hover:bg-[#f4f3f7] transition-colors">
                        <td className="px-4 py-3 border-b border-[#e3e2e6] text-sm font-medium text-[#1a1c1e]">{mod}</td>
                        {PERMISSIONS.map((perm) => (
                          <td key={perm} className="px-3 py-3 border-b border-[#e3e2e6] text-center">
                            <input
                              type="checkbox"
                              checked={selectedRole === "SUPER_ADMIN" ? true : (permissions[mod]?.[perm] ?? false)}
                              disabled={selectedRole === "SUPER_ADMIN"}
                              onChange={() => handlePermissionToggle(mod, perm)}
                              className="w-4 h-4 rounded border-[#c4c6cf] text-[#1960a3] focus:ring-[#1960a3] cursor-pointer disabled:cursor-not-allowed"
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
                <p className="text-sm text-[#74777f]">{t.users.selectRole}</p>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-3xl ${confirmToggle.isActive ? "text-[#ba1a1a]" : "text-[#0d9488]"}`}>
                {confirmToggle.isActive ? "person_off" : "person_check"}
              </span>
              <div>
                <p className="font-semibold text-[#1a1c1e]">
                  {confirmToggle.isActive ? t.users.deactivate : t.users.activate} {t.users.usersLabel}?
                </p>
                <p className="text-sm text-[#74777f]">{confirmToggle.name}</p>
              </div>
            </div>
            <p className="text-sm text-[#74777f]">
              {confirmToggle.isActive
                ? "This user will lose all access immediately. You can reactivate them later."
                : "This user will regain access to the system."}
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmToggle(null)} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">
                Cancel
              </button>
              <button
                onClick={confirmAndToggle}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white ${confirmToggle.isActive ? "bg-[#ba1a1a] hover:opacity-90" : "bg-[#0d9488] hover:opacity-90"}`}
              >
                {confirmToggle.isActive ? "Deactivate" : "Activate"}
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
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
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
      <div className="bg-white rounded-2xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#1a1c1e]">{t.users.addUserTitle}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg"><span className="material-symbols-outlined text-[20px] text-[#74777f]">close</span></button>
        </div>
        {error && <div className="flex items-center gap-2 p-3 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-lg mb-4"><span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">error</span><p className="text-sm text-[#93000a]">{error}</p></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t.users.fullName}><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field" placeholder={t.users.fullNamePlaceholder} /></Field>
          <Field label={t.users.emailLabel}><input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-field" placeholder={t.users.emailPlaceholder} /></Field>
          <Field label={t.users.phoneLabel}><input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" placeholder={t.users.phonePlaceholder} /></Field>
          <Field label={t.users.passwordLabel}>
            <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input-field" placeholder={t.users.passwordHint} minLength={8} />
          </Field>
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{t.users.rolesLabel}</label>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_ROLE_KEYS.map((role) => (
                <button key={role} type="button" onClick={() => toggleRole(role)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${form.roles.includes(role) ? "bg-[#002045] text-white border-[#002045]" : "bg-white text-[#43474e] border-[#c4c6cf] hover:border-[#1960a3]"}`}>
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">{t.users.cancel}</button>
            <button type="submit" disabled={loading || form.roles.length === 0} className="flex-1 bg-[#002045] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
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
      <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

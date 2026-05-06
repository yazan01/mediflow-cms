"use client";

import { useState, useEffect, useCallback } from "react";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { User, UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN:    "Super Admin",
  CLINIC_MANAGER: "Clinic Manager",
  DOCTOR:         "Doctor",
  RECEPTIONIST:   "Receptionist",
  NURSE:          "Nurse",
  ACCOUNTANT:     "Accountant",
  HR_OFFICER:     "HR Officer",
  PHARMACIST:     "Pharmacist",
  LAB_TECHNICIAN: "Lab Technician",
  RADIOLOGIST:    "Radiologist",
  AUDITOR:        "Auditor",
};

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
};

const MODULES = ["Patients", "Appointments", "EMR", "Billing", "Pharmacy", "HR", "Accounting", "Reports", "Users"];
const PERMISSIONS = ["View", "Create", "Edit", "Delete", "Export", "Approve"];

const SYSTEM_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

type RolePermissionMatrix = Record<string, Record<string, boolean>>;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionMatrix>({});
  const [showAddUser, setShowAddUser] = useState(false);

  const pageSize = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search && { search }),
        ...(roleFilter !== "ALL" && { role: roleFilter }),
      });
      const res = await fetch(`/api/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch { /* network */ }
    finally { setLoading(false); }
  }, [page, search, roleFilter]);

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

  async function toggleUserStatus(id: string, isActive: boolean) {
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
    fetchUsers();
  }

  async function resetPassword(id: string) {
    const res = await fetch(`/api/users/${id}/reset-password`, { method: "POST" });
    if (res.ok) alert("Password reset email sent.");
    else alert("Failed to reset password.");
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">User Management & RBAC</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{total} users registered</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Add User
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#f4f3f7] rounded-xl w-fit">
        {[
          { key: "users", label: "Users", icon: "people" },
          { key: "roles", label: "Roles & Permissions", icon: "admin_panel_settings" },
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
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
              <input
                className="w-full bg-[#f4f3f7] border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">All Roles</option>
              {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["User", "Email / Phone", "Roles", "Department", "Status", "Last Login", "Actions"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                        <p className="text-sm text-[#74777f]">Loading users...</p>
                      </div>
                    </td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                          <span className="material-symbols-outlined text-[#74777f] text-2xl">manage_accounts</span>
                        </div>
                        <p className="text-sm font-semibold text-[#1a1c1e]">No users found</p>
                        <button onClick={() => setShowAddUser(true)} className="text-sm text-[#1960a3] font-semibold hover:underline">+ Add first user</button>
                      </div>
                    </td></tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-[#f4f3f7] transition-colors group">
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {getInitials(user.name)}
                            </div>
                            <p className="text-sm font-semibold text-[#1a1c1e]">{user.name}</p>
                          </div>
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
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <p className="text-xs text-[#74777f]">{user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}</p>
                        </td>
                        <td className="px-5 py-4 border-b border-[#e3e2e6]">
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleUserStatus(user.id, user.isActive)} title={user.isActive ? "Deactivate" : "Activate"} className={`p-1.5 rounded-lg transition-colors ${user.isActive ? "hover:bg-[#ffdad6] text-[#74777f] hover:text-[#ba1a1a]" : "hover:bg-[#ccfbf1] text-[#74777f] hover:text-[#0d9488]"}`}>
                              <span className="material-symbols-outlined text-[18px]">{user.isActive ? "person_off" : "how_to_reg"}</span>
                            </button>
                            <button onClick={() => resetPassword(user.id)} title="Reset Password" className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]">
                              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                            </button>
                            <button title="View Audit Logs" className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]">
                              <span className="material-symbols-outlined text-[18px]">history</span>
                            </button>
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
                <p className="text-xs text-[#74777f]">Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}</p>
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
              <h3 className="text-sm font-semibold text-[#1a1c1e]">System Roles</h3>
            </div>
            <div className="divide-y divide-[#e3e2e6]">
              {SYSTEM_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#f4f3f7] ${selectedRole === role ? "bg-[#d3e4ff]/30 border-l-4 border-l-[#1960a3]" : ""}`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${selectedRole === role ? "text-[#1960a3]" : "text-[#1a1c1e]"}`}>{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-[#74777f]">System role</p>
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
                {selectedRole ? `Permissions — ${ROLE_LABELS[selectedRole]}` : "Select a role to view permissions"}
              </h3>
              {selectedRole && (
                <button className="flex items-center gap-1 text-xs text-[#1960a3] font-semibold border border-[#c4c6cf] px-3 py-1.5 rounded-lg hover:bg-[#f4f3f7]">
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  Save Changes
                </button>
              )}
            </div>
            {selectedRole ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-semibold text-[#43474e] uppercase tracking-wider px-4 py-3 bg-[#f4f3f7] border-b border-[#e3e2e6]">Module</th>
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
                <p className="text-sm text-[#74777f]">Select a role from the left panel to manage its permissions</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} onSaved={() => { setShowAddUser(false); fetchUsers(); }} />}
    </div>
  );
}

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
          <h3 className="text-lg font-bold text-[#1a1c1e]">Add New User</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg"><span className="material-symbols-outlined text-[20px] text-[#74777f]">close</span></button>
        </div>
        {error && <div className="flex items-center gap-2 p-3 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-lg mb-4"><span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">error</span><p className="text-sm text-[#93000a]">{error}</p></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full Name *"><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field" placeholder="First and last name" /></Field>
          <Field label="Email *"><input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-field" placeholder="user@clinic.com" /></Field>
          <Field label="Phone"><input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="+962 79 000 0000" /></Field>
          <Field label="Initial Password *">
            <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input-field" placeholder="Min 8 characters" minLength={8} />
          </Field>
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">Roles *</label>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_ROLES.map((role) => (
                <button key={role} type="button" onClick={() => toggleRole(role)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${form.roles.includes(role) ? "bg-[#002045] text-white border-[#002045]" : "bg-white text-[#43474e] border-[#c4c6cf] hover:border-[#1960a3]"}`}>
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">Cancel</button>
            <button type="submit" disabled={loading || form.roles.length === 0} className="flex-1 bg-[#002045] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
              Create User
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

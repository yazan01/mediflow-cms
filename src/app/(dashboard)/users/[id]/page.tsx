"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { UserRole } from "@/types";

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

interface AuditEntry {
  id: string;
  action: string;
  module: string;
  entityType?: string;
  ipAddress?: string;
  timestamp: string;
}

const ACTION_ICON: Record<string, string> = {
  CREATE: "add_circle",
  UPDATE: "edit",
  DELETE: "delete",
  LOGIN:  "login",
  LOGOUT: "logout",
  VIEW:   "visibility",
};

const ACTION_COLOR: Record<string, string> = {
  CREATE: "text-[#0d9488]",
  UPDATE: "text-[#1960a3]",
  DELETE: "text-[#ba1a1a]",
  LOGIN:  "text-[#7c3aed]",
  LOGOUT: "text-[#74777f]",
  VIEW:   "text-[#43474e]",
};

export default function UserViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState("");

  const [confirmToggle, setConfirmToggle] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error(res.status === 404 ? "User not found" : "Failed to load user");
      setUser(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/audit?userId=${id}&pageSize=20`);
      if (res.ok) {
        const data = await res.json();
        setAudit(data.data ?? data ?? []);
      }
    } catch { /* ignore */ } finally {
      setAuditLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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
        setUser(u => u ? { ...u, isActive: !u.isActive } : u);
        setToast({ msg: `User ${!user.isActive ? "activated" : "deactivated"} successfully`, ok: true });
      } else {
        setToast({ msg: "Failed to update status", ok: false });
      }
    } finally {
      setToggling(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
    </div>
  );

  if (error || !user) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">person_off</span>
      <p className="text-sm font-semibold text-[#1a1c1e]">{error || "User not found"}</p>
      <button onClick={() => router.push("/users")} className="text-sm text-[#1960a3] hover:underline">← Back to Users</button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/users")} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#1a1c1e] truncate">{user.name}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{user.email}</p>
        </div>
        <button
          onClick={() => setConfirmToggle(true)}
          disabled={toggling}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
            user.isActive
              ? "border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]"
              : "border border-[#0d9488] text-[#0d9488] hover:bg-[#ccfbf1]"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toggling ? "hourglass_empty" : user.isActive ? "person_off" : "person_check"}
          </span>
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 ring-2 ring-[#e3e2e6]" />
          ) : (
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0 ${user.isActive ? "bg-[#002045] text-white" : "bg-[#94a3b8] text-white"}`}>
              {getInitials(user.name)}
            </div>
          )}

          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {/* Status */}
            <InfoItem label="Status">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mt-0.5 ${user.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#e3e2e6] text-[#74777f]"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {user.isActive ? "Active" : "Inactive"}
              </span>
            </InfoItem>

            {/* 2FA */}
            <InfoItem label="Two-Factor Auth">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mt-0.5 ${user.twoFAEnabled ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                <span className="material-symbols-outlined text-[12px]">{user.twoFAEnabled ? "verified_user" : "security"}</span>
                {user.twoFAEnabled ? "Enabled" : "Disabled"}
              </span>
            </InfoItem>

            {/* Department */}
            <InfoItem label="Department" value={user.department?.name ?? "—"} />

            {/* Phone */}
            <InfoItem label="Phone" value={user.phone ?? "—"} />

            {/* Last Login */}
            <InfoItem label="Last Login" value={user.lastLogin ? formatDateTime(user.lastLogin) : "Never"} />

            {/* Member Since */}
            <InfoItem label="Member Since" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />

            {/* Employee Profile */}
            <InfoItem label="Employee Profile">
              {user.hasEmployee && user.employeeId ? (
                <Link
                  href={`/hr/${user.employeeId}`}
                  className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1.5 rounded-lg bg-[#d3e4ff] hover:bg-[#b8d4ff] text-[#1960a3] text-xs font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">badge</span>
                  View Profile
                  <span className="material-symbols-outlined text-[12px] opacity-60">open_in_new</span>
                </Link>
              ) : (
                <span className="text-sm text-[#74777f] mt-0.5 block">No employee record</span>
              )}
            </InfoItem>
          </div>
        </div>

        {/* Roles */}
        <div className="mt-6 pt-5 border-t border-[#e3e2e6]">
          <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-3">Roles & Access</p>
          <div className="flex flex-wrap gap-2">
            {user.roles.length === 0 ? (
              <span className="text-sm text-[#74777f]">No roles assigned</span>
            ) : user.roles.map(r => (
              <span key={r} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${ROLE_COLORS[r] ?? "bg-[#e9e7eb] text-[#43474e]"}`}>
                {r.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-bold text-[#1a1c1e] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1960a3] text-[18px]">history</span>
          Recent Activity
        </h3>

        {auditLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
          </div>
        ) : audit.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <span className="material-symbols-outlined text-[#c4c6cf] text-3xl">history_toggle_off</span>
            <p className="text-sm text-[#74777f]">No activity recorded yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute start-[18px] top-2 bottom-2 w-px bg-[#e3e2e6]" />
            <div className="space-y-1">
              {audit.map((entry) => {
                const icon = ACTION_ICON[entry.action] ?? "info";
                const color = ACTION_COLOR[entry.action] ?? "text-[#43474e]";
                return (
                  <div key={entry.id} className="flex items-start gap-4 ps-1 py-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#f4f3f7] border border-[#e3e2e6] flex items-center justify-center flex-shrink-0 z-10">
                      <span className={`material-symbols-outlined text-[17px] ${color}`}>{icon}</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#1a1c1e]">{entry.action}</span>
                        <span className="text-xs text-[#74777f]">{entry.module}</span>
                        {entry.entityType && entry.entityType !== entry.module && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f4f3f7] text-[#74777f]">{entry.entityType}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#74777f]">{formatDateTime(entry.timestamp)}</p>
                        {entry.ipAddress && (
                          <span className="text-[10px] text-[#c4c6cf]">· {entry.ipAddress}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Toggle Modal */}
      {confirmToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-3xl ${user.isActive ? "text-[#ba1a1a]" : "text-[#0d9488]"}`}>
                {user.isActive ? "person_off" : "person_check"}
              </span>
              <div>
                <p className="font-semibold text-[#1a1c1e]">{user.isActive ? "Deactivate" : "Activate"} user?</p>
                <p className="text-sm text-[#74777f]">{user.name}</p>
              </div>
            </div>
            <p className="text-sm text-[#74777f]">
              {user.isActive
                ? "This user will lose all system access immediately."
                : "This user will regain access to the system."}
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmToggle(false)} className="flex-1 border border-[#c4c6cf] bg-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7]">
                Cancel
              </button>
              <button
                onClick={toggleActive}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white ${user.isActive ? "bg-[#ba1a1a]" : "bg-[#0d9488]"} hover:opacity-90`}
              >
                {user.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 end-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.ok ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#ffdad6] text-[#ba1a1a]"}`}>
          <span className="material-symbols-outlined text-[18px]">{toast.ok ? "check_circle" : "error"}</span>
          {toast.msg}
        </div>
      )}
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

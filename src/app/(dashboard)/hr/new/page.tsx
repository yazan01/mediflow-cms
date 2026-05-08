"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type User = { id: string; name: string; email: string };
type Department = { id: string; name: string };
type Branch = { id: string; name: string };

export default function NewEmployeePage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userMode, setUserMode] = useState<"existing" | "new">("existing");

  const [form, setForm] = useState({
    userId: "", departmentId: "", jobTitle: "", employmentType: "FULL_TIME",
    basicSalary: "", housingAllowance: "", transportAllowance: "", medicalAllowance: "",
    hireDate: "", annualLeaveBalance: "21", sickLeaveBalance: "14", branchId: "",
    bankName: "", bankAccount: "",
  });
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then(r => r.ok ? r.json() : { data: [] }).then(d => setUsers(d.data ?? []));
    fetch("/api/hr/departments").then(r => r.ok ? r.json() : []).then(setDepartments);
    fetch("/api/branches").then(r => r.ok ? r.json() : []).then(setBranches);
  }, []);

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (userMode === "existing" && !form.userId) { setError(t.common.required); return; }
    if (userMode === "new" && (!newUser.name || !newUser.email || !newUser.password)) { setError(t.common.required); return; }
    if (!form.departmentId || !form.jobTitle) { setError(t.common.required); return; }
    setSaving(true);
    setError("");
    try {
      let userId = form.userId;
      if (userMode === "new") {
        const userRes = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newUser.name, email: newUser.email, password: newUser.password, roles: ["STAFF"] }),
        });
        if (!userRes.ok) {
          const err = await userRes.json().catch(() => ({}));
          setError(err.detail || t.hr.createEmployeeFailed);
          return;
        }
        const created = await userRes.json();
        userId = created.id;
      }
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          departmentId: form.departmentId,
          jobTitle: form.jobTitle,
          employmentType: form.employmentType,
          basicSalary: Number(form.basicSalary) || 0,
          housingAllowance: Number(form.housingAllowance) || 0,
          transportAllowance: Number(form.transportAllowance) || 0,
          medicalAllowance: Number(form.medicalAllowance) || 0,
          hireDate: form.hireDate || undefined,
          annualLeaveBalance: Number(form.annualLeaveBalance) || 21,
          sickLeaveBalance: Number(form.sickLeaveBalance) || 14,
          branchId: form.branchId || undefined,
          bankName: form.bankName || undefined,
          bankAccount: form.bankAccount || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || t.common.error);
        return;
      }
      router.push("/hr");
    } catch {
      setError(t.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr" className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.hr.addEmployee}</h1>
          <p className="text-sm text-[#74777f]">{t.hr.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 space-y-5">
        {error && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2 space-y-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserMode("existing")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${userMode === "existing" ? "border-[#1960a3] bg-[#d3e4ff] text-[#1960a3]" : "border-[#e3e2e6] text-[#74777f] hover:bg-[#f4f3f7]"}`}
              >
                {t.hr.selectExistingUser}
              </button>
              <button
                type="button"
                onClick={() => setUserMode("new")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${userMode === "new" ? "border-[#1960a3] bg-[#d3e4ff] text-[#1960a3]" : "border-[#e3e2e6] text-[#74777f] hover:bg-[#f4f3f7]"}`}
              >
                {t.hr.createNewUser}
              </button>
            </div>
            {userMode === "existing" ? (
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.users.user} *</label>
                <select className="input-field" value={form.userId} onChange={e => set("userId", e.target.value)} required>
                  <option value="">{t.common.search}...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#f4f3f7] rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.newUserName} *</label>
                  <input className="input-field" value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.newUserEmail} *</label>
                  <input type="email" className="input-field" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} placeholder="email@clinic.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.newUserPassword} *</label>
                  <input type="password" className="input-field" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="Min 8 characters" />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.department} *</label>
            <select className="input-field" value={form.departmentId} onChange={e => set("departmentId", e.target.value)} required>
              <option value="">{t.hr.allDepts}</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.deptTitle} *</label>
            <input className="input-field" value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)} placeholder="Head Nurse" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.type}</label>
            <select className="input-field" value={form.employmentType} onChange={e => set("employmentType", e.target.value)}>
              <option value="FULL_TIME">{t.hr.fullTime}</option>
              <option value="PART_TIME">{t.hr.partTime}</option>
              <option value="CONTRACT">{t.hr.contract}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.hireDate}</label>
            <input type="date" className="input-field" value={form.hireDate} onChange={e => set("hireDate", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.baseSalary}</label>
            <input type="number" className="input-field" value={form.basicSalary} onChange={e => set("basicSalary", e.target.value)} min="0" step="0.01" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.housingAllowance}</label>
            <input type="number" className="input-field" value={form.housingAllowance} onChange={e => set("housingAllowance", e.target.value)} min="0" step="0.01" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.transportAllowance}</label>
            <input type="number" className="input-field" value={form.transportAllowance} onChange={e => set("transportAllowance", e.target.value)} min="0" step="0.01" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.medicalAllowance}</label>
            <input type="number" className="input-field" value={form.medicalAllowance} onChange={e => set("medicalAllowance", e.target.value)} min="0" step="0.01" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.leaveBal}</label>
            <input type="number" className="input-field" value={form.annualLeaveBalance} onChange={e => set("annualLeaveBalance", e.target.value)} min="0" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.branch}</label>
            <select className="input-field" value={form.branchId} onChange={e => set("branchId", e.target.value)}>
              <option value="">{t.hr.allBranches}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.bankInfo}</label>
            <input className="input-field" value={form.bankName} onChange={e => set("bankName", e.target.value)} placeholder="Bank name" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.bankAccount}</label>
            <input className="input-field" value={form.bankAccount} onChange={e => set("bankAccount", e.target.value)} placeholder="Account number / IBAN" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e2e6]">
          <Link href="/hr" className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</Link>
          <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.hr.addEmployee}
          </button>
        </div>
      </form>
    </div>
  );
}

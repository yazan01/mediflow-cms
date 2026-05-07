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

  const [form, setForm] = useState({
    userId: "", departmentId: "", jobTitle: "", employmentType: "FULL_TIME",
    basicSalary: "", housingAllowance: "", transportAllowance: "", medicalAllowance: "",
    hireDate: "", annualLeaveBalance: "21", sickLeaveBalance: "14", branchId: "",
  });
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
    if (!form.userId || !form.departmentId || !form.jobTitle) {
      setError(t.common.required);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId,
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
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.users.user} *</label>
            <select className="input-field" value={form.userId} onChange={e => set("userId", e.target.value)} required>
              <option value="">{t.common.search}...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
            </select>
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
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.hr.allowances}</label>
            <input type="number" className="input-field" value={form.housingAllowance} onChange={e => set("housingAllowance", e.target.value)} min="0" step="0.01" placeholder="Housing allowance" />
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

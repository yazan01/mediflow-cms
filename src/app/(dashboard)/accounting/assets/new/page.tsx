"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const INPUT = "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors";
const LABEL = "block text-xs font-semibold text-[#43474e] mb-1";
const CARD = "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6";

const ASSET_CATEGORIES = [
  "Medical Equipment", "Furniture", "IT Equipment", "Vehicles", "Buildings",
  "Lab Equipment", "Imaging Equipment", "Software Licenses", "Other",
];

interface Department { id: string; name: string }

export default function NewAssetPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "", category: "", assetCode: "", serialNumber: "",
    departmentId: "", location: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchasePrice: "", currentValue: "", salvageValue: "0",
    warrantyExpiry: "", usefulLifeYears: "5",
    depreciationMethod: "STRAIGHT_LINE", status: "ACTIVE", notes: "",
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then((d) => setDepartments(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Asset name is required"); return; }
    if (!form.category) { setError("Category is required"); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/accounting/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          assetCode: form.assetCode || undefined,
          serialNumber: form.serialNumber || undefined,
          departmentId: form.departmentId || undefined,
          location: form.location || undefined,
          purchaseDate: form.purchaseDate || undefined,
          purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined,
          currentValue: form.currentValue ? parseFloat(form.currentValue) : undefined,
          salvageValue: parseFloat(form.salvageValue) || 0,
          warrantyExpiry: form.warrantyExpiry || undefined,
          usefulLifeYears: parseInt(form.usefulLifeYears) || 5,
          depreciationMethod: form.depreciationMethod,
          status: form.status,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to create asset");
      router.push("/accounting");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounting" className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f]" aria-label="Back">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Register Asset</h1>
          <p className="text-sm text-[#74777f]">Add a new fixed asset to the register</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#ffdad6] text-[#ba1a1a] rounded-xl px-4 py-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">error</span>{error}
        </div>
      )}

      {/* Asset Info */}
      <div className={CARD}>
        <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">inventory_2</span>Asset Details
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className={LABEL}>Asset Name <span className="text-[#ba1a1a]">*</span></label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="E.g. Ultrasound Machine GE Voluson" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Category <span className="text-[#ba1a1a]">*</span></label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} required className={INPUT}>
              <option value="">— Select category —</option>
              {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Asset Code</label>
            <input type="text" value={form.assetCode} onChange={(e) => set("assetCode", e.target.value)} placeholder="E.g. AST-2024-001" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Serial Number</label>
            <input type="text" value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} placeholder="Manufacturer serial number" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="E.g. Room 3, Floor 2" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Department</label>
            <select value={form.departmentId} onChange={(e) => set("departmentId", e.target.value)} className={INPUT}>
              <option value="">— No department —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className={INPUT}>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="DISPOSED">Disposed</option>
              <option value="TRANSFERRED">Transferred</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial Info */}
      <div className={CARD}>
        <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">payments</span>Financial & Depreciation
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={LABEL}>Purchase Date</label>
            <input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Warranty Expiry</label>
            <input type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Purchase Price</label>
            <input type="number" step="0.01" min="0" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} placeholder="0.00" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Current Value</label>
            <input type="number" step="0.01" min="0" value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)} placeholder="Leave blank to use purchase price" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Salvage Value</label>
            <input type="number" step="0.01" min="0" value={form.salvageValue} onChange={(e) => set("salvageValue", e.target.value)} placeholder="0.00" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Useful Life (Years)</label>
            <input type="number" min={1} max={50} value={form.usefulLifeYears} onChange={(e) => set("usefulLifeYears", e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Depreciation Method</label>
            <select value={form.depreciationMethod} onChange={(e) => set("depreciationMethod", e.target.value)} className={INPUT}>
              <option value="STRAIGHT_LINE">Straight Line</option>
              <option value="DECLINING_BALANCE">Double Declining Balance</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes about this asset" className={`${INPUT} resize-none`} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <Link href="/accounting" className="px-5 py-2.5 border border-[#c4c6cf] bg-white text-[#1a1c1e] rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#002045] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
          Register Asset
        </button>
      </div>
    </form>
  );
}

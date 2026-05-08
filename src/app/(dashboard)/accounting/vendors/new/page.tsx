"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const INPUT = "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors";
const LABEL = "block text-xs font-semibold text-[#43474e] mb-1";
const CARD = "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6";

const PAYMENT_TERMS = ["Net 7", "Net 15", "Net 30", "Net 60", "Net 90", "Prepaid", "COD"];

export default function NewVendorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "", contactPerson: "", phone: "", email: "", address: "",
    taxId: "", paymentTerms: "Net 30", bankDetails: "", isPreferred: false, notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vendor name is required"); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/accounting/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to create vendor");
      router.push("/accounting");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create vendor");
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
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Add Vendor</h1>
          <p className="text-sm text-[#74777f]">Register a new supplier or vendor</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#ffdad6] text-[#ba1a1a] rounded-xl px-4 py-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">error</span>{error}
        </div>
      )}

      <div className={CARD}>
        <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">business</span>Basic Information
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className={LABEL}>Vendor Name <span className="text-[#ba1a1a]">*</span></label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Company or individual name" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Contact Person</label>
            <input type="text" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Primary contact name" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+962-xx-xxx-xxxx" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="vendor@example.com" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Payment Terms</label>
            <select value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} className={INPUT}>
              {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Address</label>
            <textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Full address" className={`${INPUT} resize-none`} />
          </div>
        </div>
      </div>

      <div className={CARD}>
        <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">account_balance</span>Financial Details
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={LABEL}>Tax ID / VAT Number</label>
            <input type="text" value={form.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="Tax registration number" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Bank Details</label>
            <textarea rows={2} value={form.bankDetails} onChange={(e) => set("bankDetails", e.target.value)} placeholder="Bank name, account number, IBAN…" className={`${INPUT} resize-none`} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Additional notes about this vendor" className={`${INPUT} resize-none`} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <input type="checkbox" id="preferred" checked={form.isPreferred} onChange={(e) => set("isPreferred", e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="preferred" className="text-sm font-semibold text-[#1a1c1e]">Mark as preferred vendor</label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <Link href="/accounting" className="px-5 py-2.5 border border-[#c4c6cf] bg-white text-[#1a1c1e] rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#002045] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
          Add Vendor
        </button>
      </div>
    </form>
  );
}

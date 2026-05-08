"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const INPUT = "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors";
const LABEL = "block text-xs font-semibold text-[#43474e] mb-1";
const CARD = "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6";

const CATEGORIES = [
  "Utilities", "Salaries", "Rent", "Medical Supplies", "Medications",
  "Maintenance", "Insurance", "Marketing", "IT & Software", "Travel",
  "Food & Catering", "Cleaning", "Equipment", "Training", "Other",
];

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CREDIT_CARD", "CHEQUE", "ONLINE"];

interface Vendor { id: string; name: string }

export default function NewExpensePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    vendorId: "",
    paymentMethod: "CASH",
    referenceNo: "",
    isRecurring: false,
    notes: "",
  });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounting/vendors?pageSize=100").then((r) => r.json()).then((d) => setVendors(d.data ?? [])).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) { setError("Category is required"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Valid amount is required"); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/accounting/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          vendorId: form.vendorId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to save");
      router.push("/accounting");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/accounting" className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f]" aria-label="Back">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Log Expense</h1>
          <p className="text-sm text-[#74777f]">Record a new business expense</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#ffdad6] text-[#ba1a1a] rounded-xl px-4 py-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">error</span>{error}
        </div>
      )}

      <div className={CARD}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={LABEL}>Date <span className="text-[#ba1a1a]">*</span></label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Category <span className="text-[#ba1a1a]">*</span></label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} required className={INPUT}>
              <option value="">— Select category —</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Description <span className="text-[#ba1a1a]">*</span></label>
            <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)} required placeholder="Brief description of the expense" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Amount <span className="text-[#ba1a1a]">*</span></label>
            <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} required placeholder="0.00" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Payment Method</label>
            <select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className={INPUT}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Vendor (optional)</label>
            <select value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)} className={INPUT}>
              <option value="">— No vendor —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Reference No.</label>
            <input type="text" value={form.referenceNo} onChange={(e) => set("referenceNo", e.target.value)} placeholder="Invoice or receipt number" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Additional notes…" className={`${INPUT} resize-none`} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <input type="checkbox" id="recurring" checked={form.isRecurring} onChange={(e) => set("isRecurring", e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="recurring" className="text-sm font-semibold text-[#1a1c1e]">Recurring expense</label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <Link href="/accounting" className="px-5 py-2.5 border border-[#c4c6cf] bg-white text-[#1a1c1e] rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#002045] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
          Log Expense
        </button>
      </div>
    </form>
  );
}

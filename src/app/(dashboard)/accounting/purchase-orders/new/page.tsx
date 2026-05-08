"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const INPUT = "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors";
const LABEL = "block text-xs font-semibold text-[#43474e] mb-1";
const CARD = "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6";

interface Vendor { id: string; name: string; paymentTerms?: string }

type POItem = { itemName: string; quantity: string; unitPrice: string; notes: string };
const EMPTY_ITEM: POItem = { itemName: "", quantity: "1", unitPrice: "", notes: "" };

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultVendorId = searchParams.get("vendorId") ?? "";

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState({
    vendorId: defaultVendorId,
    date: new Date().toISOString().split("T")[0],
    expectedDelivery: "",
    notes: "",
  });
  const [items, setItems] = useState<POItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounting/vendors?pageSize=200").then((r) => r.json()).then((d) => setVendors(d.data ?? [])).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addItem() { setItems((i) => [...i, { ...EMPTY_ITEM }]); }
  function removeItem(i: number) { setItems((arr) => arr.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, key: keyof POItem, val: string) {
    setItems((arr) => arr.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  }

  const subtotal = items.reduce((sum, it) => {
    const q = parseInt(it.quantity) || 0;
    const p = parseFloat(it.unitPrice) || 0;
    return sum + q * p;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) { setError("Please select a vendor"); return; }
    const validItems = items.filter((it) => it.itemName.trim() && parseFloat(it.unitPrice) > 0 && parseInt(it.quantity) > 0);
    if (validItems.length === 0) { setError("At least one valid item is required"); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/accounting/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          date: form.date,
          expectedDelivery: form.expectedDelivery || undefined,
          notes: form.notes || undefined,
          items: validItems.map((it) => ({
            itemName: it.itemName.trim(),
            quantity: parseInt(it.quantity),
            unitPrice: parseFloat(it.unitPrice),
            notes: it.notes || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to create PO");
      router.push("/accounting");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create PO");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounting" className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f]" aria-label="Back">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">New Purchase Order</h1>
          <p className="text-sm text-[#74777f]">Create a purchase order for vendor approval</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#ffdad6] text-[#ba1a1a] rounded-xl px-4 py-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">error</span>{error}
        </div>
      )}

      {/* PO Header */}
      <div className={CARD}>
        <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">shopping_bag</span>Order Details
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className={LABEL}>Vendor <span className="text-[#ba1a1a]">*</span></label>
            <select value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)} required className={INPUT}>
              <option value="">— Select vendor —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.paymentTerms ? ` (${v.paymentTerms})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Order Date <span className="text-[#ba1a1a]">*</span></label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Expected Delivery</label>
            <input type="date" value={form.expectedDelivery} onChange={(e) => set("expectedDelivery", e.target.value)} min={form.date} className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Special instructions or notes for vendor…" className={`${INPUT} resize-none`} />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">list_alt</span>Line Items
          </p>
          <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs font-semibold text-[#1960a3] hover:text-[#002045] px-3 py-1.5 border border-[#1960a3]/30 rounded-lg hover:bg-[#eff6ff] transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>Add Item
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_100px_1fr_36px] gap-3 items-start p-3 bg-[#f4f3f7] rounded-xl">
              <div>
                {i === 0 && <label className={LABEL}>Item Name *</label>}
                <input type="text" placeholder="E.g. Surgical gloves (M)" value={item.itemName} onChange={(e) => updateItem(i, "itemName", e.target.value)} className={INPUT} />
              </div>
              <div>
                {i === 0 && <label className={LABEL}>Qty *</label>}
                <input type="number" min={1} placeholder="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className={INPUT} />
              </div>
              <div>
                {i === 0 && <label className={LABEL}>Unit Price *</label>}
                <input type="number" step="0.01" min="0.01" placeholder="0.00" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} className={INPUT} />
              </div>
              <div>
                {i === 0 && <label className={LABEL}>Notes</label>}
                <input type="text" placeholder="Optional note" value={item.notes} onChange={(e) => updateItem(i, "notes", e.target.value)} className={INPUT} />
              </div>
              <div className={i === 0 ? "mt-5" : ""}>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="p-2 text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors" aria-label="Remove">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Subtotal */}
        <div className="mt-5 pt-4 border-t border-[#e3e2e6] flex justify-end">
          <div className="text-right">
            <p className="text-xs text-[#74777f] font-semibold uppercase tracking-wider">Total Amount</p>
            <p className="text-2xl font-bold text-[#002045]">{formatCurrency(subtotal)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <Link href="/accounting" className="px-5 py-2.5 border border-[#c4c6cf] bg-white text-[#1a1c1e] rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#002045] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">shopping_bag</span>}
          Create Purchase Order
        </button>
      </div>
    </form>
  );
}

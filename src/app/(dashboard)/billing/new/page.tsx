"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { InsuranceProviderSelect } from "@/components/ui/InsuranceProviderSelect";

// ── Types ────────────────────────────────────────────────────────────────────

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  phone: string;
  insuranceProvider?: string;
  insurancePolicyNo?: string;
}

interface LineItem {
  _id: string; // client-only key
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  discount: number; // percent per item
}

const CATEGORIES = [
  "Consultation",
  "Procedure",
  "Lab",
  "Radiology",
  "Medication",
  "Other",
] as const;

function makeItem(): LineItem {
  return {
    _id: Math.random().toString(36).slice(2),
    description: "",
    category: "Consultation",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
  };
}

function itemTotal(item: LineItem): number {
  return item.quantity * item.unitPrice * (1 - item.discount / 100);
}

// ── Shared input class ────────────────────────────────────────────────────────

const INPUT =
  "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-all duration-150";

const CARD =
  "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)]";

const LABEL =
  "block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewInvoicePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const b = t.billing;

  // Patient search
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Line items
  const [items, setItems] = useState<LineItem[]>([makeItem()]);

  // Invoice-level fields
  const [dueDate, setDueDate] = useState("");
  const [insuranceClaim, setInsuranceClaim] = useState(false);
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNo, setInsurancePolicyNo] = useState("");
  const [copayPercent, setCopayPercent] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Totals panel
  const [discountAmount, setDiscountAmount] = useState<string>("");
  const [discountRate, setDiscountRate] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("");

  // Submission
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");

  // Category label map (inside component so it re-renders on language change)
  const CAT_LABELS: Record<string, string> = {
    Consultation: b.catConsultation,
    Procedure: b.catProcedure,
    Lab: b.catLab,
    Radiology: b.catRadiology,
    Medication: b.catMedication,
    Other: b.catOther,
  };

  // ── Patient search debounce ──────────────────────────────────────────────

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPatientResults([]);
      setDropdownOpen(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/patients?search=${encodeURIComponent(q)}&pageSize=5`
      );
      if (res.ok) {
        const data = await res.json();
        setPatientResults(data.data ?? []);
        setDropdownOpen(true);
      }
    } catch {
      // silently ignore search errors
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => runSearch(patientQuery), 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [patientQuery, runSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectPatient(p: PatientResult) {
    setSelectedPatient(p);
    setPatientQuery(`${p.firstName} ${p.lastName}`);
    setDropdownOpen(false);
    if (p.insuranceProvider) {
      setInsuranceClaim(true);
      setInsuranceProvider(p.insuranceProvider);
      setInsurancePolicyNo(p.insurancePolicyNo ?? "");
    }
  }

  function clearPatient() {
    setSelectedPatient(null);
    setPatientQuery("");
    setPatientResults([]);
    setInsuranceClaim(false);
    setInsuranceProvider("");
    setInsurancePolicyNo("");
  }

  // ── Line item helpers ────────────────────────────────────────────────────

  function updateItem<K extends keyof LineItem>(
    id: string,
    field: K,
    value: LineItem[K]
  ) {
    setItems((prev) =>
      prev.map((it) => (it._id === id ? { ...it, [field]: value } : it))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, makeItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((it) => it._id !== id);
    });
  }

  // ── Live totals ──────────────────────────────────────────────────────────

  const subtotal = items.reduce((sum, it) => sum + itemTotal(it), 0);

  const invoiceDiscount = (() => {
    const flat = parseFloat(discountAmount);
    if (!isNaN(flat) && flat > 0) return flat;
    const rate = parseFloat(discountRate);
    if (!isNaN(rate) && rate > 0) return subtotal * (rate / 100);
    return 0;
  })();

  const afterDiscount = subtotal - invoiceDiscount;
  const taxAmount = (() => {
    const rate = parseFloat(taxRate);
    return !isNaN(rate) && rate > 0 ? afterDiscount * (rate / 100) : 0;
  })();
  const totalAmount = afterDiscount + taxAmount;

  const copayValue = parseFloat(copayPercent);
  const hasCopay = insuranceClaim && !isNaN(copayValue) && copayValue >= 0 && copayValue <= 100;
  const patientShare = hasCopay ? totalAmount * copayValue / 100 : totalAmount;
  const insuranceShare = hasCopay ? totalAmount * (1 - copayValue / 100) : 0;

  // ── Submission ───────────────────────────────────────────────────────────

  async function submit(asDraft = false) {
    if (saving || savingDraft) return;
    setError("");
    if (!selectedPatient) {
      setError(b.noPatientError);
      return;
    }
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) {
      setError(b.noItemsError);
      return;
    }

    asDraft ? setSavingDraft(true) : setSaving(true);

    try {
      const body = {
        patientId: selectedPatient.id,
        items: validItems.map((it) => ({
          description: it.description,
          category: it.category,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
        })),
        discountAmount: invoiceDiscount > 0 ? invoiceDiscount : undefined,
        discountRate:
          invoiceDiscount === 0 && discountRate
            ? parseFloat(discountRate)
            : undefined,
        taxRate: taxRate ? parseFloat(taxRate) : undefined,
        dueDate: dueDate || undefined,
        insuranceClaim,
        insuranceProvider: insuranceClaim ? insuranceProvider : undefined,
        insurancePolicyNo: insuranceClaim ? insurancePolicyNo : undefined,
        insuranceCopayPercent: hasCopay ? copayValue : undefined,
        notes: notes || undefined,
        ...(asDraft && { status: "DRAFT" }),
      };

      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? b.createFailed);
        return;
      }

      router.push(`/billing/${data.id}`);
    } catch {
      setError(t.common.networkError);
    } finally {
      setSaving(false);
      setSavingDraft(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Link
          href="/billing"
          className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f] hover:text-[#1a1c1e]"
          aria-label={t.common.back}
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{b.newInvoice}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{b.newInvoiceDesc}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={savingDraft || saving}
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#43474e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] disabled:opacity-50 transition-colors"
          >
            {savingDraft ? (
              <span className="w-4 h-4 border-2 border-[#43474e]/30 border-t-[#43474e] rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">save</span>
            )}
            {b.saveAsDraft}
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={saving || savingDraft}
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm transition-opacity"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            )}
            {saving ? b.creatingInvoice : b.createInvoice}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl">
          <span className="material-symbols-outlined text-[#ba1a1a] text-[20px] shrink-0">
            error
          </span>
          <p className="text-sm text-[#93000a]">{error}</p>
          <button
            onClick={() => setError("")}
            className="ms-auto p-1 hover:bg-[#ba1a1a]/10 rounded transition-colors"
            aria-label={t.common.close}
          >
            <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* ══ LEFT COLUMN ══ */}
        <div className="space-y-6">
          {/* ── Patient Search ── */}
          <div className={`${CARD} p-6`}>
            <h2 className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-4">
              {b.patient}
            </h2>

            <div ref={searchRef} className="relative">
              <label className={LABEL}>{b.searchPatientLabel} *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px] pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  className={`${INPUT} ps-9 pe-9`}
                  placeholder={b.searchPatientPlaceholder}
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    if (selectedPatient) clearPatient();
                  }}
                  onFocus={() => patientResults.length > 0 && setDropdownOpen(true)}
                  autoComplete="off"
                />
                {searchLoading && (
                  <span className="absolute end-3 top-1/2 -translate-y-1/2">
                    <span className="w-4 h-4 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin block" />
                  </span>
                )}
                {selectedPatient && !searchLoading && (
                  <button
                    type="button"
                    onClick={clearPatient}
                    className="absolute end-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-[#e3e2e6] rounded transition-colors"
                    aria-label={t.common.close}
                  >
                    <span className="material-symbols-outlined text-[#74777f] text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {dropdownOpen && patientResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#e3e2e6] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => selectPatient(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#f4f3f7] border-b border-[#e3e2e6] last:border-b-0 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#d3e4ff] flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#1960a3]">
                          {p.firstName[0]}
                          {p.lastName[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1a1c1e] truncate">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-[#74777f]">MRN: {p.mrn}</p>
                      </div>
                      <span className="material-symbols-outlined text-[#c4c6cf] text-[18px]">
                        chevron_right
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {dropdownOpen &&
                patientQuery.trim() &&
                patientResults.length === 0 &&
                !searchLoading && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#e3e2e6] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.10)] px-4 py-5 text-center">
                    <span className="material-symbols-outlined text-[#c4c6cf] text-2xl block mb-1">
                      person_search
                    </span>
                    <p className="text-sm text-[#74777f]">{b.noPatientsFound}</p>
                  </div>
                )}
            </div>

            {/* Selected patient info card */}
            {selectedPatient && (
              <div className="mt-4 flex items-center gap-4 p-4 bg-[#f4f8ff] border border-[#1960a3]/20 rounded-xl">
                <div className="w-11 h-11 rounded-full bg-[#1960a3] flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-white">
                    {selectedPatient.firstName[0]}
                    {selectedPatient.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1a1c1e]">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-[#74777f]">
                      MRN:{" "}
                      <span className="font-mono font-semibold text-[#1960a3]">
                        {selectedPatient.mrn}
                      </span>
                    </span>
                    {selectedPatient.phone && (
                      <span className="text-xs text-[#74777f]">
                        {selectedPatient.phone}
                      </span>
                    )}
                    {selectedPatient.insuranceProvider && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#d3e4ff] text-[#1960a3] px-1.5 py-0.5 rounded">
                        <span className="material-symbols-outlined text-[12px]">
                          health_and_safety
                        </span>
                        {selectedPatient.insuranceProvider}
                      </span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#0d9488] text-[20px]">
                  check_circle
                </span>
              </div>
            )}
          </div>

          {/* ── Line Items ── */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-[#e3e2e6] flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                {b.invoiceItems}
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#1960a3] hover:bg-[#d3e4ff]/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {b.addItem}
              </button>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_140px_68px_110px_80px_100px_36px] gap-2 px-4 py-2.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">
              {[
                b.colDescription,
                b.colCategory,
                b.colQty,
                b.colUnitPrice,
                b.colDiscountPct,
                b.total,
                "",
              ].map((h, i) => (
                <div
                  key={i}
                  className="text-xs font-semibold text-[#43474e] uppercase tracking-wider"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#e3e2e6]">
              {items.map((item, idx) => (
                <div
                  key={item._id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_140px_68px_110px_80px_100px_36px] gap-2 px-4 py-3 items-center hover:bg-[#fafafa] transition-colors"
                >
                  {/* Description */}
                  <div>
                    <label className="md:hidden text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">
                      {b.colDescription}
                    </label>
                    <input
                      type="text"
                      className={INPUT}
                      placeholder={`${b.colDescription} ${idx + 1}…`}
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item._id, "description", e.target.value)
                      }
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="md:hidden text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">
                      {b.colCategory}
                    </label>
                    <select
                      className={INPUT}
                      value={item.category}
                      onChange={(e) =>
                        updateItem(item._id, "category", e.target.value)
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CAT_LABELS[c] ?? c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Qty */}
                  <div>
                    <label className="md:hidden text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">
                      {b.colQty}
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={INPUT}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          item._id,
                          "quantity",
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                    />
                  </div>

                  {/* Unit Price */}
                  <div>
                    <label className="md:hidden text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">
                      {b.colUnitPrice}
                    </label>
                    <div className="relative">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-[#74777f] pointer-events-none">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={`${INPUT} ps-6`}
                        placeholder="0.00"
                        value={item.unitPrice === 0 ? "" : item.unitPrice}
                        onChange={(e) =>
                          updateItem(
                            item._id,
                            "unitPrice",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Discount % */}
                  <div>
                    <label className="md:hidden text-[10px] font-semibold text-[#74777f] uppercase tracking-wider">
                      {b.colDiscountPct}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className={`${INPUT} pe-6`}
                        placeholder="0"
                        value={item.discount === 0 ? "" : item.discount}
                        onChange={(e) =>
                          updateItem(
                            item._id,
                            "discount",
                            Math.min(
                              100,
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          )
                        }
                      />
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-[#74777f] pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Row total */}
                  <div className="text-sm font-semibold text-[#1a1c1e] tabular-nums text-right">
                    <span className="md:hidden text-[10px] font-semibold text-[#74777f] uppercase tracking-wider block">
                      {b.total}
                    </span>
                    {formatCurrency(itemTotal(item))}
                  </div>

                  {/* Remove */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item._id)}
                      disabled={items.length === 1}
                      className="p-1.5 rounded-lg text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label={t.common.delete}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal row */}
            <div className="px-6 py-3 bg-[#f4f3f7] border-t border-[#e3e2e6] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                {b.itemsSubtotal}
              </span>
              <span className="text-sm font-bold text-[#1a1c1e] tabular-nums">
                {formatCurrency(subtotal)}
              </span>
            </div>
          </div>

          {/* ── Optional Fields ── */}
          <div className={`${CARD} p-6 space-y-5`}>
            <h2 className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              {b.additionalDetails}
            </h2>

            {/* Due date */}
            <div>
              <label className={LABEL}>{b.dueDateLabel}</label>
              <input
                type="date"
                className={INPUT}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Insurance toggle */}
            <div className="space-y-3">
              <div
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                  insuranceClaim
                    ? "bg-[#f0f7ff] border-[#1960a3]/30"
                    : "bg-[#f4f3f7] border-[#e3e2e6]"
                }`}
                onClick={() => setInsuranceClaim((v) => !v)}
              >
                <input
                  id="insurance-toggle"
                  type="checkbox"
                  checked={insuranceClaim}
                  onChange={(e) => setInsuranceClaim(e.target.checked)}
                  className="w-4 h-4 accent-[#002045] shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor="insurance-toggle"
                  className="flex items-center gap-2 text-sm font-semibold text-[#1a1c1e] cursor-pointer select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="material-symbols-outlined text-[18px] text-[#1960a3]">
                    health_and_safety
                  </span>
                  {b.billToInsurance}
                </label>
                <p className="text-xs text-[#74777f] ms-auto hidden sm:block">
                  {b.insuranceClaimNote}
                </p>
              </div>

              {insuranceClaim && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ps-1">
                    <div>
                      <label className={LABEL}>{b.insuranceProviderLabel} *</label>
                      <InsuranceProviderSelect
                        value={insuranceProvider}
                        onChange={setInsuranceProvider}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>{b.policyMemberNo}</label>
                      <input
                        type="text"
                        className={INPUT}
                        placeholder={b.policyPlaceholder}
                        value={insurancePolicyNo}
                        onChange={(e) => setInsurancePolicyNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>{b.copayPercent}</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          className={`${INPUT} pe-6`}
                          placeholder="e.g. 20"
                          value={copayPercent}
                          onChange={(e) => setCopayPercent(e.target.value)}
                        />
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-[#74777f] pointer-events-none">%</span>
                      </div>
                      <p className="text-xs text-[#74777f] mt-1">{b.copayDesc}</p>
                    </div>
                  </div>

                  {/* Live copay breakdown */}
                  {hasCopay && (
                    <div className="p-3 bg-[#f4f8ff] border border-[#1960a3]/20 rounded-xl grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-white rounded-lg border border-[#e3e2e6]">
                        <p className="text-[10px] font-semibold text-[#74777f] uppercase tracking-wider mb-0.5">{b.patientShare}</p>
                        <p className="text-base font-bold text-[#002045]">{formatCurrency(patientShare)}</p>
                        <p className="text-[10px] text-[#74777f]">{copayValue}%</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded-lg border border-[#e3e2e6]">
                        <p className="text-[10px] font-semibold text-[#74777f] uppercase tracking-wider mb-0.5">{b.insuranceShare}</p>
                        <p className="text-base font-bold text-[#1960a3]">{formatCurrency(insuranceShare)}</p>
                        <p className="text-[10px] text-[#74777f]">{100 - copayValue}%</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className={LABEL}>{t.common.notes}</label>
              <textarea
                className={`${INPUT} resize-none`}
                rows={3}
                placeholder={b.notesPlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ══ RIGHT COLUMN — Totals + Summary ══ */}
        <div className="space-y-5 xl:sticky xl:top-6">
          {/* Totals panel */}
          <div className={`${CARD} p-6 space-y-4`}>
            <h2 className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              {b.invoiceSummary}
            </h2>

            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#74777f]">{b.subtotal}</span>
              <span className="text-sm font-semibold text-[#1a1c1e] tabular-nums">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="border-t border-[#e3e2e6] pt-4 space-y-3">
              {/* Invoice-level discount */}
              <div>
                <label className={LABEL}>{b.invoiceDiscountLabel}</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-[#74777f] pointer-events-none">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={`${INPUT} ps-6`}
                      placeholder={b.flatAmtPlaceholder}
                      value={discountAmount}
                      onChange={(e) => {
                        setDiscountAmount(e.target.value);
                        if (e.target.value) setDiscountRate("");
                      }}
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      className={`${INPUT} pe-6`}
                      placeholder={b.ratePlaceholder}
                      value={discountRate}
                      onChange={(e) => {
                        setDiscountRate(e.target.value);
                        if (e.target.value) setDiscountAmount("");
                      }}
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-[#74777f] pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Tax rate */}
              <div>
                <label className={LABEL}>{b.taxRateLabel}</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className={`${INPUT} pe-6`}
                    placeholder="0"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-[#74777f] pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Calculated breakdown */}
            <div className="border-t border-[#e3e2e6] pt-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#74777f]">{b.subtotal}</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              {invoiceDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#74777f]">
                    {b.discount}
                    {discountRate && !discountAmount
                      ? ` (${discountRate}%)`
                      : ""}
                  </span>
                  <span className="text-[#0d9488] font-semibold tabular-nums">
                    −{formatCurrency(invoiceDiscount)}
                  </span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#74777f]">{b.tax} ({taxRate}%)</span>
                  <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t border-[#e3e2e6]">
                <span className="text-base font-bold text-[#1a1c1e]">{b.totalAmount}</span>
                <span className="text-xl font-bold text-[#002045] tabular-nums">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              {hasCopay ? (
                <>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-[#e3e2e6]">
                    <span className="text-[#002045] font-semibold">{b.patientShare} ({copayValue}%)</span>
                    <span className="font-bold text-[#ba1a1a] tabular-nums">{formatCurrency(patientShare)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#1960a3] font-semibold">{b.insuranceShare} ({100 - copayValue}%)</span>
                    <span className="font-bold text-[#1960a3] tabular-nums">{formatCurrency(insuranceShare)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#74777f] font-medium">{b.balanceDue}</span>
                  <span className="font-bold text-[#ba1a1a] tabular-nums">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Patient summary (shown after selection) */}
          {selectedPatient ? (
            <div className={`${CARD} p-5`}>
              <h2 className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-4">
                {b.billTo}
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#1960a3] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">
                      {selectedPatient.firstName[0]}
                      {selectedPatient.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1c1e]">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </p>
                    <p className="text-xs font-mono text-[#1960a3]">
                      {selectedPatient.mrn}
                    </p>
                  </div>
                </div>
                {selectedPatient.phone && (
                  <div className="flex items-center gap-2 text-xs text-[#74777f]">
                    <span className="material-symbols-outlined text-[14px]">phone</span>
                    {selectedPatient.phone}
                  </div>
                )}
                {insuranceClaim && insuranceProvider && (
                  <div className="flex items-center gap-2 text-xs text-[#74777f] pt-1 border-t border-[#e3e2e6]">
                    <span className="material-symbols-outlined text-[14px] text-[#1960a3]">
                      health_and_safety
                    </span>
                    <span>
                      {insuranceProvider}
                      {insurancePolicyNo && (
                        <span className="ms-1 text-[#43474e]">
                          #{insurancePolicyNo}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`${CARD} p-5 flex flex-col items-center justify-center gap-2 py-8`}>
              <span className="material-symbols-outlined text-[#c4c6cf] text-3xl">
                person_search
              </span>
              <p className="text-sm text-[#74777f] text-center">
                {b.selectPatientBilling}
              </p>
            </div>
          )}

          {/* Item count summary */}
          {items.some((it) => it.description.trim()) && (
            <div className={`${CARD} p-5`}>
              <h2 className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-3">
                {b.items} ({items.filter((it) => it.description.trim()).length})
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items
                  .filter((it) => it.description.trim())
                  .map((it) => (
                    <div
                      key={it._id}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1a1c1e] truncate">
                          {it.description}
                        </p>
                        <p className="text-[10px] text-[#74777f]">
                          {CAT_LABELS[it.category] ?? it.category} · {it.quantity} ×{" "}
                          {formatCurrency(it.unitPrice)}
                          {it.discount > 0 && ` · ${it.discount}% off`}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[#1a1c1e] tabular-nums shrink-0">
                        {formatCurrency(itemTotal(it))}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Action buttons (repeated at bottom for convenience) */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={saving || savingDraft}
              className="flex items-center justify-center gap-2 bg-[#002045] text-white px-4 py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm transition-opacity w-full"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              )}
              {saving ? b.creatingInvoice : b.createInvoice}
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={savingDraft || saving}
              className="flex items-center justify-center gap-2 border border-[#c4c6cf] bg-white text-[#43474e] px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#f4f3f7] disabled:opacity-50 transition-colors w-full"
            >
              {savingDraft ? (
                <span className="w-4 h-4 border-2 border-[#43474e]/30 border-t-[#43474e] rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">save</span>
              )}
              {savingDraft ? t.common.saving : b.saveAsDraft}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

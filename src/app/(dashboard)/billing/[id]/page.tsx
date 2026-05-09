"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import EditLog from "@/components/layout/EditLog";

const STATUS_BG_TEXT: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: "bg-[#e9e7eb]", text: "text-[#43474e]" },
  PENDING:   { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  PAID:      { bg: "bg-[#ccfbf1]", text: "text-[#0d9488]" },
  PARTIAL:   { bg: "bg-[#ffddba]", text: "text-[#633f0f]" },
  OVERDUE:   { bg: "bg-[#ffdad6]", text: "text-[#ba1a1a]" },
  CANCELLED: { bg: "bg-[#f4f3f7]", text: "text-[#74777f]" },
  REFUNDED:  { bg: "bg-[#d6e3ff]", text: "text-[#002045]" },
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
    DRAFT:     { label: t.billing.statusDraft,      ...STATUS_BG_TEXT.DRAFT },
    PENDING:   { label: t.billing.statusPending,    ...STATUS_BG_TEXT.PENDING },
    PAID:      { label: t.billing.statusPaid,       ...STATUS_BG_TEXT.PAID },
    PARTIAL:   { label: t.billing.statusPartial,    ...STATUS_BG_TEXT.PARTIAL },
    OVERDUE:   { label: t.billing.statusOverdue,    ...STATUS_BG_TEXT.OVERDUE },
    CANCELLED: { label: t.billing.statusCancelled,  ...STATUS_BG_TEXT.CANCELLED },
    REFUNDED:  { label: t.billing.statusRefunded,   ...STATUS_BG_TEXT.REFUNDED },
  };

  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  useEffect(() => {
    fetch(`/api/billing/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setInvoice)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRecordPayment() {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return;
    setRecordingPayment(true);
    try {
      const res = await fetch(`/api/billing/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(paymentAmount), method: paymentMethod }),
      });
      if (res.ok) {
        const updated = await fetch(`/api/billing/${id}`).then((r) => r.json());
        setInvoice(updated);
        setPaymentAmount("");
      }
    } finally {
      setRecordingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">receipt_long</span>
        <p className="text-sm font-semibold text-[#1a1c1e]">{t.billing.invoiceNotFound}</p>
        <button onClick={() => router.push("/billing")} className="text-sm text-[#1960a3] hover:underline">
          {t.billing.backToBilling}
        </button>
      </div>
    );
  }

  const st = STATUS_STYLES[invoice.status as string] ?? STATUS_STYLES.PENDING;
  const items = (invoice.items as Record<string, unknown>[]) ?? [];
  const payments = (invoice.payments as Record<string, unknown>[]) ?? [];
  const patient = invoice.patient as Record<string, unknown> | null;
  const balance = Number(invoice.balance ?? 0);
  const copayPct = invoice.insuranceCopayPercent != null ? Number(invoice.insuranceCopayPercent) : null;
  const patientShare = invoice.patientShare != null ? Number(invoice.patientShare) : null;
  const insuranceShare = invoice.insuranceShare != null ? Number(invoice.insuranceShare) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/billing")}
          className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors"
          aria-label={t.billing.backToBilling}
        >
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.billing.invoice} {invoice.invoiceNo as string}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{t.billing.createdLabel} {formatDate(invoice.createdAt as string)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
          <button
            onClick={() => window.open(`/print/invoice/${id}`, "_blank")}
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            {t.billing.print}
          </button>
        </div>
      </div>

      {/* Patient info */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
        <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{t.billing.patientInformation}</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[#74777f]">{t.billing.patient}</p>
            {patient ? (
              <button
                onClick={() => router.push(`/patients/${patient.id as string}`)}
                className="text-sm font-semibold text-[#1960a3] mt-0.5 hover:underline text-start"
              >
                {`${patient.firstName} ${patient.lastName}`}
              </button>
            ) : (
              <p className="text-sm font-semibold text-[#1a1c1e] mt-0.5">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-[#74777f]">{t.billing.mrn}</p>
            <p className="text-sm font-semibold text-[#1a1c1e] mt-0.5">{(patient?.mrn as string) ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[#74777f]">{t.billing.dueDate}</p>
            <p className="text-sm font-semibold text-[#1a1c1e] mt-0.5">
              {invoice.dueDate ? formatDate(invoice.dueDate as string) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e2e6]">
          <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">{t.billing.lineItems}</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              {[
                t.billing.colDescription,
                t.billing.colCategory,
                t.billing.colQty,
                t.billing.colUnitPrice,
                t.billing.colDiscount,
                t.billing.colTotal,
              ].map((h) => (
                <th key={h} className="text-start text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id as string} className="border-b border-[#e3e2e6]">
                <td className="px-5 py-3 text-sm text-[#1a1c1e]">{item.description as string}</td>
                <td className="px-5 py-3 text-xs text-[#74777f]">{item.category as string}</td>
                <td className="px-5 py-3 text-sm text-[#43474e]">{item.quantity as number}</td>
                <td className="px-5 py-3 text-sm text-[#43474e]">{formatCurrency(Number(item.unitPrice))}</td>
                <td className="px-5 py-3 text-sm text-[#ba1a1a]">{item.discount ? `${item.discount}%` : "—"}</td>
                <td className="px-5 py-3 text-sm font-semibold text-[#1a1c1e]">{formatCurrency(Number(item.totalPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 border-t border-[#e3e2e6] space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#74777f]">{t.billing.subtotal}</span>
            <span className="font-semibold">{formatCurrency(Number(invoice.subtotal))}</span>
          </div>
          {Number(invoice.discountAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#74777f]">{t.billing.discount}</span>
              <span className="text-[#ba1a1a] font-semibold">−{formatCurrency(Number(invoice.discountAmount))}</span>
            </div>
          )}
          {Number(invoice.taxAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#74777f]">{t.billing.tax} ({invoice.taxRate as number}%)</span>
              <span className="font-semibold">{formatCurrency(Number(invoice.taxAmount))}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-2 border-t border-[#e3e2e6]">
            <span>{t.billing.total}</span>
            <span>{formatCurrency(Number(invoice.totalAmount))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#0d9488]">{t.billing.amountPaid}</span>
            <span className="text-[#0d9488] font-semibold">{formatCurrency(Number(invoice.paidAmount))}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-[#ba1a1a]">
            <span>{t.billing.balanceDue}</span>
            <span>{formatCurrency(balance)}</span>
          </div>

          {/* Co-pay breakdown */}
          {Boolean(invoice.insuranceClaim) && copayPct != null && patientShare != null && insuranceShare != null && (
            <div className="pt-3 mt-2 border-t border-[#e3e2e6] space-y-2">
              <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">{t.billing.copayBreakdown}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#fff7ed] border border-[#d97706]/20 rounded-xl text-center">
                  <p className="text-[10px] font-semibold text-[#d97706] uppercase tracking-wider mb-0.5">
                    {t.billing.patientShare} ({copayPct}%)
                  </p>
                  <p className="text-lg font-bold text-[#002045]">{formatCurrency(patientShare)}</p>
                </div>
                <div className="p-3 bg-[#eff6ff] border border-[#1960a3]/20 rounded-xl text-center">
                  <p className="text-[10px] font-semibold text-[#1960a3] uppercase tracking-wider mb-0.5">
                    {t.billing.insuranceClaim} ({100 - copayPct}%)
                  </p>
                  <p className="text-lg font-bold text-[#1960a3]">{formatCurrency(insuranceShare)}</p>
                  {invoice.insuranceProvider != null && (
                    <p className="text-[10px] text-[#74777f] mt-0.5">{String(invoice.insuranceProvider)}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record payment */}
      {balance > 0 && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
          <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{t.billing.recordPayment}</h2>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.billing.amountLabel}</label>
              <input
                type="number"
                className="input-field"
                placeholder={`Max: ${balance.toFixed(2)}`}
                value={paymentAmount}
                max={balance}
                min={0.01}
                step={0.01}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{t.billing.methodLabel}</label>
              <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">{t.billing.methodCash}</option>
                <option value="CARD">{t.billing.methodCard}</option>
                <option value="INSURANCE">{t.billing.methodInsurance}</option>
                <option value="BANK_TRANSFER">{t.billing.methodBankTransfer}</option>
                <option value="MOBILE">{t.billing.methodMobile}</option>
              </select>
            </div>
            <button
              onClick={handleRecordPayment}
              disabled={recordingPayment || !paymentAmount}
              className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
            >
              {recordingPayment
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                : <span className="material-symbols-outlined text-[18px]">payments</span>
              }
              {t.billing.recordBtn}
            </button>
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e3e2e6]">
            <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">{t.billing.paymentHistory}</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                {[t.billing.colDate, t.billing.colMethod, t.billing.colReference, t.billing.colAmount].map((h) => (
                  <th key={h} className="text-start text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id as string} className="border-b border-[#e3e2e6] last:border-b-0">
                  <td className="px-5 py-3 text-xs font-mono text-[#74777f]">{formatDateTime(p.paidAt as string)}</td>
                  <td className="px-5 py-3 text-sm text-[#43474e]">{p.method as string}</td>
                  <td className="px-5 py-3 text-xs text-[#74777f]">{(p.referenceNo as string) ?? "—"}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-[#0d9488]">{formatCurrency(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Log */}
      <EditLog entityId={id} />
    </div>
  );
}

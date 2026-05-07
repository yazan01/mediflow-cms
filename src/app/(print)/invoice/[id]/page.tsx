"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type InvoiceData = {
  invoiceNo: string; createdAt: string; dueDate: string | null; status: string;
  subtotal: number; discountAmount: number; taxAmount: number; taxRate: number;
  totalAmount: number; paidAmount: number; balance: number;
  notes: string | null; insuranceProvider: string | null; insurancePolicyNo: string | null;
  patient: { firstName: string; lastName: string; mrn: string; phone: string | null; email: string | null } | null;
  items: { id: string; description: string; category: string; quantity: number; unitPrice: number; totalPrice: number }[];
  payments: { id: string; paidAt: string; method: string; referenceNo: string | null; amount: number }[];
};

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [clinic, setClinic] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/billing/${id}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/settings").then((r) => r.ok ? r.json() : null),
    ]).then(([inv, settings]) => {
      setInvoice(inv);
      setClinic(settings);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!loading && invoice) setTimeout(() => window.print(), 400);
  }, [loading, invoice]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );

  if (!invoice) return (
    <div className="flex items-center justify-center min-h-screen text-red-600">Invoice not found.</div>
  );

  const patient  = invoice.patient;
  const items    = invoice.items ?? [];
  const payments = invoice.payments ?? [];
  const createdAt = invoice.createdAt ? new Date(invoice.createdAt as string).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate as string).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : null;
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const STATUS_COLOR: Record<string, string> = {
    PAID: "color:#0d9488", OVERDUE: "color:#ba1a1a", PARTIAL: "color:#d97706",
    PENDING: "color:#d97706", CANCELLED: "color:#74777f",
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #1a1c1e; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; text-align: left; }
        th { background: #f4f3f7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #43474e; font-weight: 700; }
        tr { border-bottom: 1px solid #e3e2e6; }
      `}</style>

      <div className="max-w-[680px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b-2 border-[#002045] mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#002045]">{clinic?.clinicName || "MediFlow Clinic"}</h1>
            {clinic?.address && <p className="text-xs text-gray-500 mt-0.5">{clinic.address}</p>}
            {clinic?.phone && <p className="text-xs text-gray-500">Tel: {clinic.phone}</p>}
            {clinic?.email && <p className="text-xs text-gray-500">{clinic.email}</p>}
            {clinic?.licenseNumber && <p className="text-xs text-gray-500">License: {clinic.licenseNumber}</p>}
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-[#1960a3] tracking-wide">INVOICE</div>
            <p className="text-lg font-mono font-bold text-[#002045] mt-1">{invoice.invoiceNo as string}</p>
            <p className="text-xs text-gray-500 mt-1">Date: {createdAt}</p>
            {dueDate && <p className="text-xs text-gray-500">Due: {dueDate}</p>}
            <div className="mt-2">
              <span
                className="text-xs font-bold px-2 py-1 rounded"
                style={{ backgroundColor: "#f4f3f7", ...(STATUS_COLOR[invoice.status as string] ? { color: STATUS_COLOR[invoice.status as string].split(":")[1] } : {}) }}
              >
                {invoice.status as string}
              </span>
            </div>
          </div>
        </div>

        {/* Bill to */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Bill To</p>
            {patient ? (
              <>
                <p className="font-bold">{patient.firstName as string} {patient.lastName as string}</p>
                <p className="text-xs text-gray-500">MRN: {patient.mrn as string}</p>
                {patient.phone && <p className="text-xs text-gray-500">Tel: {patient.phone as string}</p>}
                {patient.email && <p className="text-xs text-gray-500">{patient.email as string}</p>}
              </>
            ) : <p className="text-xs text-gray-400">—</p>}
          </div>
          {(invoice.insuranceProvider as string | null) && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Insurance</p>
              <p className="text-sm font-semibold">{invoice.insuranceProvider as string}</p>
              {(invoice.insurancePolicyNo as string | null) && <p className="text-xs text-gray-500">Policy: {invoice.insurancePolicyNo as string}</p>}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="mb-4">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th style={{ textAlign: "center" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit Price</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ fontSize: "13px", fontWeight: 500 }}>{item.description}</td>
                  <td style={{ fontSize: "11px", color: "#74777f" }}>{item.category}</td>
                  <td style={{ textAlign: "center", fontSize: "13px" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", fontSize: "13px" }}>{fmt(item.unitPrice)}</td>
                  <td style={{ textAlign: "right", fontSize: "13px", fontWeight: 600 }}>{fmt(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{fmt(Number(invoice.subtotal))}</span>
            </div>
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="text-red-600">−{fmt(Number(invoice.discountAmount))}</span>
              </div>
            )}
            {Number(invoice.taxAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({invoice.taxRate as number}%)</span>
                <span>{fmt(Number(invoice.taxAmount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-300">
              <span>Total</span>
              <span>{fmt(Number(invoice.totalAmount))}</span>
            </div>
            {Number(invoice.paidAmount) > 0 && (
              <div className="flex justify-between text-sm" style={{ color: "#0d9488" }}>
                <span>Amount Paid</span>
                <span>{fmt(Number(invoice.paidAmount))}</span>
              </div>
            )}
            {Number(invoice.balance) > 0 && (
              <div className="flex justify-between text-sm font-bold" style={{ color: "#ba1a1a" }}>
                <span>Balance Due</span>
                <span>{fmt(Number(invoice.balance))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments */}
        {payments.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">Payment History</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: "11px", color: "#74777f" }}>{new Date(p.paidAt).toLocaleDateString("en-GB")}</td>
                    <td style={{ fontSize: "12px" }}>{p.method}</td>
                    <td style={{ fontSize: "11px", color: "#74777f" }}>{p.referenceNo ?? "—"}</td>
                    <td style={{ textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#0d9488" }}>{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Notes</p>
            <p className="text-xs text-gray-600">{invoice.notes as string}</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Thank you for choosing {clinic?.clinicName || "MediFlow Clinic"}.</p>
          <p className="text-xs text-gray-400 mt-0.5">For inquiries, contact us at {clinic?.phone || ""} {clinic?.email ? `· ${clinic.email}` : ""}</p>
        </div>
      </div>

      <div className="no-print fixed bottom-6 end-6 flex gap-3">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#002045] text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:opacity-90"
        >
          🖨 Print
        </button>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:bg-gray-200"
        >
          ✕ Close
        </button>
      </div>
    </>
  );
}

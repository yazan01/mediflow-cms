"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type InvoiceData = {
  invoiceNo: string; createdAt: string; dueDate: string | null; status: string;
  subtotal: number; discountAmount: number; taxAmount: number; taxRate: number;
  totalAmount: number; paidAmount: number; balance: number;
  notes: string | null; insuranceProvider: string | null; insurancePolicyNo: string | null;
  insuranceCopayPercent: number | null; patientShare: number | null; insuranceShare: number | null;
  branchId: string | null;
  patient: { firstName: string; lastName: string; mrn: string; phone: string | null; email: string | null } | null;
  items: { id: string; description: string; category: string; quantity: number; unitPrice: number; discount: number; totalPrice: number }[];
  payments: { id: string; paidAt: string; method: string; referenceNo: string | null; amount: number }[];
};

type BranchData = {
  name: string; address: string; phone: string; email: string;
  logo: string; primaryColor: string; invoiceFooter: string;
};

type ClinicSettings = { clinicName: string; address: string; phone: string; email: string; licenseNumber: string };

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/billing/${id}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/settings").then((r) => r.ok ? r.json() : null),
    ]).then(([inv, settings]) => {
      setInvoice(inv);
      setClinic(settings);
      if (inv?.branchId) {
        fetch(`/api/branches/${inv.branchId}`)
          .then((r) => r.ok ? r.json() : null)
          .then((b) => { setBranch(b); setLoading(false); });
      } else {
        setLoading(false);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!loading && invoice) {
      setTimeout(() => {
        if (window.self === window.top) {
          window.print();
        } else {
          window.parent.postMessage({ type: "mediflow-ready-to-print" }, window.location.origin);
        }
      }, 400);
    }
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
  const createdAt = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
  const dueDate   = invoice.dueDate   ? new Date(invoice.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : null;
  const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const brandColor = branch?.primaryColor || "#1960a3";
  const clinicName = branch?.name || clinic?.clinicName || "MediFlow Clinic";
  const address    = branch?.address || clinic?.address || "";
  const phone      = branch?.phone   || clinic?.phone   || "";
  const email      = branch?.email   || clinic?.email   || "";
  const license    = clinic?.licenseNumber || "";
  const footer     = branch?.invoiceFooter || "";
  const logo       = branch?.logo || "";

  const STATUS_COLOR: Record<string, string> = {
    PAID: "#0d9488", OVERDUE: "#ba1a1a", PARTIAL: "#d97706",
    PENDING: "#d97706", CANCELLED: "#74777f",
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #1a1c1e; background: white; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; text-align: left; }
        th { background: #f4f3f7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #43474e; font-weight: 700; }
        tr { border-bottom: 1px solid #e3e2e6; }
      `}</style>

      <div className="max-w-[700px] mx-auto px-6 py-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between pb-5 mb-6" style={{ borderBottom: `2.5px solid ${brandColor}` }}>
          <div className="flex items-center gap-4">
            {logo ? (
              <img src={logo} alt={clinicName} className="h-16 w-auto object-contain" />
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                style={{ background: brandColor }}>
                {clinicName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#002045" }}>{clinicName}</h1>
              {address  && <p className="text-xs text-gray-500 mt-0.5">{address}</p>}
              {phone    && <p className="text-xs text-gray-500">Tel: {phone}</p>}
              {email    && <p className="text-xs text-gray-500">{email}</p>}
              {license  && <p className="text-xs text-gray-500">License: {license}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-wide" style={{ color: brandColor }}>INVOICE</div>
            <p className="text-lg font-mono font-bold mt-1" style={{ color: "#002045" }}>{invoice.invoiceNo}</p>
            <p className="text-xs text-gray-500 mt-1">Date: {createdAt}</p>
            {dueDate && <p className="text-xs text-gray-500">Due: {dueDate}</p>}
            <div className="mt-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#f4f3f7", color: STATUS_COLOR[invoice.status] || "#1a1c1e" }}>
                {invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* ── Bill To / Insurance ── */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1.5">Bill To</p>
            {patient ? (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-bold text-[#1a1c1e]">{patient.firstName} {patient.lastName}</p>
                <p className="text-xs text-gray-500 mt-0.5">MRN: {patient.mrn}</p>
                {patient.phone && <p className="text-xs text-gray-500">Tel: {patient.phone}</p>}
                {patient.email && <p className="text-xs text-gray-500">{patient.email}</p>}
              </div>
            ) : <p className="text-xs text-gray-400">—</p>}
          </div>
          {invoice.insuranceProvider && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1.5">Insurance</p>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-[#002045]">{invoice.insuranceProvider}</p>
                {invoice.insurancePolicyNo && <p className="text-xs text-gray-500">Policy: {invoice.insurancePolicyNo}</p>}
                {invoice.insuranceCopayPercent != null && (
                  <p className="text-xs text-gray-500">Patient share: {invoice.insuranceCopayPercent}%</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Line Items ── */}
        <div className="mb-5">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th style={{ textAlign: "center" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit Price</th>
                <th style={{ textAlign: "right" }}>Discount</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{item.description}</td>
                  <td style={{ fontSize: "11px", color: "#74777f" }}>{item.category}</td>
                  <td style={{ textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>{fmt(item.unitPrice)}</td>
                  <td style={{ textAlign: "right", color: "#ba1a1a" }}>{item.discount ? `${item.discount}%` : "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals ── */}
        <div className="flex justify-end mb-6">
          <div style={{ width: 280 }} className="space-y-1.5 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{fmt(Number(invoice.subtotal))}</span>
            </div>
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span style={{ color: "#ba1a1a" }}>−{fmt(Number(invoice.discountAmount))}</span>
              </div>
            )}
            {Number(invoice.taxAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({invoice.taxRate}%)</span>
                <span>{fmt(Number(invoice.taxAmount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2" style={{ borderTop: "1px solid #e3e2e6" }}>
              <span>Total</span>
              <span>{fmt(Number(invoice.totalAmount))}</span>
            </div>
            {invoice.insuranceCopayPercent != null && invoice.patientShare != null && (
              <>
                <div className="flex justify-between text-sm" style={{ color: "#0d9488" }}>
                  <span>Patient Share</span>
                  <span>{fmt(Number(invoice.patientShare))}</span>
                </div>
                {invoice.insuranceShare != null && (
                  <div className="flex justify-between text-sm" style={{ color: brandColor }}>
                    <span>Insurance Share</span>
                    <span>{fmt(Number(invoice.insuranceShare))}</span>
                  </div>
                )}
              </>
            )}
            {Number(invoice.paidAmount) > 0 && (
              <div className="flex justify-between text-sm" style={{ color: "#0d9488" }}>
                <span>Amount Paid</span>
                <span>{fmt(Number(invoice.paidAmount))}</span>
              </div>
            )}
            {Number(invoice.balance) > 0 && (
              <div className="flex justify-between text-sm font-bold pt-1" style={{ color: "#ba1a1a", borderTop: "1px solid #e3e2e6" }}>
                <span>Balance Due</span>
                <span>{fmt(Number(invoice.balance))}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Payment History ── */}
        {payments.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">Payment History</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Method</th><th>Reference</th>
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

        {/* ── Notes ── */}
        {invoice.notes && (
          <div className="mb-5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Notes</p>
            <p className="text-xs text-gray-600">{invoice.notes}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="pt-4 border-t border-gray-200 text-center">
          {footer ? (
            <p className="text-xs text-gray-500">{footer}</p>
          ) : (
            <>
              <p className="text-xs text-gray-400">Thank you for choosing {clinicName}.</p>
              {(phone || email) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  For inquiries: {phone}{email ? ` · ${email}` : ""}
                </p>
              )}
            </>
          )}
          <p className="text-[10px] text-gray-300 mt-2">Printed {new Date().toLocaleDateString("en-GB")}</p>
        </div>
      </div>

      {/* ── Floating buttons (hidden on print) ── */}
      <div className="no-print fixed bottom-6 end-6 flex gap-3">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:opacity-90"
          style={{ background: brandColor }}>
          <span className="text-lg">🖨</span> Print
        </button>
        <button onClick={() => window.close()}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:bg-gray-200">
          ✕ Close
        </button>
      </div>
    </>
  );
}

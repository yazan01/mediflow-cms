"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type LabResult = {
  id: string; testName: string; value: string; unit: string | null;
  referenceRange: string | null; isAbnormal: boolean; isCritical: boolean;
  recordedAt: string | null;
};

type LabOrderData = {
  id: string; createdAt: string; patientId: string;
  patientName: string; mrn: string;
  tests: string[]; priority: string; status: string;
  specimenType: string | null; specimenCollected: boolean;
  collectedAt: string | null; notes: string | null;
  orderedBy: string; results: LabResult[];
  branchId: string | null;
};

type BranchData = { name: string; address: string; phone: string; email: string; logo: string; primaryColor: string; invoiceFooter: string };
type ClinicSettings = { clinicName: string; phone: string; address: string; licenseNumber: string };

const PRIORITY_COLOR: Record<string, string> = {
  STAT: "#ba1a1a", URGENT: "#d97706", ROUTINE: "#0d9488",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_COLLECTION: "Pending Collection", IN_PROGRESS: "In Progress",
  RESULTS_READY: "Results Ready", RESULTS_RELEASED: "Results Released", CANCELLED: "Cancelled",
};

export default function LabOrderPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder]   = useState<LabOrderData | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/laboratory/${id}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/settings").then((r) => r.ok ? r.json() : null),
    ]).then(([lab, settings]) => {
      setOrder(lab);
      setClinic(settings);
      if (lab?.branchId) {
        fetch(`/api/branches/${lab.branchId}`)
          .then((r) => r.ok ? r.json() : null)
          .then((b) => { setBranch(b); setLoading(false); });
      } else {
        setLoading(false);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!loading && order) setTimeout(() => window.print(), 400);
  }, [loading, order]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
  if (!order) return (
    <div className="flex items-center justify-center min-h-screen text-red-600">Lab order not found.</div>
  );

  const today      = new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const brandColor = branch?.primaryColor || "#1960a3";
  const clinicName = branch?.name || clinic?.clinicName || "MediFlow Clinic";
  const address    = branch?.address || clinic?.address || "";
  const phone      = branch?.phone   || clinic?.phone   || "";
  const license    = clinic?.licenseNumber || "";
  const logo       = branch?.logo || "";
  const hasResults = order.results && order.results.length > 0;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #1a1c1e; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; text-align: left; }
        th { background: #f4f3f7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #43474e; font-weight: 700; }
        tr { border-bottom: 1px solid #e3e2e6; }
      `}</style>

      <div className="max-w-[680px] mx-auto px-6 py-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between pb-4 mb-5" style={{ borderBottom: `2.5px solid ${brandColor}` }}>
          <div className="flex items-center gap-4">
            {logo ? (
              <img src={logo} alt={clinicName} className="h-14 w-auto object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                style={{ background: brandColor }}>
                {clinicName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#002045" }}>{clinicName}</h1>
              {address && <p className="text-xs text-gray-500 mt-0.5">{address}</p>}
              {phone   && <p className="text-xs text-gray-500">Tel: {phone}</p>}
              {license && <p className="text-xs text-gray-500">License: {license}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-wide" style={{ color: brandColor }}>LAB REPORT</div>
            <p className="text-xs text-gray-500 mt-1">Date: {today}</p>
            <p className="text-xs text-gray-500">Ref: {id.slice(-8).toUpperCase()}</p>
            <div className="mt-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#f4f3f7", color: PRIORITY_COLOR[order.priority] || "#1a1c1e" }}>
                {order.priority}
              </span>
            </div>
          </div>
        </div>

        {/* ── Patient + Doctor ── */}
        <div className="grid grid-cols-2 gap-4 mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Patient</p>
            <p className="font-bold">{order.patientName}</p>
            <p className="text-xs text-gray-500">MRN: {order.mrn}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Ordered By</p>
            <p className="font-bold">Dr. {order.orderedBy}</p>
            <p className="text-xs text-gray-500">Status: {STATUS_LABEL[order.status] ?? order.status}</p>
          </div>
        </div>

        {/* ── Specimen Info ── */}
        {(order.specimenType || order.specimenCollected) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-[10px] font-bold uppercase text-blue-700 tracking-wider mb-1">Specimen</p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-700">
              {order.specimenType && <span><strong>Type:</strong> {order.specimenType}</span>}
              <span><strong>Collected:</strong> {order.specimenCollected ? "Yes" : "No"}</span>
              {order.collectedAt && (
                <span><strong>At:</strong> {new Date(order.collectedAt).toLocaleDateString("en-GB")}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Requested Tests ── */}
        {order.tests && order.tests.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">Requested Tests</p>
            <div className="flex flex-wrap gap-2">
              {order.tests.map((test, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "#f0f4ff", color: "#002045" }}>
                  {test}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">Test Results</p>
          {!hasResults ? (
            <p className="text-sm text-gray-400 italic">Results not yet available.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Result</th>
                  <th>Unit</th>
                  <th>Reference Range</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {order.results.map((r) => (
                  <tr key={r.id} style={r.isCritical ? { background: "#fff1f0" } : r.isAbnormal ? { background: "#fffbeb" } : {}}>
                    <td style={{ fontWeight: 500 }}>{r.testName}</td>
                    <td style={{
                      fontWeight: 600,
                      color: r.isCritical ? "#ba1a1a" : r.isAbnormal ? "#d97706" : "#0d9488",
                    }}>{r.value}</td>
                    <td style={{ fontSize: "11px", color: "#74777f" }}>{r.unit ?? "—"}</td>
                    <td style={{ fontSize: "11px", color: "#74777f" }}>{r.referenceRange ?? "—"}</td>
                    <td>
                      {r.isCritical && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#ffdad6", color: "#ba1a1a" }}>CRITICAL</span>
                      )}
                      {!r.isCritical && r.isAbnormal && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#fff7ed", color: "#d97706" }}>ABNORMAL</span>
                      )}
                      {!r.isCritical && !r.isAbnormal && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#ccfbf1", color: "#0d9488" }}>NORMAL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Notes ── */}
        {order.notes && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Notes</p>
            <p className="text-xs text-gray-600">{order.notes}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="pt-4 border-t border-gray-200 flex justify-between items-end mt-6">
          <div>
            <p className="text-xs text-gray-400">Issued by {clinicName}</p>
            <p className="text-[10px] text-gray-300 mt-0.5">Printed {new Date().toLocaleDateString("en-GB")}</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b border-gray-400 mb-1 h-8"></div>
            <p className="text-xs text-gray-500">Laboratory Technician</p>
          </div>
        </div>
      </div>

      {/* ── Floating buttons ── */}
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

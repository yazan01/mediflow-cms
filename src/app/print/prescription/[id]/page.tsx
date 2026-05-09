"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
  AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
};

type ConsultationData = {
  id: string; createdAt: string; chiefComplaint: string | null; branchId: string | null;
  patient: { firstName: string; lastName: string; mrn: string; dateOfBirth: string | null; gender: string; phone: string; bloodType: string | null; allergies: string[] } | null;
  doctor: { name: string; specialization: string; licenseNumber: string | null };
  diagnoses: { icdCode: string; description: string; type: string }[];
  prescriptions: { id: string; medicationName: string; dosage: string; frequency: string; duration: string; quantity: number | null; instructions: string | null }[];
};

type BranchData = { name: string; address: string; phone: string; email: string; logo: string; primaryColor: string; invoiceFooter: string };
type ClinicSettings = { clinicName: string; phone: string; address: string; licenseNumber: string };

export default function PrescriptionPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData]     = useState<ConsultationData | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/consultations/${id}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/settings").then((r) => r.ok ? r.json() : null),
    ]).then(([consult, settings]) => {
      setData(consult);
      setClinic(settings);
      if (consult?.branchId) {
        fetch(`/api/branches/${consult.branchId}`)
          .then((r) => r.ok ? r.json() : null)
          .then((b) => { setBranch(b); setLoading(false); });
      } else {
        setLoading(false);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => {
        if (window.self === window.top) {
          window.print();
        } else {
          window.parent.postMessage({ type: "mediflow-ready-to-print" }, window.location.origin);
        }
      }, 400);
    }
  }, [loading, data]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen text-red-600">Consultation not found.</div>
  );

  const patient    = data.patient;
  const today      = new Date(data.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const brandColor = branch?.primaryColor || "#1960a3";
  const clinicName = branch?.name || clinic?.clinicName || "MediFlow Clinic";
  const address    = branch?.address || clinic?.address || "";
  const phone      = branch?.phone   || clinic?.phone   || "";
  const logo       = branch?.logo || "";
  const license    = clinic?.licenseNumber || "";

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #1a1c1e; background: white; }
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
            <div className="text-xl font-bold tracking-wide" style={{ color: brandColor }}>PRESCRIPTION</div>
            <p className="text-xs text-gray-500 mt-1">Date: {today}</p>
            <p className="text-xs text-gray-500">Ref: {id.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        {/* ── Patient + Doctor ── */}
        <div className="grid grid-cols-2 gap-4 mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Patient</p>
            <p className="font-bold">{patient?.firstName} {patient?.lastName}</p>
            <p className="text-xs text-gray-500">MRN: {patient?.mrn}</p>
            {patient?.dateOfBirth && <p className="text-xs text-gray-500">DOB: {new Date(patient.dateOfBirth).toLocaleDateString("en-GB")}</p>}
            <p className="text-xs text-gray-500">{patient?.gender}</p>
            {patient?.phone && <p className="text-xs text-gray-500">Tel: {patient.phone}</p>}
            {patient?.bloodType && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                {BLOOD_LABELS[patient.bloodType] ?? patient.bloodType}
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Prescribing Physician</p>
            <p className="font-bold">Dr. {data.doctor.name}</p>
            <p className="text-xs text-gray-500">{data.doctor.specialization}</p>
            {data.doctor.licenseNumber && <p className="text-xs text-gray-500">License: {data.doctor.licenseNumber}</p>}
          </div>
        </div>

        {/* ── Chief Complaint ── */}
        {data.chiefComplaint && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Chief Complaint</p>
            <p className="text-sm">{data.chiefComplaint}</p>
          </div>
        )}

        {/* ── Diagnoses ── */}
        {data.diagnoses.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">Diagnoses (ICD-10)</p>
            <div className="space-y-1">
              {data.diagnoses.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                    style={{ background: "#002045" }}>{d.icdCode}</span>
                  <p className="text-sm">{d.description}</p>
                  <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">{d.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Allergy warning ── */}
        {patient?.allergies && patient.allergies.length > 0 && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">⚠ Allergies: </span>
            <span className="text-xs text-red-700">{patient.allergies.join(", ")}</span>
          </div>
        )}

        {/* ── Rx ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl font-bold italic" style={{ color: "#002045" }}>℞</span>
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Medications</p>
          </div>
          {data.prescriptions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No medications prescribed.</p>
          ) : (
            <div className="space-y-3">
              {data.prescriptions.map((rx, i) => (
                <div key={rx.id} className="p-3 border border-gray-200 rounded-lg">
                  <p className="font-bold">{i + 1}. {rx.medicationName}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-600">
                    <span><strong>Dose:</strong> {rx.dosage}</span>
                    <span><strong>Freq:</strong> {rx.frequency}</span>
                    <span><strong>Duration:</strong> {rx.duration}</span>
                    {rx.quantity && <span><strong>Qty:</strong> {rx.quantity}</span>}
                  </div>
                  {rx.instructions && <p className="text-xs text-gray-500 mt-1 italic">{rx.instructions}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Signature ── */}
        <div className="flex justify-between items-end mt-8 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-400">Valid for 30 days from date of issue.</p>
            <p className="text-xs text-gray-400 mt-0.5">Issued by {clinicName}</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b border-gray-400 mb-1 h-8"></div>
            <p className="text-xs text-gray-500">Dr. {data.doctor.name}</p>
            <p className="text-[10px] text-gray-400">{data.doctor.specialization}</p>
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

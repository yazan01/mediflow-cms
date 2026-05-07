"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate, formatDateTime, getInitials } from "@/lib/utils";
import type { Patient, Consultation, LabOrder, Vitals, Prescription } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
  AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
};

const LAB_STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  PENDING_COLLECTION: { label: "Pending Collection", bg: "bg-[#e9e7eb]",  text: "text-[#43474e]" },
  IN_PROGRESS:        { label: "In Progress",        bg: "bg-[#d3e4ff]",  text: "text-[#00477f]" },
  RESULTS_READY:      { label: "Results Ready",      bg: "bg-[#ccfbf1]",  text: "text-[#0d9488]" },
  CANCELLED:          { label: "Cancelled",          bg: "bg-[#ffdad6]",  text: "text-[#ba1a1a]" },
};

const PRIORITY_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  ROUTINE: { label: "Routine", bg: "bg-[#e9e7eb]", text: "text-[#43474e]" },
  URGENT:  { label: "Urgent",  bg: "bg-[#ffddba]", text: "text-[#633f0f]" },
  STAT:    { label: "STAT",    bg: "bg-[#ffdad6]", text: "text-[#ba1a1a]" },
};

type RadiologyOrder = {
  id: string; modality: string; study: string; bodyPart: string;
  priority: string; status: string; report: string | null; createdAt: string;
};

type EMRData = {
  patient: Patient;
  consultations: Consultation[];
  vitals: Vitals[];
  labOrders: LabOrder[];
  radiologyOrders: RadiologyOrder[];
};

type Tab = "consultations" | "vitals" | "labs" | "radiology" | "documents" | "prescriptions";

export default function EMRPage() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id as string;

  const [emr, setEmr] = useState<EMRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("consultations");
  const [expandedConsult, setExpandedConsult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchEMR = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/emr/${id}`);
      if (!res.ok) throw new Error("Failed to load EMR");
      const data = await res.json();
      setEmr(data.data ?? data);
    } catch {
      setError("Failed to load patient EMR. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEMR();
  }, [fetchEMR]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "consultations",  label: t.emr.consultations,     icon: "clinical_notes" },
    { key: "vitals",         label: t.emr.vitals,            icon: "monitor_heart" },
    { key: "labs",           label: t.emr.labOrders,         icon: "science" },
    { key: "radiology",      label: t.emr.radiologyOrders,   icon: "image_search" },
    { key: "documents",      label: t.emr.documents,         icon: "folder_open" },
    { key: "prescriptions",  label: t.emr.prescriptions,     icon: "medication" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-10 h-10 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
        <p className="text-sm text-[#74777f]">{t.common.loading}</p>
      </div>
    );
  }

  if (error || !emr) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-16 h-16 bg-[#ffdad6] rounded-2xl flex items-center justify-center">
          <span className="material-symbols-outlined text-[#ba1a1a] text-3xl">error</span>
        </div>
        <p className="text-sm font-semibold text-[#1a1c1e]">{error || "Patient not found"}</p>
        <Link href="/patients" className="text-sm text-[#1960a3] font-semibold hover:underline">
          Back to Patients
        </Link>
      </div>
    );
  }

  const { patient, consultations = [], vitals = [], labOrders = [], radiologyOrders = [] } = emr;
  const allPrescriptions: (Prescription & { consultDate?: string })[] = consultations.flatMap((c) =>
    (c.prescriptions ?? []).map((rx) => ({ ...rx, consultDate: c.createdAt }))
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#74777f]">
        <Link href="/patients" className="hover:text-[#1960a3] transition-colors">{t.nav.patients}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href={`/patients/${id}`} className="hover:text-[#1960a3] transition-colors">{patient.firstName} {patient.lastName}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-[#1a1c1e] font-semibold">{t.nav.emr}</span>
      </div>

      {/* Patient Header */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          {/* Avatar + Identity */}
          <div className="flex items-center gap-4">
            {patient.photo ? (
              <img
                src={patient.photo}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#e3e2e6] flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#002045] text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                {getInitials(`${patient.firstName} ${patient.lastName}`)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-[#1a1c1e]">{patient.firstName} {patient.lastName}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs font-mono font-semibold text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded border border-[#e3e2e6]">
                  {t.patients.mrn}: {patient.mrn}
                </span>
                <span className="text-xs text-[#74777f]">
                  {patient.gender === "MALE" ? t.patients.male : t.patients.female}
                  {patient.dateOfBirth && ` · ${t.patients.dob}: ${formatDate(patient.dateOfBirth)}`}
                </span>
                {patient.bloodType && (
                  <span className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] px-2 py-1 rounded">
                    {BLOOD_LABELS[patient.bloodType] ?? patient.bloodType}
                  </span>
                )}
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    patient.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#e3e2e6] text-[#74777f]"
                  }`}
                >
                  {patient.isActive ? t.emr.activePatient : t.emr.inactivePatient}
                </span>
              </div>
            </div>
          </div>

          {/* Clinical chips */}
          <div className="lg:ml-6 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Allergies */}
            <div className="p-3 bg-[#fff8f7] border border-[#ffdad6] rounded-xl">
              <p className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                {t.patients.allergies}
              </p>
              {patient.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {patient.allergies.map((a, i) => (
                    <span key={i} className="text-xs bg-[#ffdad6] text-[#93000a] px-2 py-0.5 rounded-full font-semibold">
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#74777f]">No known allergies</p>
              )}
            </div>

            {/* Chronic Conditions */}
            <div className="p-3 bg-[#eff6ff] border border-[#1960a3]/20 rounded-xl">
              <p className="text-xs font-bold text-[#1960a3] uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">symptoms</span>
                {t.patients.conditions}
              </p>
              {patient.chronicConditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {patient.chronicConditions.map((c, i) => (
                    <span key={i} className="text-xs bg-[#d3e4ff] text-[#00477f] px-2 py-0.5 rounded-full font-semibold">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#74777f]">No chronic conditions</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:flex-col lg:items-end flex-shrink-0">
            <Link
              href={`/emr/${id}/new-consultation`}
              className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              New Consultation
            </Link>
            <Link
              href={`/patients/${id}`}
              className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
              Patient Profile
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white border border-[#e3e2e6] rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-[#002045] text-white shadow-sm"
                : "text-[#74777f] hover:text-[#1a1c1e] hover:bg-[#f4f3f7]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {/* ─── CONSULTATIONS ─── */}
      {activeTab === "consultations" && (
        <div className="space-y-4">
          {consultations.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[#74777f] text-3xl">clinical_notes</span>
              </div>
              <p className="text-sm font-semibold text-[#1a1c1e]">{t.emr.noConsultations}</p>
              <p className="text-xs text-[#74777f]">Start the first consultation for this patient</p>
              <Link
                href={`/emr/${id}/new-consultation`}
                className="mt-1 flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                New Consultation
              </Link>
            </div>
          ) : (
            consultations.map((c) => {
              const isOpen = expandedConsult === c.id;
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  {/* Consultation header */}
                  <button
                    onClick={() => setExpandedConsult(isOpen ? null : c.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#faf9fd] transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#eff6ff] rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[#1960a3] text-[20px]">clinical_notes</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1a1c1e]">
                          {c.chiefComplaint ?? "Consultation"}
                        </p>
                        <p className="text-xs text-[#74777f] mt-0.5">
                          {formatDateTime(c.createdAt)}
                          {c.diagnoses.length > 0 && (
                            <> &middot; {c.diagnoses.length} diagnosis{c.diagnoses.length > 1 ? "es" : ""}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.diagnoses.length > 0 && (
                        <div className="flex gap-1 flex-wrap max-w-xs justify-end">
                          {c.diagnoses.slice(0, 3).map((d, i) => (
                            <span key={i} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              d.type === "PRIMARY"
                                ? "bg-[#002045] text-white"
                                : "bg-[#f4f3f7] text-[#43474e]"
                            }`}>
                              {d.icdCode}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className={`material-symbols-outlined text-[20px] text-[#74777f] transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        expand_more
                      </span>
                    </div>
                  </button>

                  {/* SOAP notes expanded */}
                  {isOpen && (
                    <div className="border-t border-[#e3e2e6] p-5 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Chief Complaint */}
                        {c.chiefComplaint && (
                          <SOAPSection icon="report" label={t.emr.chiefComplaint} color="text-[#ba1a1a]">
                            <p className="text-sm text-[#1a1c1e]">{c.chiefComplaint}</p>
                          </SOAPSection>
                        )}
                        {/* HPI */}
                        {c.hpi && (
                          <SOAPSection icon="history" label={t.emr.hpi} color="text-[#1960a3]">
                            <p className="text-sm text-[#1a1c1e] whitespace-pre-wrap">{c.hpi}</p>
                          </SOAPSection>
                        )}
                        {/* Examination */}
                        {c.examination && (
                          <SOAPSection icon="medical_information" label={t.emr.examination} color="text-[#0d9488]">
                            <p className="text-sm text-[#1a1c1e] whitespace-pre-wrap">{c.examination}</p>
                          </SOAPSection>
                        )}
                        {/* Plan */}
                        {c.plan && (
                          <SOAPSection icon="assignment" label={t.emr.plan} color="text-[#633f0f]">
                            <p className="text-sm text-[#1a1c1e] whitespace-pre-wrap">{c.plan}</p>
                          </SOAPSection>
                        )}
                      </div>

                      {/* Diagnoses */}
                      {c.diagnoses.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-[#43474e] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">diagnosis</span>
                            {t.emr.diagnoses} (ICD-10)
                          </p>
                          <div className="space-y-2">
                            {c.diagnoses.map((d, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-[#f4f3f7] rounded-lg">
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg font-mono ${
                                  d.type === "PRIMARY"
                                    ? "bg-[#002045] text-white"
                                    : "bg-[#e9e7eb] text-[#43474e]"
                                }`}>
                                  {d.icdCode}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[#1a1c1e]">{d.description}</p>
                                  <p className="text-xs text-[#74777f]">{d.type === "PRIMARY" ? "Primary" : "Secondary"}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vitals snapshot */}
                      {c.vitals && (
                        <div>
                          <p className="text-xs font-bold text-[#43474e] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">monitor_heart</span>
                            Vitals at Consultation
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <VitalChip label={t.emr.bloodPressure} value={c.vitals.bpSystolic != null && c.vitals.bpDiastolic != null ? `${c.vitals.bpSystolic}/${c.vitals.bpDiastolic}` : undefined} unit="mmHg" />
                            <VitalChip label={t.emr.heartRate} value={c.vitals.heartRate?.toString()} unit="bpm" />
                            <VitalChip label={t.emr.temperature} value={c.vitals.temperature?.toString()} unit="°C" />
                            <VitalChip label={t.emr.spo2} value={c.vitals.spo2?.toString()} unit="%" />
                            <VitalChip label={t.emr.weight} value={c.vitals.weight?.toString()} unit="kg" />
                            <VitalChip label={t.emr.bmi} value={c.vitals.bmi?.toString()} unit="" />
                          </div>
                        </div>
                      )}

                      {/* Prescriptions */}
                      {c.prescriptions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-[#43474e] uppercase tracking-wider flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px]">medication</span>
                              {t.emr.prescriptions}
                            </p>
                            <button
                              onClick={() => window.open(`/print/prescription/${c.id}`, "_blank")}
                              className="flex items-center gap-1 text-[10px] font-semibold text-[#1960a3] border border-[#1960a3]/30 px-2 py-1 rounded-lg hover:bg-[#eff6ff] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[13px]">print</span>
                              Print Rx
                            </button>
                          </div>
                          <div className="space-y-2">
                            {c.prescriptions.map((rx, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-[#f4f3f7] rounded-lg">
                                <span className="material-symbols-outlined text-[#1960a3] text-[20px] flex-shrink-0 mt-0.5">medication</span>
                                <div>
                                  <p className="text-sm font-semibold text-[#1a1c1e]">{rx.medicationName}</p>
                                  <p className="text-xs text-[#74777f]">
                                    {rx.dosage} &middot; {rx.frequency} &middot; {rx.duration}
                                  </p>
                                  {rx.instructions && (
                                    <p className="text-xs text-[#43474e] mt-0.5">{rx.instructions}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-up */}
                      {c.followUpDate && (
                        <div className="flex items-center gap-3 p-3 bg-[#eff6ff] border border-[#1960a3]/20 rounded-lg">
                          <span className="material-symbols-outlined text-[#1960a3] text-[20px]">event</span>
                          <div>
                            <p className="text-xs font-semibold text-[#1960a3]">{t.emr.followUp}</p>
                            <p className="text-sm text-[#1a1c1e]">{formatDate(c.followUpDate)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── VITALS ─── */}
      {activeTab === "vitals" && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {vitals.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[#74777f] text-3xl">monitor_heart</span>
              </div>
              <p className="text-sm font-semibold text-[#1a1c1e]">{t.emr.noVitals}</p>
              <p className="text-xs text-[#74777f]">Vitals are recorded during consultations</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[t.emr.recordedAt, t.emr.bloodPressure, t.emr.heartRate, t.emr.temperature, t.emr.weight, t.emr.bmi, t.emr.spo2, t.emr.bloodGlucose].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((v, i) => (
                    <tr key={i} className="hover:bg-[#f4f3f7] transition-colors">
                      <td className="table-cell font-medium text-[#1a1c1e] whitespace-nowrap">
                        {formatDateTime(v.recordedAt)}
                      </td>
                      <td className="table-cell">
                        {v.bpSystolic != null && v.bpDiastolic != null ? (
                          <span className={`font-semibold ${v.bpSystolic > 140 ? "text-[#ba1a1a]" : "text-[#1a1c1e]"}`}>
                            {v.bpSystolic}/{v.bpDiastolic} mmHg
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">
                        {v.heartRate != null ? (
                          <span className={v.heartRate > 100 || v.heartRate < 60 ? "text-[#ba1a1a] font-semibold" : "text-[#1a1c1e]"}>
                            {v.heartRate} bpm
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">
                        {v.temperature != null ? (
                          <span className={v.temperature > 37.5 ? "text-[#ba1a1a] font-semibold" : "text-[#1a1c1e]"}>
                            {v.temperature}°C
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">{v.weight != null ? `${v.weight} kg` : <span className="text-[#c4c6cf]">—</span>}</td>
                      <td className="table-cell">
                        {v.bmi != null ? (
                          <span className={`font-semibold ${
                            v.bmi >= 30 ? "text-[#ba1a1a]" : v.bmi >= 25 ? "text-[#d97706]" : "text-[#0d9488]"
                          }`}>
                            {v.bmi.toFixed(1)}
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">
                        {v.spo2 != null ? (
                          <span className={v.spo2 < 95 ? "text-[#ba1a1a] font-semibold" : "text-[#1a1c1e]"}>
                            {v.spo2}%
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">
                        {v.bloodGlucose != null ? `${v.bloodGlucose} mg/dL` : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── LAB RESULTS ─── */}
      {activeTab === "labs" && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {labOrders.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[#74777f] text-3xl">science</span>
              </div>
              <p className="text-sm font-semibold text-[#1a1c1e]">{t.emr.noLabOrders}</p>
              <p className="text-xs text-[#74777f]">Lab orders are created during consultations</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["Order ID", "Tests", "Date", "Ordered By", "Priority", "Status", "Actions"].map((h, i) => (
                      <th key={h} className={`table-header ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labOrders.map((order) => {
                    const st = LAB_STATUS_STYLES[order.status] ?? LAB_STATUS_STYLES.PENDING_COLLECTION;
                    const pr = PRIORITY_STYLES[order.priority] ?? PRIORITY_STYLES.ROUTINE;
                    return (
                      <tr key={order.id} className="hover:bg-[#f4f3f7] transition-colors">
                        <td className="table-cell">
                          <span className="text-xs font-mono text-[#43474e] bg-[#f4f3f7] px-2 py-1 rounded">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                        </td>
                        <td className="table-cell max-w-[220px]">
                          <div className="flex flex-wrap gap-1">
                            {order.tests.map((t, i) => (
                              <span key={i} className="text-xs bg-[#f4f3f7] text-[#43474e] px-2 py-0.5 rounded-full border border-[#e3e2e6]">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="table-cell whitespace-nowrap text-[#43474e]">{formatDate(order.date)}</td>
                        <td className="table-cell text-[#43474e]">{order.orderedBy}</td>
                        <td className="table-cell">
                          <span className={`badge ${pr.bg} ${pr.text}`}>{pr.label}</span>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${st.bg} ${st.text}`}>{st.label}</span>
                        </td>
                        <td className="table-cell text-right">
                          <button className="p-1.5 hover:bg-[#d3e4ff] rounded-lg transition-colors text-[#74777f] hover:text-[#1960a3]" title="View Results">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── RADIOLOGY ─── */}
      {activeTab === "radiology" && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {radiologyOrders.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[#74777f] text-3xl">image_search</span>
              </div>
              <p className="text-sm font-semibold text-[#1a1c1e]">{t.emr.noRadiology}</p>
              <p className="text-xs text-[#74777f]">Radiology orders are created during consultations</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["Order ID", "Modality", "Study", "Body Part", "Priority", "Status", "Date"].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {radiologyOrders.map((ro) => (
                    <tr key={ro.id} className="hover:bg-[#f4f3f7] transition-colors">
                      <td className="table-cell"><span className="text-xs font-mono bg-[#f4f3f7] px-2 py-1 rounded">#{ro.id.slice(-8).toUpperCase()}</span></td>
                      <td className="table-cell"><span className="text-xs font-bold bg-[#d3e4ff] text-[#00477f] px-2 py-1 rounded-full">{ro.modality}</span></td>
                      <td className="table-cell text-sm text-[#1a1c1e]">{ro.study}</td>
                      <td className="table-cell text-sm text-[#43474e]">{ro.bodyPart}</td>
                      <td className="table-cell"><span className={`badge ${ro.priority === "STAT" ? "bg-[#ba1a1a] text-white" : ro.priority === "URGENT" ? "bg-[#ffddba] text-[#633f0f]" : "bg-[#f4f3f7] text-[#74777f]"}`}>{ro.priority}</span></td>
                      <td className="table-cell"><span className="badge bg-[#d3e4ff] text-[#00477f]">{ro.status.replace(/_/g, " ")}</span></td>
                      <td className="table-cell text-xs text-[#74777f] whitespace-nowrap">{formatDate(ro.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── PRESCRIPTIONS ─── */}
      {activeTab === "prescriptions" && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {allPrescriptions.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e3e2e6] bg-[#f8f9ff]">
              <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">{t.emr.prescriptions}</p>
              {consultations.length > 0 && consultations[0]?.id && (
                <button
                  onClick={() => window.open(`/print/prescription/${consultations[0].id}`, "_blank")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#1960a3] border border-[#1960a3]/30 px-3 py-1.5 rounded-lg hover:bg-[#eff6ff] transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">print</span>
                  Print Latest Rx
                </button>
              )}
            </div>
          )}
          {allPrescriptions.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[#74777f] text-3xl">medication</span>
              </div>
              <p className="text-sm font-semibold text-[#1a1c1e]">{t.emr.noPrescriptions}</p>
              <p className="text-xs text-[#74777f]">Prescriptions are issued during consultations</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["Medication", "Dosage", "Frequency", "Duration", "Instructions", "Date", "Dispensed"].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPrescriptions.map((rx) => (
                    <tr key={rx.id} className="hover:bg-[#f4f3f7] transition-colors">
                      <td className="table-cell font-semibold text-[#1a1c1e]">{rx.medicationName}</td>
                      <td className="table-cell text-sm text-[#43474e]">{rx.dosage}</td>
                      <td className="table-cell text-sm text-[#43474e]">{rx.frequency}</td>
                      <td className="table-cell text-sm text-[#43474e]">{rx.duration}</td>
                      <td className="table-cell text-xs text-[#74777f] max-w-[180px] truncate">{rx.instructions ?? "—"}</td>
                      <td className="table-cell text-xs text-[#74777f] whitespace-nowrap">{rx.consultDate ? formatDate(rx.consultDate) : "—"}</td>
                      <td className="table-cell">
                        <span className={`badge ${rx.isDispensed ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#e9e7eb] text-[#43474e]"}`}>
                          {rx.isDispensed ? "Dispensed" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── DOCUMENTS ─── */}
      {activeTab === "documents" && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] py-20 flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[#74777f] text-3xl">folder_open</span>
          </div>
          <p className="text-sm font-semibold text-[#1a1c1e]">{t.emr.noDocuments}</p>
          <p className="text-xs text-[#74777f]">Upload patient documents from the profile page</p>
        </div>
      )}
    </div>
  );
}

/* ─── Small reusable sub-components ─── */
function SOAPSection({
  icon,
  label,
  color,
  children,
}: {
  icon: string;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-[#faf9fd] rounded-xl border border-[#e3e2e6]">
      <p className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${color}`}>
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </p>
      {children}
    </div>
  );
}

function VitalChip({ label, value, unit }: { label: string; value?: string; unit: string }) {
  if (!value) return null;
  return (
    <div className="p-3 bg-[#f4f3f7] rounded-lg text-center">
      <p className="text-[10px] text-[#74777f] font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold text-[#1a1c1e] mt-0.5">
        {value}
        {unit && <span className="text-xs font-normal text-[#74777f] ml-1">{unit}</span>}
      </p>
    </div>
  );
}

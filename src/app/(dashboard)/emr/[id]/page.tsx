"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { formatDate, formatDateTime, getInitials, printDocument } from "@/lib/utils";
import type { Patient, Consultation, LabOrder, Vitals, Prescription } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
  AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
};

const LAB_STATUS_CSS: Record<string, { bg: string; text: string }> = {
  PENDING_COLLECTION: { bg: "bg-[#e9e7eb]", text: "text-[var(--txt2)]" },
  IN_PROGRESS:        { bg: "bg-[var(--blue-bg)]", text: "text-[#00477f]" },
  RESULTS_READY:      { bg: "bg-[var(--ok-bg)]", text: "text-[var(--ok)]" },
  CANCELLED:          { bg: "bg-[var(--err-bg)]", text: "text-[var(--err)]" },
};

const PRIORITY_CSS: Record<string, { bg: string; text: string }> = {
  ROUTINE: { bg: "bg-[#e9e7eb]", text: "text-[var(--txt2)]" },
  URGENT:  { bg: "bg-[#ffddba]", text: "text-[#633f0f]" },
  STAT:    { bg: "bg-[var(--err-bg)]", text: "text-[var(--err)]" },
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
  const searchParams = useSearchParams();
  const id = params.id as string;
  const focusConsultationId = searchParams.get("consultation");

  const [emr, setEmr] = useState<EMRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("consultations");
  const [expandedConsult, setExpandedConsult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [labModal, setLabModal] = useState<LabOrder | null>(null);
  const [labModalLoading, setLabModalLoading] = useState(false);

  const labStatusLabel: Record<string, string> = {
    PENDING_COLLECTION: t.laboratory.pendingCollection,
    IN_PROGRESS:        t.laboratory.inProgressStatus,
    RESULTS_READY:      t.laboratory.resultsReadyStatus,
    CANCELLED:          t.laboratory.cancelledStatus,
  };

  const priorityLabel: Record<string, string> = {
    ROUTINE: t.laboratory.routine,
    URGENT:  t.laboratory.urgent,
    STAT:    t.laboratory.stat,
  };

  async function openLabModal(order: LabOrder) {
    setLabModalLoading(true);
    setLabModal(order);
    try {
      const res = await fetch(`/api/laboratory/${order.id}`);
      if (res.ok) setLabModal(await res.json());
    } catch { /* keep existing order data */ }
    finally { setLabModalLoading(false); }
  }

  const fetchEMR = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/emr/${id}`);
      if (!res.ok) throw new Error("Failed to load EMR");
      const data = await res.json();
      setEmr(data.data ?? data);
    } catch {
      setError(t.emr.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [id, t.emr.failedToLoad]);

  useEffect(() => {
    fetchEMR();
  }, [fetchEMR]);

  // Auto-expand consultation from URL param
  useEffect(() => {
    if (focusConsultationId) {
      setExpandedConsult(focusConsultationId);
      setActiveTab("consultations");
    }
  }, [focusConsultationId]);

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
        <p className="text-sm text-[var(--txt2)]">{t.common.loading}</p>
      </div>
    );
  }

  if (error || !emr) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-16 h-16 bg-[var(--err-bg)] rounded-2xl flex items-center justify-center">
          <span className="material-symbols-outlined text-[var(--err)] text-3xl">error</span>
        </div>
        <p className="text-sm font-semibold text-[var(--txt1)]">{error || t.emr.patientNotFound}</p>
        <Link href="/patients" className="text-sm text-[var(--blue)] font-semibold hover:underline">
          {t.emr.backToPatients}
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
      <div className="flex items-center gap-2 text-sm text-[var(--txt2)]">
        <Link href="/patients" className="hover:text-[var(--blue)] transition-colors">{t.nav.patients}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href={`/patients/${id}`} className="hover:text-[var(--blue)] transition-colors">{patient.firstName} {patient.lastName}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-[var(--txt1)] font-semibold">{t.nav.emr}</span>
      </div>

      {/* Patient Header */}
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          {/* Avatar + Identity */}
          <div className="flex items-center gap-4">
            {patient.photo ? (
              <img
                src={patient.photo}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--border)] flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[var(--brand)] text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                {getInitials(`${patient.firstName} ${patient.lastName}`)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-[var(--txt1)]">{patient.firstName} {patient.lastName}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs font-mono font-semibold text-[var(--txt2)] bg-[var(--surface2)] px-2 py-1 rounded border border-[var(--border)]">
                  {t.patients.mrn}: {patient.mrn}
                </span>
                <span className="text-xs text-[var(--txt2)]">
                  {patient.gender === "MALE" ? t.patients.male : t.patients.female}
                  {patient.dateOfBirth && ` · ${t.patients.dob}: ${formatDate(patient.dateOfBirth)}`}
                </span>
                {patient.bloodType && (
                  <span className="text-xs font-bold text-[var(--err)] bg-[var(--err-bg)] px-2 py-1 rounded">
                    {BLOOD_LABELS[patient.bloodType] ?? patient.bloodType}
                  </span>
                )}
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    patient.isActive ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[#e3e2e6] text-[var(--txt2)]"
                  }`}
                >
                  {patient.isActive ? t.emr.activePatient : t.emr.inactivePatient}
                </span>
              </div>
            </div>
          </div>

          {/* Clinical chips */}
          <div className="lg:ms-6 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Allergies */}
            <div className="p-3 bg-[#fff8f7] border border-[#ffdad6] rounded-xl">
              <p className="text-xs font-bold text-[var(--err)] uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                {t.patients.allergies}
              </p>
              {patient.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {patient.allergies.map((a, i) => (
                    <span key={i} className="text-xs bg-[var(--err-bg)] text-[#93000a] px-2 py-0.5 rounded-full font-semibold">
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--txt2)]">{t.emr.noKnownAllergies}</p>
              )}
            </div>

            {/* Chronic Conditions */}
            <div className="p-3 bg-[var(--blue-bg)] border border-[#1960a3]/20 rounded-xl">
              <p className="text-xs font-bold text-[var(--blue)] uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">symptoms</span>
                {t.patients.conditions}
              </p>
              {patient.chronicConditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {patient.chronicConditions.map((c, i) => (
                    <span key={i} className="text-xs bg-[var(--blue-bg)] text-[#00477f] px-2 py-0.5 rounded-full font-semibold">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--txt2)]">{t.emr.noChronicConditions}</p>
              )}
            </div>
          </div>

          {/* Visit count + Actions */}
          <div className="flex items-center gap-2 lg:flex-col lg:items-end flex-shrink-0">
            {/* Visit count badge */}
            {consultations.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[var(--blue-bg)] border border-[#1960a3]/20 px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-[14px] text-[var(--blue)]">history</span>
                <span className="text-xs font-bold text-[var(--blue)]">
                  {consultations.length} {t.emr.visitCount}
                </span>
              </div>
            )}
            <Link
              href={`/emr/${id}/new-consultation`}
              className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {t.emr.newConsultation}
            </Link>
            <Link
              href={`/billing/new?patientId=${id}`}
              className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] text-[var(--txt1)] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[var(--surface2)] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              {t.billing.newInvoice}
            </Link>
            <Link
              href={`/patients/${id}`}
              className="flex items-center gap-2 border border-[var(--border2)] bg-[var(--surface)] text-[var(--txt1)] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[var(--surface2)] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
              {t.emr.patientProfile}
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-[var(--txt2)] hover:text-[var(--txt1)] hover:bg-[var(--surface2)]"
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
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">clinical_notes</span>
              </div>
              <p className="text-sm font-semibold text-[var(--txt1)]">{t.emr.noConsultations}</p>
              <p className="text-xs text-[var(--txt2)]">{t.emr.startFirstConsultation}</p>
              <Link
                href={`/emr/${id}/new-consultation`}
                className="mt-1 flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {t.emr.newConsultation}
              </Link>
            </div>
          ) : (
            consultations.map((c) => {
              const isOpen = expandedConsult === c.id;
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  {/* Consultation header */}
                  <button
                    onClick={() => setExpandedConsult(isOpen ? null : c.id)}
                    className={`w-full flex items-center justify-between px-5 py-4 hover:bg-[#faf9fd] transition-colors text-left ${
                      focusConsultationId === c.id ? "bg-[var(--blue-bg)]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        focusConsultationId === c.id ? "bg-[var(--blue)]" : "bg-[var(--blue-bg)]"
                      }`}>
                        <span className={`material-symbols-outlined text-[20px] ${
                          focusConsultationId === c.id ? "text-white" : "text-[var(--blue)]"
                        }`}>clinical_notes</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--txt1)]">
                          {c.chiefComplaint ?? t.appointments.consultation}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-[var(--txt2)]">
                            {formatDateTime(c.createdAt)}
                            {c.diagnoses.length > 0 && (
                              <> &middot; {c.diagnoses.length} {c.diagnoses.length > 1 ? t.emr.diagnoses_ : t.emr.diagnosis}</>
                            )}
                          </p>
                          {c.appointmentId && (
                            <Link
                              href={`/appointments/${c.appointmentId}`}
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--blue)] bg-[var(--blue-bg)] px-2 py-0.5 rounded-full hover:underline"
                            >
                              <span className="material-symbols-outlined text-[11px]">event</span>
                              {t.emr.linkedAppointment}
                            </Link>
                          )}
                          {c.isLocked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#002045] bg-[var(--blue-bg)] px-2 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[11px]">lock</span>
                              {t.emr.locked}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.diagnoses.length > 0 && (
                        <div className="flex gap-1 flex-wrap max-w-xs justify-end">
                          {c.diagnoses.slice(0, 3).map((d, i) => (
                            <span key={i} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              d.type === "PRIMARY"
                                ? "bg-[var(--brand)] text-white"
                                : "bg-[var(--surface2)] text-[var(--txt2)]"
                            }`}>
                              {d.icdCode}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className={`material-symbols-outlined text-[20px] text-[var(--txt2)] transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        expand_more
                      </span>
                    </div>
                  </button>

                  {/* SOAP notes expanded */}
                  {isOpen && (
                    <div className="border-t border-[var(--border)] p-5 space-y-5">
                      {/* Doctor attribution + action buttons */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-[var(--txt2)]">stethoscope</span>
                          <span className="text-xs font-semibold text-[var(--txt2)]">
                            {t.emr.doctor}: <span className="text-[var(--txt1)]">{c.doctorName || "—"}</span>
                          </span>
                        </div>
                        {!c.isLocked && (
                          <Link
                            href={`/emr/${id}/new-consultation?consultation=${c.id}&appointment=${c.appointmentId ?? ""}`}
                            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)] border border-[#1960a3]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--blue-bg)] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            Edit
                          </Link>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Chief Complaint */}
                        {c.chiefComplaint && (
                          <SOAPSection icon="report" label={t.emr.chiefComplaint} color="text-[var(--err)]">
                            <p className="text-sm text-[var(--txt1)]">{c.chiefComplaint}</p>
                          </SOAPSection>
                        )}
                        {/* HPI */}
                        {c.hpi && (
                          <SOAPSection icon="history" label={t.emr.hpi} color="text-[var(--blue)]">
                            <p className="text-sm text-[var(--txt1)] whitespace-pre-wrap">{c.hpi}</p>
                          </SOAPSection>
                        )}
                        {/* Examination */}
                        {c.examination && (
                          <SOAPSection icon="medical_information" label={t.emr.examination} color="text-[var(--ok)]">
                            <p className="text-sm text-[var(--txt1)] whitespace-pre-wrap">{c.examination}</p>
                          </SOAPSection>
                        )}
                        {/* Plan */}
                        {c.plan && (
                          <SOAPSection icon="assignment" label={t.emr.plan} color="text-[#633f0f]">
                            <p className="text-sm text-[var(--txt1)] whitespace-pre-wrap">{c.plan}</p>
                          </SOAPSection>
                        )}
                      </div>

                      {/* Diagnoses */}
                      {c.diagnoses.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-[var(--txt2)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">diagnosis</span>
                            {t.emr.diagnoses} (ICD-10)
                          </p>
                          <div className="space-y-2">
                            {c.diagnoses.map((d, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-[var(--surface2)] rounded-lg">
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg font-mono ${
                                  d.type === "PRIMARY"
                                    ? "bg-[var(--brand)] text-white"
                                    : "bg-[#e9e7eb] text-[var(--txt2)]"
                                }`}>
                                  {d.icdCode}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[var(--txt1)]">{d.description}</p>
                                  <p className="text-xs text-[var(--txt2)]">{d.type === "PRIMARY" ? t.emr.primaryDx : t.emr.secondaryDx}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vitals snapshot */}
                      {c.vitals && (
                        <div>
                          <p className="text-xs font-bold text-[var(--txt2)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">monitor_heart</span>
                            {t.emr.vitalsAtConsultation}
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
                            <p className="text-xs font-bold text-[var(--txt2)] uppercase tracking-wider flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px]">medication</span>
                              {t.emr.prescriptions}
                            </p>
                            <button
                              onClick={() => printDocument(`/print/prescription/${c.id}`)}
                              className="flex items-center gap-1 text-[10px] font-semibold text-[var(--blue)] border border-[#1960a3]/30 px-2 py-1 rounded-lg hover:bg-[var(--blue-bg)] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[13px]">print</span>
                              {t.emr.printRx}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {c.prescriptions.map((rx, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-[var(--surface2)] rounded-lg">
                                <span className="material-symbols-outlined text-[var(--blue)] text-[20px] flex-shrink-0 mt-0.5">medication</span>
                                <div>
                                  <p className="text-sm font-semibold text-[var(--txt1)]">{rx.medicationName}</p>
                                  <p className="text-xs text-[var(--txt2)]">
                                    {rx.dosage} &middot; {rx.frequency} &middot; {rx.duration}
                                  </p>
                                  {rx.instructions && (
                                    <p className="text-xs text-[var(--txt2)] mt-0.5">{rx.instructions}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-up */}
                      {c.followUpDate && (
                        <div className="flex items-center gap-3 p-3 bg-[var(--blue-bg)] border border-[#1960a3]/20 rounded-lg">
                          <span className="material-symbols-outlined text-[var(--blue)] text-[20px]">event</span>
                          <div>
                            <p className="text-xs font-semibold text-[var(--blue)]">{t.emr.followUp}</p>
                            <p className="text-sm text-[var(--txt1)]">{formatDate(c.followUpDate)}</p>
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
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {vitals.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">monitor_heart</span>
              </div>
              <p className="text-sm font-semibold text-[var(--txt1)]">{t.emr.noVitals}</p>
              <p className="text-xs text-[var(--txt2)]">{t.emr.vitalsRecorded}</p>
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
                    <tr key={i} className="hover:bg-[var(--surface2)] transition-colors">
                      <td className="table-cell font-medium text-[var(--txt1)] whitespace-nowrap">
                        {formatDateTime(v.recordedAt)}
                      </td>
                      <td className="table-cell">
                        {v.bpSystolic != null && v.bpDiastolic != null ? (
                          <span className={`font-semibold ${v.bpSystolic > 140 ? "text-[var(--err)]" : "text-[var(--txt1)]"}`}>
                            {v.bpSystolic}/{v.bpDiastolic} mmHg
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">
                        {v.heartRate != null ? (
                          <span className={v.heartRate > 100 || v.heartRate < 60 ? "text-[var(--err)] font-semibold" : "text-[var(--txt1)]"}>
                            {v.heartRate} bpm
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">
                        {v.temperature != null ? (
                          <span className={v.temperature > 37.5 ? "text-[var(--err)] font-semibold" : "text-[var(--txt1)]"}>
                            {v.temperature}°C
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">{v.weight != null ? `${v.weight} kg` : <span className="text-[#c4c6cf]">—</span>}</td>
                      <td className="table-cell">
                        {v.bmi != null ? (
                          <span className={`font-semibold ${
                            v.bmi >= 30 ? "text-[var(--err)]" : v.bmi >= 25 ? "text-[var(--warn)]" : "text-[var(--ok)]"
                          }`}>
                            {v.bmi.toFixed(1)}
                          </span>
                        ) : <span className="text-[#c4c6cf]">—</span>}
                      </td>
                      <td className="table-cell">
                        {v.spo2 != null ? (
                          <span className={v.spo2 < 95 ? "text-[var(--err)] font-semibold" : "text-[var(--txt1)]"}>
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
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {labOrders.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">science</span>
              </div>
              <p className="text-sm font-semibold text-[var(--txt1)]">{t.emr.noLabOrders}</p>
              <p className="text-xs text-[var(--txt2)]">{t.emr.labsCreated}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[
                      t.laboratory.orderId,
                      t.laboratory.tests,
                      t.laboratory.date,
                      t.laboratory.orderedBy,
                      t.laboratory.priority,
                      t.laboratory.status,
                      t.laboratory.actions,
                    ].map((h, i) => (
                      <th key={h} className={`table-header ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labOrders.map((order) => {
                    const stCss = LAB_STATUS_CSS[order.status] ?? LAB_STATUS_CSS.PENDING_COLLECTION;
                    const prCss = PRIORITY_CSS[order.priority] ?? PRIORITY_CSS.ROUTINE;
                    const stLabel = labStatusLabel[order.status] ?? order.status;
                    const prLabel = priorityLabel[order.priority] ?? order.priority;
                    return (
                      <tr key={order.id} className="hover:bg-[var(--surface2)] transition-colors">
                        <td className="table-cell">
                          <span className="text-xs font-mono text-[var(--txt2)] bg-[var(--surface2)] px-2 py-1 rounded">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                        </td>
                        <td className="table-cell max-w-[220px]">
                          <div className="flex flex-wrap gap-1">
                            {order.tests.map((test, i) => (
                              <span key={i} className="text-xs bg-[var(--surface2)] text-[var(--txt2)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                                {test}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="table-cell whitespace-nowrap text-[var(--txt2)]">{formatDate(order.date)}</td>
                        <td className="table-cell text-[var(--txt2)]">{order.orderedBy}</td>
                        <td className="table-cell">
                          <span className={`badge ${prCss.bg} ${prCss.text}`}>{prLabel}</span>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${stCss.bg} ${stCss.text}`}>{stLabel}</span>
                        </td>
                        <td className="table-cell text-right">
                          <button
                            onClick={() => openLabModal(order)}
                            className="p-1.5 hover:bg-[var(--blue-bg)] rounded-lg transition-colors text-[var(--txt2)] hover:text-[var(--blue)]"
                            aria-label={t.emr.viewResults}
                            title={t.emr.viewResults}
                          >
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
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {radiologyOrders.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">image_search</span>
              </div>
              <p className="text-sm font-semibold text-[var(--txt1)]">{t.emr.noRadiology}</p>
              <p className="text-xs text-[var(--txt2)]">{t.emr.radiologyCreated}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[
                      t.radiology.orderId,
                      t.radiology.modality,
                      t.emr.study,
                      t.emr.bodyPart,
                      t.radiology.priority,
                      t.radiology.status,
                      t.common.date,
                    ].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {radiologyOrders.map((ro) => (
                    <tr key={ro.id} className="hover:bg-[var(--surface2)] transition-colors">
                      <td className="table-cell"><span className="text-xs font-mono bg-[var(--surface2)] px-2 py-1 rounded">#{ro.id.slice(-8).toUpperCase()}</span></td>
                      <td className="table-cell"><span className="text-xs font-bold bg-[var(--blue-bg)] text-[#00477f] px-2 py-1 rounded-full">{ro.modality}</span></td>
                      <td className="table-cell text-sm text-[var(--txt1)]">{ro.study}</td>
                      <td className="table-cell text-sm text-[var(--txt2)]">{ro.bodyPart}</td>
                      <td className="table-cell">
                        <span className={`badge ${priorityLabel[ro.priority] ? PRIORITY_CSS[ro.priority]?.bg ?? "bg-[var(--surface2)]" : "bg-[var(--surface2)]"} ${priorityLabel[ro.priority] ? PRIORITY_CSS[ro.priority]?.text ?? "text-[var(--txt2)]" : "text-[var(--txt2)]"}`}>
                          {priorityLabel[ro.priority] ?? ro.priority}
                        </span>
                      </td>
                      <td className="table-cell"><span className="badge bg-[var(--blue-bg)] text-[#00477f]">{ro.status.replace(/_/g, " ")}</span></td>
                      <td className="table-cell text-xs text-[var(--txt2)] whitespace-nowrap">{formatDate(ro.createdAt)}</td>
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
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {allPrescriptions.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[#f8f9ff]">
              <p className="text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider">{t.emr.prescriptions}</p>
              {consultations.length > 0 && consultations[0]?.id && (
                <button
                  onClick={() => printDocument(`/print/prescription/${consultations[0].id}`)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)] border border-[#1960a3]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--blue-bg)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">print</span>
                  {t.emr.printLatestRx}
                </button>
              )}
            </div>
          )}
          {allPrescriptions.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">medication</span>
              </div>
              <p className="text-sm font-semibold text-[var(--txt1)]">{t.emr.noPrescriptions}</p>
              <p className="text-xs text-[var(--txt2)]">{t.emr.prescriptionsCreated}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[
                      t.pharmacy.medication,
                      t.emr.dosage,
                      t.emr.frequency,
                      t.emr.rxDuration,
                      t.emr.rxInstructions,
                      t.common.date,
                      t.emr.dispensed,
                    ].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPrescriptions.map((rx) => (
                    <tr key={rx.id} className="hover:bg-[var(--surface2)] transition-colors">
                      <td className="table-cell font-semibold text-[var(--txt1)]">{rx.medicationName}</td>
                      <td className="table-cell text-sm text-[var(--txt2)]">{rx.dosage}</td>
                      <td className="table-cell text-sm text-[var(--txt2)]">{rx.frequency}</td>
                      <td className="table-cell text-sm text-[var(--txt2)]">{rx.duration}</td>
                      <td className="table-cell text-xs text-[var(--txt2)] max-w-[180px] truncate">{rx.instructions ?? "—"}</td>
                      <td className="table-cell text-xs text-[var(--txt2)] whitespace-nowrap">{rx.consultDate ? formatDate(rx.consultDate) : "—"}</td>
                      <td className="table-cell">
                        <span className={`badge ${rx.isDispensed ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[#e9e7eb] text-[var(--txt2)]"}`}>
                          {rx.isDispensed ? t.emr.dispensed : t.emr.pendingDispense}
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
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] py-20 flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[var(--surface2)] rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[var(--txt2)] text-3xl">folder_open</span>
          </div>
          <p className="text-sm font-semibold text-[var(--txt1)]">{t.emr.noDocuments}</p>
          <p className="text-xs text-[var(--txt2)]">{t.emr.uploadFromProfile}</p>
        </div>
      )}

      {/* ─── LAB RESULTS MODAL ─── */}
      {labModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setLabModal(null)}>
          <div className="bg-white rounded-2xl border border-[var(--border)] shadow-[var(--sh-xl)] w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lab-modal-title">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h3 id="lab-modal-title" className="text-base font-bold text-[var(--txt1)]">
                  {t.laboratory.enterResultsTitle}
                </h3>
                <p className="text-xs text-[var(--txt2)] mt-0.5">
                  #{labModal.id.slice(-8).toUpperCase()} · {labModal.tests.join(", ")}
                </p>
              </div>
              <button onClick={() => setLabModal(null)} aria-label={t.common.close}
                className="p-1.5 hover:bg-[var(--surface2)] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[20px] text-[var(--txt2)]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {labModalLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-2 border-[var(--blue)]/30 border-t-[var(--blue)] rounded-full animate-spin" />
                </div>
              ) : !labModal.results || labModal.results.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-[var(--txt3)]">science</span>
                  <p className="text-sm text-[var(--txt2)]">{t.laboratory.noResultsYet ?? "No results recorded yet."}</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {[t.laboratory.testName ?? "Test", t.laboratory.result ?? "Result",
                        t.laboratory.unit ?? "Unit", t.laboratory.refRange ?? "Ref. Range", t.laboratory.flag ?? "Flag"]
                        .map((h) => (
                          <th key={h} className="text-start text-[10px] font-bold uppercase tracking-wider text-[var(--txt3)] bg-[var(--surface2)] px-3 py-2 border-b border-[var(--border)]">{h}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labModal.results.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border)] last:border-0"
                        style={r.isCritical ? { background: "#fff1f0" } : r.isAbnormal ? { background: "#fffbeb" } : {}}>
                        <td className="px-3 py-2.5 font-medium text-[var(--txt1)]">{r.testName}</td>
                        <td className="px-3 py-2.5 font-bold"
                          style={{ color: r.isCritical ? "#ba1a1a" : r.isAbnormal ? "#d97706" : "#0d9488" }}>
                          {r.value}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--txt3)] text-xs">{r.unit ?? "—"}</td>
                        <td className="px-3 py-2.5 text-[var(--txt3)] text-xs">{r.referenceRange ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          {r.isCritical && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#ffdad6", color: "#ba1a1a" }}>
                              {t.laboratory.critical ?? "CRITICAL"}
                            </span>
                          )}
                          {!r.isCritical && r.isAbnormal && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#fff7ed", color: "#d97706" }}>
                              {t.laboratory.abnormal ?? "ABNORMAL"}
                            </span>
                          )}
                          {!r.isCritical && !r.isAbnormal && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#ccfbf1", color: "#0d9488" }}>
                              {t.laboratory.normal ?? "NORMAL"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] flex justify-between items-center">
              <button onClick={() => setLabModal(null)} className="btn-secondary">{t.common.close}</button>
              <button onClick={() => { setLabModal(null); printDocument(`/print/lab-order/${labModal.id}`); }}
                className="btn-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">print</span>
                {t.billing.printInvoice.replace("Invoice", "Report")}
              </button>
            </div>
          </div>
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
    <div className="p-4 bg-[#faf9fd] rounded-xl border border-[var(--border)]">
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
    <div className="p-3 bg-[var(--surface2)] rounded-lg text-center">
      <p className="text-[10px] text-[var(--txt2)] font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold text-[var(--txt1)] mt-0.5">
        {value}
        {unit && <span className="text-xs font-normal text-[var(--txt2)] ms-1">{unit}</span>}
      </p>
    </div>
  );
}

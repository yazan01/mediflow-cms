"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import type { Appointment } from "@/types";

/* ─── Local sub-types ─── */
type VitalsForm = {
  bpSystolic: string;
  bpDiastolic: string;
  heartRate: string;
  temperature: string;
  weight: string;
  height: string;
  bmi: string;
  spo2: string;
  bloodGlucose: string;
  respiratoryRate: string;
};

type DiagnosisRow = {
  icdCode: string;
  description: string;
  type: "PRIMARY" | "SECONDARY" | "DIFFERENTIAL";
};

type PrescriptionRow = {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

const EMPTY_VITALS: VitalsForm = {
  bpSystolic: "",
  bpDiastolic: "",
  heartRate: "",
  temperature: "",
  weight: "",
  height: "",
  bmi: "",
  spo2: "",
  bloodGlucose: "",
  respiratoryRate: "",
};

const EMPTY_DIAGNOSIS: DiagnosisRow = { icdCode: "", description: "", type: "PRIMARY" };
const EMPTY_PRESCRIPTION: PrescriptionRow = {
  medicationName: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "",
  instructions: "",
};

/* ─── Shared style tokens ─── */
const INPUT =
  "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors";
const TEXTAREA =
  "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors resize-none";
const CARD = "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6";
const SECTION_HEADER = "text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-3";
const LABEL = "block text-xs font-medium text-[#43474e] mb-1";

/* ─── Page component ─── */
export default function NewConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  /* ── data state ── */
  const [patientName, setPatientName] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  /* ── form state ── */
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [vitals, setVitals] = useState<VitalsForm>(EMPTY_VITALS);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [hpi, setHpi] = useState("");
  const [examination, setExamination] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [diagnoses, setDiagnoses] = useState<DiagnosisRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");

  /* ── submission state ── */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /* ─── Load patient name + scheduled appointments ─── */
  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [patientRes, apptRes] = await Promise.all([
        fetch(`/api/patients/${patientId}`),
        fetch(`/api/appointments?patientId=${patientId}&status=SCHEDULED&pageSize=50`),
      ]);

      if (patientRes.ok) {
        const p = await patientRes.json();
        setPatientName(`${p.firstName} ${p.lastName}`);
      }

      if (apptRes.ok) {
        const apptData = await apptRes.json();
        setAppointments(apptData.data ?? []);
      }
    } catch {
      // non-fatal — continue
    } finally {
      setLoadingData(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /* ─── Auto-compute BMI when weight/height change ─── */
  useEffect(() => {
    const w = parseFloat(vitals.weight);
    const h = parseFloat(vitals.height);
    if (w > 0 && h > 0) {
      const hm = h / 100;
      setVitals((v) => ({ ...v, bmi: (w / (hm * hm)).toFixed(1) }));
    }
  }, [vitals.weight, vitals.height]);

  /* ─── Diagnoses helpers ─── */
  function addDiagnosis() {
    setDiagnoses((d) => [...d, { ...EMPTY_DIAGNOSIS }]);
  }
  function removeDiagnosis(i: number) {
    setDiagnoses((d) => d.filter((_, idx) => idx !== i));
  }
  function updateDiagnosis<K extends keyof DiagnosisRow>(i: number, key: K, val: DiagnosisRow[K]) {
    setDiagnoses((d) => d.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  }

  /* ─── Prescriptions helpers ─── */
  function addPrescription() {
    setPrescriptions((p) => [...p, { ...EMPTY_PRESCRIPTION }]);
  }
  function removePrescription(i: number) {
    setPrescriptions((p) => p.filter((_, idx) => idx !== i));
  }
  function updatePrescription<K extends keyof PrescriptionRow>(i: number, key: K, val: PrescriptionRow[K]) {
    setPrescriptions((p) => p.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  }

  /* ─── Derive doctorId from selected appointment ─── */
  const selectedAppointment = appointments.find((a) => a.id === selectedAppointmentId);

  /* ─── Submit handler ─── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedAppointmentId) {
      setError("Please select an appointment.");
      return;
    }
    if (!chiefComplaint.trim()) {
      setError("Chief Complaint is required.");
      return;
    }
    if (!selectedAppointment?.doctorId) {
      setError("Could not determine the doctor for the selected appointment.");
      return;
    }

    /* Build vitals payload — only include if at least one field filled */
    const hasVitals = Object.values(vitals).some((v) => v.trim() !== "");
    const vitalsPayload = hasVitals
      ? Object.fromEntries(
          Object.entries(vitals).filter(([, v]) => v.trim() !== "")
        )
      : undefined;

    /* Filter out incomplete diagnosis/prescription rows */
    const validDiagnoses = diagnoses.filter((d) => d.icdCode.trim() && d.description.trim());
    const validPrescriptions = prescriptions.filter(
      (rx) => rx.medicationName.trim() && rx.dosage.trim() && rx.frequency.trim() && rx.duration.trim()
    );

    setSubmitting(true);
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: selectedAppointmentId,
          patientId,
          doctorId: selectedAppointment.doctorId,
          chiefComplaint: chiefComplaint.trim(),
          hpi: hpi.trim() || undefined,
          examination: examination.trim() || undefined,
          subjective: subjective.trim() || undefined,
          objective: objective.trim() || undefined,
          assessment: assessment.trim() || undefined,
          plan: plan.trim() || undefined,
          followUpDate: followUpDate || undefined,
          vitals: vitalsPayload,
          diagnoses: validDiagnoses,
          prescriptions: validPrescriptions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save consultation");

      router.push(`/emr/${patientId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save consultation");
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Loading skeleton ─── */
  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-10 h-10 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
        <p className="text-sm text-[#74777f]">Loading consultation form...</p>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link
            href={`/emr/${patientId}`}
            className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f] hover:text-[#1a1c1e]"
            aria-label="Back to EMR"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1c1e]">New Consultation</h1>
            {patientName && (
              <p className="text-sm text-[#74777f] mt-0.5">
                Patient:{" "}
                <span className="font-semibold text-[#1a1c1e]">{patientName}</span>
              </p>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 bg-[#002045] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save Consultation
            </>
          )}
        </button>
      </div>

      {/* ── Global error banner ── */}
      {error && (
        <div className="flex items-center gap-3 bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#ba1a1a] rounded-xl px-4 py-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 1 — Appointment Selection
      ═══════════════════════════════════════════════════ */}
      <div className={CARD}>
        <p className={SECTION_HEADER}>
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">event_available</span>
            Appointment
          </span>
        </p>

        {appointments.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-[#fff8f7] border border-[#ffdad6] rounded-xl text-sm text-[#43474e]">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[20px]">warning</span>
            No scheduled appointments found for this patient. Please book an appointment first.
          </div>
        ) : (
          <div className="max-w-xl">
            <label className={LABEL}>
              Select Appointment <span className="text-[#ba1a1a]">*</span>
            </label>
            <select
              value={selectedAppointmentId}
              onChange={(e) => setSelectedAppointmentId(e.target.value)}
              required
              className={INPUT}
            >
              <option value="">— Choose an appointment —</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  Dr. {a.doctorName} — {formatDateTime(a.scheduledAt)}
                  {a.type ? ` (${a.type.replace(/_/g, " ")})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 2 — Vitals (collapsible)
      ═══════════════════════════════════════════════════ */}
      <div className={CARD}>
        <button
          type="button"
          onClick={() => setVitalsOpen((o) => !o)}
          className="w-full flex items-center justify-between group"
        >
          <p className={`${SECTION_HEADER} mb-0 flex items-center gap-1.5`}>
            <span className="material-symbols-outlined text-[14px]">monitor_heart</span>
            Vitals
            <span className="text-[#74777f] font-normal normal-case tracking-normal ml-1">
              (optional)
            </span>
          </p>
          <span
            className={`material-symbols-outlined text-[20px] text-[#74777f] transition-transform ${
              vitalsOpen ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </button>

        {vitalsOpen && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Blood Pressure — side by side */}
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>BP Systolic (mmHg)</label>
                <input
                  type="number"
                  min={60}
                  max={300}
                  placeholder="120"
                  value={vitals.bpSystolic}
                  onChange={(e) => setVitals((v) => ({ ...v, bpSystolic: e.target.value }))}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>BP Diastolic (mmHg)</label>
                <input
                  type="number"
                  min={40}
                  max={200}
                  placeholder="80"
                  value={vitals.bpDiastolic}
                  onChange={(e) => setVitals((v) => ({ ...v, bpDiastolic: e.target.value }))}
                  className={INPUT}
                />
              </div>
            </div>

            <div>
              <label className={LABEL}>Heart Rate (bpm)</label>
              <input
                type="number"
                min={20}
                max={300}
                placeholder="72"
                value={vitals.heartRate}
                onChange={(e) => setVitals((v) => ({ ...v, heartRate: e.target.value }))}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                min={30}
                max={45}
                placeholder="36.6"
                value={vitals.temperature}
                onChange={(e) => setVitals((v) => ({ ...v, temperature: e.target.value }))}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min={1}
                max={500}
                placeholder="70"
                value={vitals.weight}
                onChange={(e) => setVitals((v) => ({ ...v, weight: e.target.value }))}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Height (cm)</label>
              <input
                type="number"
                step="0.1"
                min={30}
                max={250}
                placeholder="170"
                value={vitals.height}
                onChange={(e) => setVitals((v) => ({ ...v, height: e.target.value }))}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>BMI</label>
              <input
                type="number"
                step="0.1"
                placeholder="Auto-calculated"
                value={vitals.bmi}
                onChange={(e) => setVitals((v) => ({ ...v, bmi: e.target.value }))}
                className={`${INPUT} bg-[#f4f3f7]`}
                readOnly={!!(vitals.weight && vitals.height)}
              />
            </div>

            <div>
              <label className={LABEL}>SpO₂ (%)</label>
              <input
                type="number"
                min={50}
                max={100}
                placeholder="98"
                value={vitals.spo2}
                onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Blood Glucose (mg/dL)</label>
              <input
                type="number"
                min={20}
                max={800}
                placeholder="90"
                value={vitals.bloodGlucose}
                onChange={(e) => setVitals((v) => ({ ...v, bloodGlucose: e.target.value }))}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Respiratory Rate (/min)</label>
              <input
                type="number"
                min={4}
                max={60}
                placeholder="16"
                value={vitals.respiratoryRate}
                onChange={(e) => setVitals((v) => ({ ...v, respiratoryRate: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 3 — SOAP Notes
      ═══════════════════════════════════════════════════ */}
      <div className={CARD}>
        <p className={SECTION_HEADER}>
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">stethoscope</span>
            Clinical Notes
          </span>
        </p>

        <div className="space-y-5">
          {/* Chief Complaint */}
          <div>
            <label className={LABEL}>
              Chief Complaint <span className="text-[#ba1a1a]">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="Patient's primary reason for visit..."
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              required
              className={TEXTAREA}
            />
          </div>

          {/* HPI */}
          <div>
            <label className={LABEL}>History of Present Illness (HPI)</label>
            <textarea
              rows={3}
              placeholder="Onset, location, duration, character, aggravating/relieving factors..."
              value={hpi}
              onChange={(e) => setHpi(e.target.value)}
              className={TEXTAREA}
            />
          </div>

          {/* Physical Examination */}
          <div>
            <label className={LABEL}>Physical Examination</label>
            <textarea
              rows={3}
              placeholder="General appearance, system-specific findings..."
              value={examination}
              onChange={(e) => setExamination(e.target.value)}
              className={TEXTAREA}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Subjective */}
            <div>
              <label className={LABEL}>Subjective (S)</label>
              <textarea
                rows={3}
                placeholder="Patient-reported symptoms and history..."
                value={subjective}
                onChange={(e) => setSubjective(e.target.value)}
                className={TEXTAREA}
              />
            </div>

            {/* Objective */}
            <div>
              <label className={LABEL}>Objective (O)</label>
              <textarea
                rows={3}
                placeholder="Clinical observations, test results, measurements..."
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className={TEXTAREA}
              />
            </div>

            {/* Assessment */}
            <div>
              <label className={LABEL}>Assessment (A)</label>
              <textarea
                rows={3}
                placeholder="Clinical interpretation and differential diagnosis..."
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                className={TEXTAREA}
              />
            </div>

            {/* Plan */}
            <div>
              <label className={LABEL}>Plan (P)</label>
              <textarea
                rows={3}
                placeholder="Treatment plan, investigations ordered, referrals..."
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className={TEXTAREA}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 4 — Diagnoses
      ═══════════════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className={`${SECTION_HEADER} mb-0 flex items-center gap-1.5`}>
            <span className="material-symbols-outlined text-[14px]">diagnosis</span>
            Diagnoses (ICD-10)
          </p>
          <button
            type="button"
            onClick={addDiagnosis}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1960a3] hover:text-[#002045] transition-colors px-3 py-1.5 border border-[#1960a3]/30 rounded-lg hover:bg-[#eff6ff]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Diagnosis
          </button>
        </div>

        {diagnoses.length === 0 ? (
          <p className="text-sm text-[#74777f] text-center py-6 border border-dashed border-[#c4c6cf] rounded-xl">
            No diagnoses added yet. Click &ldquo;Add Diagnosis&rdquo; to begin.
          </p>
        ) : (
          <div className="space-y-3">
            {diagnoses.map((d, i) => (
              <div
                key={i}
                className="grid grid-cols-[120px_1fr_160px_40px] gap-3 items-start p-3 bg-[#f4f3f7] rounded-xl"
              >
                <div>
                  {i === 0 && <label className={LABEL}>ICD-10 Code</label>}
                  <input
                    type="text"
                    placeholder="E.g. J06.9"
                    value={d.icdCode}
                    onChange={(e) => updateDiagnosis(i, "icdCode", e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  {i === 0 && <label className={LABEL}>Description</label>}
                  <input
                    type="text"
                    placeholder="Diagnosis description..."
                    value={d.description}
                    onChange={(e) => updateDiagnosis(i, "description", e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  {i === 0 && <label className={LABEL}>Type</label>}
                  <select
                    value={d.type}
                    onChange={(e) =>
                      updateDiagnosis(i, "type", e.target.value as DiagnosisRow["type"])
                    }
                    className={INPUT}
                  >
                    <option value="PRIMARY">Primary</option>
                    <option value="SECONDARY">Secondary</option>
                    <option value="DIFFERENTIAL">Differential</option>
                  </select>
                </div>
                <div className={i === 0 ? "mt-5" : ""}>
                  <button
                    type="button"
                    onClick={() => removeDiagnosis(i)}
                    className="p-2 text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors"
                    aria-label="Remove diagnosis"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 5 — Prescriptions
      ═══════════════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className={`${SECTION_HEADER} mb-0 flex items-center gap-1.5`}>
            <span className="material-symbols-outlined text-[14px]">medication</span>
            Prescriptions
          </p>
          <button
            type="button"
            onClick={addPrescription}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1960a3] hover:text-[#002045] transition-colors px-3 py-1.5 border border-[#1960a3]/30 rounded-lg hover:bg-[#eff6ff]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Prescription
          </button>
        </div>

        {prescriptions.length === 0 ? (
          <p className="text-sm text-[#74777f] text-center py-6 border border-dashed border-[#c4c6cf] rounded-xl">
            No prescriptions added yet. Click &ldquo;Add Prescription&rdquo; to begin.
          </p>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((rx, i) => (
              <div key={i} className="p-4 bg-[#f4f3f7] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#43474e] uppercase tracking-wider">
                    Rx #{i + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removePrescription(i)}
                    className="p-1.5 text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors"
                    aria-label="Remove prescription"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL}>Medication Name *</label>
                    <input
                      type="text"
                      placeholder="E.g. Amoxicillin"
                      value={rx.medicationName}
                      onChange={(e) => updatePrescription(i, "medicationName", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Dosage *</label>
                    <input
                      type="text"
                      placeholder="E.g. 500 mg"
                      value={rx.dosage}
                      onChange={(e) => updatePrescription(i, "dosage", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Frequency *</label>
                    <input
                      type="text"
                      placeholder="E.g. Three times daily"
                      value={rx.frequency}
                      onChange={(e) => updatePrescription(i, "frequency", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Duration *</label>
                    <input
                      type="text"
                      placeholder="E.g. 7 days"
                      value={rx.duration}
                      onChange={(e) => updatePrescription(i, "duration", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Quantity</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="E.g. 21"
                      value={rx.quantity}
                      onChange={(e) => updatePrescription(i, "quantity", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Instructions</label>
                    <input
                      type="text"
                      placeholder="E.g. Take with food"
                      value={rx.instructions}
                      onChange={(e) => updatePrescription(i, "instructions", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 6 — Follow-up
      ═══════════════════════════════════════════════════ */}
      <div className={CARD}>
        <p className={SECTION_HEADER}>
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">event</span>
            Follow-up
          </span>
        </p>
        <div className="max-w-xs">
          <label className={LABEL}>Follow-up Date (optional)</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className={INPUT}
          />
        </div>
      </div>

      {/* ── Bottom save button (repeated for long forms) ── */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Link
          href={`/emr/${patientId}`}
          className="px-5 py-2.5 border border-[#c4c6cf] bg-white text-[#1a1c1e] rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 bg-[#002045] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save Consultation
            </>
          )}
        </button>
      </div>
    </form>
  );
}

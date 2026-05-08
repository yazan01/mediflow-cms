"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import ICD10Search from "@/components/layout/ICD10Search";

/* ─── Sub-types ─── */
type VitalsForm = {
  bpSystolic: string; bpDiastolic: string; heartRate: string;
  temperature: string; weight: string; height: string;
  bmi: string; spo2: string; bloodGlucose: string; respiratoryRate: string;
};
type DiagnosisRow = { icdCode: string; description: string; type: "PRIMARY" | "SECONDARY" | "DIFFERENTIAL" };
type PrescriptionRow = { medicationName: string; dosage: string; frequency: string; duration: string; quantity: string; instructions: string };
type LabOrderRow = { tests: string; priority: "ROUTINE" | "URGENT" | "STAT" };
type RadiologyRow = { modality: string; study: string; bodyPart: string; priority: "ROUTINE" | "URGENT" | "STAT" };

const EMPTY_VITALS: VitalsForm = {
  bpSystolic: "", bpDiastolic: "", heartRate: "", temperature: "",
  weight: "", height: "", bmi: "", spo2: "", bloodGlucose: "", respiratoryRate: "",
};
const EMPTY_DIAG: DiagnosisRow = { icdCode: "", description: "", type: "PRIMARY" };
const EMPTY_RX: PrescriptionRow = { medicationName: "", dosage: "", frequency: "", duration: "", quantity: "", instructions: "" };
const EMPTY_LAB: LabOrderRow = { tests: "", priority: "ROUTINE" };
const EMPTY_RAD: RadiologyRow = { modality: "", study: "", bodyPart: "", priority: "ROUTINE" };

/* ─── Style tokens ─── */
const INPUT = "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors";
const TEXTAREA = "w-full bg-white border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-colors resize-none";
const CARD = "bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6";
const SEC = "text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-3 flex items-center gap-1.5";
const LABEL = "block text-xs font-medium text-[#43474e] mb-1";
const CHIP_BTN = "flex items-center gap-1.5 text-xs font-semibold text-[#1960a3] hover:text-[#002045] transition-colors px-3 py-1.5 border border-[#1960a3]/30 rounded-lg hover:bg-[#eff6ff]";

/* ─── Page ─── */
export default function NewConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const patientId = params.id as string;

  /* URL query params */
  const appointmentParam = searchParams.get("appointment") ?? "";
  const consultationParam = searchParams.get("consultation") ?? "";
  const isEditMode = !!consultationParam;

  /* ── data ── */
  const [patientName, setPatientName] = useState("");
  const [appointments, setAppointments] = useState<Array<{ id: string; doctorId: string; doctorName: string; scheduledAt: string; type: string }>>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [consultationId, setConsultationId] = useState(consultationParam);

  /* ── form ── */
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointmentParam);
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
  const [labOrders, setLabOrders] = useState<LabOrderRow[]>([]);
  const [radiologyOrders, setRadiologyOrders] = useState<RadiologyRow[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  /* ── status ── */
  const [submitting, setSubmitting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  /* ─── Load patient + appointments ─── */
  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [patientRes, apptRes] = await Promise.all([
        fetch(`/api/patients/${patientId}`),
        fetch(`/api/appointments?patientId=${patientId}&pageSize=100`),
      ]);
      if (patientRes.ok) {
        const p = await patientRes.json();
        setPatientName(`${p.firstName} ${p.lastName}`);
      }
      if (apptRes.ok) {
        const apptData = await apptRes.json();
        setAppointments(apptData.data ?? []);
      }
    } catch { /* non-fatal */ }
    setLoadingData(false);
  }, [patientId]);

  /* ─── Load existing consultation if in edit mode ─── */
  const loadConsultation = useCallback(async (cId: string) => {
    try {
      const res = await fetch(`/api/consultations/${cId}`);
      if (!res.ok) return;
      const c = await res.json();
      setConsultationId(c.id);
      setSelectedAppointmentId(c.appointmentId ?? "");
      setChiefComplaint(c.chiefComplaint ?? "");
      setHpi(c.hpi ?? "");
      setExamination(c.examination ?? "");
      setSubjective(c.subjective ?? "");
      setObjective(c.objective ?? "");
      setAssessment(c.assessment ?? "");
      setPlan(c.plan ?? "");
      setFollowUpDate(c.followUpDate ? c.followUpDate.split("T")[0] : "");
      setIsLocked(!!c.isLocked);
      if (c.vitals) {
        setVitals({
          bpSystolic: c.vitals.bpSystolic?.toString() ?? "",
          bpDiastolic: c.vitals.bpDiastolic?.toString() ?? "",
          heartRate: c.vitals.heartRate?.toString() ?? "",
          temperature: c.vitals.temperature?.toString() ?? "",
          weight: c.vitals.weight?.toString() ?? "",
          height: c.vitals.height?.toString() ?? "",
          bmi: c.vitals.bmi?.toString() ?? "",
          spo2: c.vitals.spo2?.toString() ?? "",
          bloodGlucose: c.vitals.bloodGlucose?.toString() ?? "",
          respiratoryRate: c.vitals.respiratoryRate?.toString() ?? "",
        });
        setVitalsOpen(true);
      }
      setDiagnoses((c.diagnoses ?? []).map((d: { icdCode: string; description: string; type: string }) => ({
        icdCode: d.icdCode,
        description: d.description,
        type: (d.type as DiagnosisRow["type"]) ?? "PRIMARY",
      })));
      setPrescriptions((c.prescriptions ?? []).map((rx: { medicationName: string; dosage: string; frequency: string; duration: string; quantity?: number; instructions?: string }) => ({
        medicationName: rx.medicationName,
        dosage: rx.dosage,
        frequency: rx.frequency,
        duration: rx.duration,
        quantity: rx.quantity?.toString() ?? "",
        instructions: rx.instructions ?? "",
      })));
      setLabOrders((c.labOrders ?? []).map((lo: { tests: string[]; priority: string }) => ({
        tests: (lo.tests ?? []).join(", "),
        priority: (lo.priority as LabOrderRow["priority"]) ?? "ROUTINE",
      })));
      setRadiologyOrders((c.radiologyOrders ?? []).map((ro: { modality: string; study: string; bodyPart: string; priority: string }) => ({
        modality: ro.modality ?? "",
        study: ro.study ?? "",
        bodyPart: ro.bodyPart ?? "",
        priority: (ro.priority as RadiologyRow["priority"]) ?? "ROUTINE",
      })));
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadInitialData();
    if (consultationParam) loadConsultation(consultationParam);
  }, [loadInitialData, consultationParam, loadConsultation]);

  /* ─── Auto-compute BMI ─── */
  useEffect(() => {
    const w = parseFloat(vitals.weight), h = parseFloat(vitals.height);
    if (w > 0 && h > 0) {
      const hm = h / 100;
      setVitals((v) => ({ ...v, bmi: (w / (hm * hm)).toFixed(1) }));
    }
  }, [vitals.weight, vitals.height]);

  /* ─── Helpers ─── */
  function addDiagnosis() { setDiagnoses((d) => [...d, { ...EMPTY_DIAG }]); }
  function removeDiagnosis(i: number) { setDiagnoses((d) => d.filter((_, idx) => idx !== i)); }
  function updateDiagnosis<K extends keyof DiagnosisRow>(i: number, k: K, v: DiagnosisRow[K]) {
    setDiagnoses((d) => d.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }
  function addPrescription() { setPrescriptions((p) => [...p, { ...EMPTY_RX }]); }
  function removePrescription(i: number) { setPrescriptions((p) => p.filter((_, idx) => idx !== i)); }
  function updatePrescription<K extends keyof PrescriptionRow>(i: number, k: K, v: PrescriptionRow[K]) {
    setPrescriptions((p) => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }
  function addLabOrder() { setLabOrders((l) => [...l, { ...EMPTY_LAB }]); }
  function removeLabOrder(i: number) { setLabOrders((l) => l.filter((_, idx) => idx !== i)); }
  function updateLabOrder<K extends keyof LabOrderRow>(i: number, k: K, v: LabOrderRow[K]) {
    setLabOrders((l) => l.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }
  function addRadiology() { setRadiologyOrders((r) => [...r, { ...EMPTY_RAD }]); }
  function removeRadiology(i: number) { setRadiologyOrders((r) => r.filter((_, idx) => idx !== i)); }
  function updateRadiology<K extends keyof RadiologyRow>(i: number, k: K, v: RadiologyRow[K]) {
    setRadiologyOrders((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }

  /* ─── Build payload ─── */
  function buildPayload() {
    const hasVitals = Object.values(vitals).some((v) => v.trim() !== "");
    const vitalsPayload = hasVitals
      ? Object.fromEntries(Object.entries(vitals).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, parseFloat(v)]))
      : undefined;
    return {
      appointmentId: selectedAppointmentId,
      chiefComplaint: chiefComplaint.trim() || undefined,
      hpi: hpi.trim() || undefined,
      examination: examination.trim() || undefined,
      subjective: subjective.trim() || undefined,
      objective: objective.trim() || undefined,
      assessment: assessment.trim() || undefined,
      plan: plan.trim() || undefined,
      followUpDate: followUpDate || undefined,
      vitals: vitalsPayload,
      diagnoses: diagnoses.filter((d) => d.icdCode.trim() && d.description.trim()),
      prescriptions: prescriptions.filter((rx) => rx.medicationName.trim() && rx.dosage.trim() && rx.frequency.trim() && rx.duration.trim()).map((rx) => ({
        ...rx, quantity: rx.quantity ? parseInt(rx.quantity) : undefined,
      })),
      labOrders: labOrders.filter((lo) => lo.tests.trim()).map((lo) => ({
        tests: lo.tests.split(",").map((t) => t.trim()).filter(Boolean),
        priority: lo.priority,
      })),
      radiologyOrders: radiologyOrders.filter((ro) => ro.modality.trim() && ro.study.trim() && ro.bodyPart.trim()),
    };
  }

  /* ─── Save draft ─── */
  async function handleSaveDraft(e?: React.FormEvent) {
    e?.preventDefault();
    setError(""); setSuccessMsg("");
    if (!selectedAppointmentId) { setError("Please select an appointment."); return null; }
    if (!chiefComplaint.trim()) { setError("Chief Complaint is required."); return null; }
    setSubmitting(true);
    try {
      let cId = consultationId;
      const payload = buildPayload();
      if (cId) {
        /* PATCH existing */
        const res = await fetch(`/api/consultations/${cId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? "Failed to update"); }
      } else {
        /* POST new */
        const res = await fetch("/api/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Failed to save");
        cId = data.id;
        setConsultationId(data.id);
      }
      setSuccessMsg(t.emr.consultationSaved);
      return cId;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save consultation");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Lock & invoice ─── */
  async function handleLockAndInvoice() {
    setError(""); setSuccessMsg("");
    const cId = await handleSaveDraft();
    if (!cId) return;
    setLocking(true);
    try {
      const res = await fetch(`/api/consultations/${cId}/lock`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to lock");
      setIsLocked(true);
      setSuccessMsg(t.emr.invoiceAutoCreated);
      setTimeout(() => router.push(`/emr/${patientId}?consultation=${cId}`), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete consultation");
    } finally {
      setLocking(false);
    }
  }

  /* ─── Loading ─── */
  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-10 h-10 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
        <p className="text-sm text-[#74777f]">Loading...</p>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <form onSubmit={handleSaveDraft} className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href={`/emr/${patientId}`} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f] hover:text-[#1a1c1e]" aria-label={t.emr.backToEMR}>
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1c1e]">
              {isEditMode ? t.emr.consultationCard : "New Consultation"}
            </h1>
            {patientName && <p className="text-sm text-[#74777f] mt-0.5">{patientName}</p>}
          </div>
        </div>
        {isLocked ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#f4f3f7] text-[#43474e] rounded-lg text-sm font-semibold">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Locked
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting || locking} className="flex items-center gap-2 bg-[#1960a3] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
              {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
              {t.emr.saveDraft}
            </button>
            <button type="button" onClick={handleLockAndInvoice} disabled={submitting || locking} className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
              {locking ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">receipt_long</span>}
              {t.emr.lockAndInvoice}
            </button>
          </div>
        )}
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-center gap-3 bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#ba1a1a] rounded-xl px-4 py-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 bg-[#ccfbf1] border border-[#0d9488]/30 text-[#0d9488] rounded-xl px-4 py-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {successMsg}
        </div>
      )}

      {/* ══════════════════════════════════════════
          1 — Appointment
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <p className={SEC}><span className="material-symbols-outlined text-[14px]">event_available</span>Appointment</p>
        {appointments.length === 0 ? (
          <p className="text-sm text-[#74777f] p-4 bg-[#fff8f7] border border-[#ffdad6] rounded-xl">
            No appointments found for this patient.
          </p>
        ) : (
          <div className="max-w-xl">
            <label className={LABEL}>Select Appointment <span className="text-[#ba1a1a]">*</span></label>
            <select value={selectedAppointmentId} onChange={(e) => setSelectedAppointmentId(e.target.value)} required disabled={isLocked} className={INPUT}>
              <option value="">— Choose an appointment —</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  Dr. {a.doctorName} — {formatDateTime(a.scheduledAt)}{a.type ? ` (${a.type.replace(/_/g, " ")})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          2 — Vitals (collapsible)
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <button type="button" onClick={() => setVitalsOpen((o) => !o)} className="w-full flex items-center justify-between group">
          <p className={`${SEC} mb-0`}><span className="material-symbols-outlined text-[14px]">monitor_heart</span>Vitals <span className="text-[#74777f] font-normal normal-case tracking-normal ml-1">(optional)</span></p>
          <span className={`material-symbols-outlined text-[20px] text-[#74777f] transition-transform ${vitalsOpen ? "rotate-180" : ""}`}>expand_more</span>
        </button>
        {vitalsOpen && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>BP Systolic (mmHg)</label>
                <input type="number" min={60} max={300} placeholder="120" value={vitals.bpSystolic} onChange={(e) => setVitals((v) => ({ ...v, bpSystolic: e.target.value }))} className={INPUT} disabled={isLocked} />
              </div>
              <div>
                <label className={LABEL}>BP Diastolic (mmHg)</label>
                <input type="number" min={40} max={200} placeholder="80" value={vitals.bpDiastolic} onChange={(e) => setVitals((v) => ({ ...v, bpDiastolic: e.target.value }))} className={INPUT} disabled={isLocked} />
              </div>
            </div>
            <div><label className={LABEL}>Heart Rate (bpm)</label><input type="number" min={20} max={300} placeholder="72" value={vitals.heartRate} onChange={(e) => setVitals((v) => ({ ...v, heartRate: e.target.value }))} className={INPUT} disabled={isLocked} /></div>
            <div><label className={LABEL}>Temperature (°C)</label><input type="number" step="0.1" min={30} max={45} placeholder="36.6" value={vitals.temperature} onChange={(e) => setVitals((v) => ({ ...v, temperature: e.target.value }))} className={INPUT} disabled={isLocked} /></div>
            <div><label className={LABEL}>Weight (kg)</label><input type="number" step="0.1" min={1} max={500} placeholder="70" value={vitals.weight} onChange={(e) => setVitals((v) => ({ ...v, weight: e.target.value }))} className={INPUT} disabled={isLocked} /></div>
            <div><label className={LABEL}>Height (cm)</label><input type="number" step="0.1" min={30} max={250} placeholder="170" value={vitals.height} onChange={(e) => setVitals((v) => ({ ...v, height: e.target.value }))} className={INPUT} disabled={isLocked} /></div>
            <div><label className={LABEL}>BMI</label><input type="number" step="0.1" placeholder="Auto" value={vitals.bmi} onChange={(e) => setVitals((v) => ({ ...v, bmi: e.target.value }))} className={`${INPUT} bg-[#f4f3f7]`} readOnly={!!(vitals.weight && vitals.height)} disabled={isLocked} /></div>
            <div><label className={LABEL}>SpO₂ (%)</label><input type="number" min={50} max={100} placeholder="98" value={vitals.spo2} onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))} className={INPUT} disabled={isLocked} /></div>
            <div><label className={LABEL}>Blood Glucose (mg/dL)</label><input type="number" min={20} max={800} placeholder="90" value={vitals.bloodGlucose} onChange={(e) => setVitals((v) => ({ ...v, bloodGlucose: e.target.value }))} className={INPUT} disabled={isLocked} /></div>
            <div><label className={LABEL}>Resp. Rate (/min)</label><input type="number" min={4} max={60} placeholder="16" value={vitals.respiratoryRate} onChange={(e) => setVitals((v) => ({ ...v, respiratoryRate: e.target.value }))} className={INPUT} disabled={isLocked} /></div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          3 — SOAP Notes
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <p className={SEC}><span className="material-symbols-outlined text-[14px]">clinical_notes</span>Clinical Notes</p>
        <div className="space-y-5">
          <div>
            <label className={LABEL}>Chief Complaint <span className="text-[#ba1a1a]">*</span></label>
            <textarea rows={2} placeholder="Patient's primary reason for visit..." value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} required className={TEXTAREA} disabled={isLocked} />
          </div>
          <div>
            <label className={LABEL}>History of Present Illness (HPI)</label>
            <textarea rows={3} placeholder={t.emr.hpiPlaceholder} value={hpi} onChange={(e) => setHpi(e.target.value)} className={TEXTAREA} disabled={isLocked} />
          </div>
          <div>
            <label className={LABEL}>Physical Examination</label>
            <textarea rows={3} placeholder={t.emr.examinationPlaceholder} value={examination} onChange={(e) => setExamination(e.target.value)} className={TEXTAREA} disabled={isLocked} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={LABEL}>Subjective (S)</label>
              <textarea rows={3} placeholder="Patient-reported symptoms..." value={subjective} onChange={(e) => setSubjective(e.target.value)} className={TEXTAREA} disabled={isLocked} />
            </div>
            <div>
              <label className={LABEL}>Objective (O)</label>
              <textarea rows={3} placeholder="Clinical observations..." value={objective} onChange={(e) => setObjective(e.target.value)} className={TEXTAREA} disabled={isLocked} />
            </div>
            <div>
              <label className={LABEL}>Assessment (A)</label>
              <textarea rows={3} placeholder="Clinical interpretation..." value={assessment} onChange={(e) => setAssessment(e.target.value)} className={TEXTAREA} disabled={isLocked} />
            </div>
            <div>
              <label className={LABEL}>Plan (P)</label>
              <textarea rows={3} placeholder={t.emr.planPlaceholderFull} value={plan} onChange={(e) => setPlan(e.target.value)} className={TEXTAREA} disabled={isLocked} />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          4 — Diagnoses (ICD-10)
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className={`${SEC} mb-0`}><span className="material-symbols-outlined text-[14px]">diagnosis</span>{t.emr.addDiagnosis}</p>
          {!isLocked && (
            <button type="button" onClick={addDiagnosis} className={CHIP_BTN}>
              <span className="material-symbols-outlined text-[16px]">add</span>{t.emr.addDiagnosis}
            </button>
          )}
        </div>
        {diagnoses.length === 0 ? (
          <p className="text-sm text-[#74777f] text-center py-6 border border-dashed border-[#c4c6cf] rounded-xl">No diagnoses added yet.</p>
        ) : (
          <div className="space-y-3">
            {diagnoses.map((d, i) => (
              <div key={i} className="grid grid-cols-[1fr_180px_40px] gap-3 items-start p-3 bg-[#f4f3f7] rounded-xl">
                <div>
                  {i === 0 && <label className={LABEL}>ICD-10 Code / Description</label>}
                  <ICD10Search value={d.icdCode} onChange={(code, desc) => { updateDiagnosis(i, "icdCode", code); if (desc) updateDiagnosis(i, "description", desc); }} inputClassName={INPUT} />
                  {d.description && <p className="mt-1 text-xs text-[#1960a3] font-semibold ps-1">{d.description}</p>}
                </div>
                <div>
                  {i === 0 && <label className={LABEL}>Type</label>}
                  <select value={d.type} onChange={(e) => updateDiagnosis(i, "type", e.target.value as DiagnosisRow["type"])} className={INPUT} disabled={isLocked}>
                    <option value="PRIMARY">{t.emr.primaryDiagnosis}</option>
                    <option value="SECONDARY">{t.emr.secondaryDiagnosis}</option>
                    <option value="DIFFERENTIAL">Differential</option>
                  </select>
                </div>
                {!isLocked && (
                  <div className={i === 0 ? "mt-5" : ""}>
                    <button type="button" onClick={() => removeDiagnosis(i)} className="p-2 text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors" aria-label="Remove">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          5 — Prescriptions
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className={`${SEC} mb-0`}><span className="material-symbols-outlined text-[14px]">medication</span>{t.emr.addPrescription}</p>
          {!isLocked && (
            <button type="button" onClick={addPrescription} className={CHIP_BTN}>
              <span className="material-symbols-outlined text-[16px]">add</span>{t.emr.addPrescription}
            </button>
          )}
        </div>
        {prescriptions.length === 0 ? (
          <p className="text-sm text-[#74777f] text-center py-6 border border-dashed border-[#c4c6cf] rounded-xl">No prescriptions added yet.</p>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((rx, i) => (
              <div key={i} className="p-4 bg-[#f4f3f7] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#43474e] uppercase tracking-wider">Rx #{i + 1}</p>
                  {!isLocked && (
                    <button type="button" onClick={() => removePrescription(i)} className="p-1.5 text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors" aria-label="Remove">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div><label className={LABEL}>{t.emr.medicationName} *</label><input type="text" placeholder="E.g. Amoxicillin" value={rx.medicationName} onChange={(e) => updatePrescription(i, "medicationName", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                  <div><label className={LABEL}>Dosage *</label><input type="text" placeholder="E.g. 500 mg" value={rx.dosage} onChange={(e) => updatePrescription(i, "dosage", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                  <div><label className={LABEL}>Frequency *</label><input type="text" placeholder="E.g. Three times daily" value={rx.frequency} onChange={(e) => updatePrescription(i, "frequency", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                  <div><label className={LABEL}>Duration *</label><input type="text" placeholder="E.g. 7 days" value={rx.duration} onChange={(e) => updatePrescription(i, "duration", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                  <div><label className={LABEL}>Quantity</label><input type="number" min={1} placeholder="E.g. 21" value={rx.quantity} onChange={(e) => updatePrescription(i, "quantity", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                  <div><label className={LABEL}>Instructions</label><input type="text" placeholder="E.g. Take with food" value={rx.instructions} onChange={(e) => updatePrescription(i, "instructions", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          6 — Lab Orders
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className={`${SEC} mb-0`}><span className="material-symbols-outlined text-[14px]">science</span>{t.emr.addLabOrder}</p>
          {!isLocked && (
            <button type="button" onClick={addLabOrder} className={CHIP_BTN}>
              <span className="material-symbols-outlined text-[16px]">add</span>{t.emr.addLabOrder}
            </button>
          )}
        </div>
        {labOrders.length === 0 ? (
          <p className="text-sm text-[#74777f] text-center py-6 border border-dashed border-[#c4c6cf] rounded-xl">No lab orders added yet.</p>
        ) : (
          <div className="space-y-3">
            {labOrders.map((lo, i) => (
              <div key={i} className="grid grid-cols-[1fr_160px_40px] gap-3 items-start p-3 bg-[#f4f3f7] rounded-xl">
                <div>
                  {i === 0 && <label className={LABEL}>Tests (comma-separated)</label>}
                  <input type="text" placeholder="E.g. CBC, BMP, Lipid Panel" value={lo.tests} onChange={(e) => updateLabOrder(i, "tests", e.target.value)} className={INPUT} disabled={isLocked} />
                </div>
                <div>
                  {i === 0 && <label className={LABEL}>Priority</label>}
                  <select value={lo.priority} onChange={(e) => updateLabOrder(i, "priority", e.target.value as LabOrderRow["priority"])} className={INPUT} disabled={isLocked}>
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT</option>
                  </select>
                </div>
                {!isLocked && (
                  <div className={i === 0 ? "mt-5" : ""}>
                    <button type="button" onClick={() => removeLabOrder(i)} className="p-2 text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors" aria-label="Remove">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          7 — Radiology Orders
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className={`${SEC} mb-0`}><span className="material-symbols-outlined text-[14px]">radiology</span>{t.emr.addRadiology}</p>
          {!isLocked && (
            <button type="button" onClick={addRadiology} className={CHIP_BTN}>
              <span className="material-symbols-outlined text-[16px]">add</span>{t.emr.addRadiology}
            </button>
          )}
        </div>
        {radiologyOrders.length === 0 ? (
          <p className="text-sm text-[#74777f] text-center py-6 border border-dashed border-[#c4c6cf] rounded-xl">No radiology orders added yet.</p>
        ) : (
          <div className="space-y-4">
            {radiologyOrders.map((ro, i) => (
              <div key={i} className="p-4 bg-[#f4f3f7] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#43474e] uppercase tracking-wider">Radiology #{i + 1}</p>
                  {!isLocked && (
                    <button type="button" onClick={() => removeRadiology(i)} className="p-1.5 text-[#74777f] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors" aria-label="Remove">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div><label className={LABEL}>Modality *</label>
                    <select value={ro.modality} onChange={(e) => updateRadiology(i, "modality", e.target.value)} className={INPUT} disabled={isLocked}>
                      <option value="">— Select —</option>
                      <option value="X-RAY">X-Ray</option>
                      <option value="CT">CT Scan</option>
                      <option value="MRI">MRI</option>
                      <option value="ULTRASOUND">Ultrasound</option>
                      <option value="PET">PET Scan</option>
                      <option value="MAMMOGRAPHY">Mammography</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div><label className={LABEL}>Study *</label><input type="text" placeholder="E.g. Chest AP" value={ro.study} onChange={(e) => updateRadiology(i, "study", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                  <div><label className={LABEL}>Body Part *</label><input type="text" placeholder="E.g. Chest" value={ro.bodyPart} onChange={(e) => updateRadiology(i, "bodyPart", e.target.value)} className={INPUT} disabled={isLocked} /></div>
                  <div><label className={LABEL}>Priority</label>
                    <select value={ro.priority} onChange={(e) => updateRadiology(i, "priority", e.target.value as RadiologyRow["priority"])} className={INPUT} disabled={isLocked}>
                      <option value="ROUTINE">Routine</option>
                      <option value="URGENT">Urgent</option>
                      <option value="STAT">STAT</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          8 — Follow-up
      ══════════════════════════════════════════ */}
      <div className={CARD}>
        <p className={SEC}><span className="material-symbols-outlined text-[14px]">event</span>Follow-up</p>
        <div className="max-w-xs">
          <label className={LABEL}>Follow-up Date (optional)</label>
          <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className={INPUT} disabled={isLocked} />
        </div>
      </div>

      {/* ── Bottom actions ── */}
      {!isLocked && (
        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href={`/emr/${patientId}`} className="px-5 py-2.5 border border-[#c4c6cf] bg-white text-[#1a1c1e] rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={submitting || locking} className="flex items-center gap-2 bg-[#1960a3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
            {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
            {t.emr.saveDraft}
          </button>
          <button type="button" onClick={handleLockAndInvoice} disabled={submitting || locking} className="flex items-center gap-2 bg-[#002045] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
            {locking ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">receipt_long</span>}
            {t.emr.lockAndInvoice}
          </button>
        </div>
      )}
    </form>
  );
}

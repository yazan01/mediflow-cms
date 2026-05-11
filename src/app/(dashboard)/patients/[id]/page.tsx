"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, formatDateTime, calculateAge, getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import EditLog from "@/components/layout/EditLog";
import { AttachmentPanel } from "@/components/ui/AttachmentPanel";

const BLOOD_LABELS: Record<string, string> = { A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−", AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−" };
const BLOOD_TYPES = ["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"];

type Tab = "overview" | "appointments" | "emr" | "billing";
type Patient = Record<string, unknown>;

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);

  function loadPatient() {
    fetch(`/api/patients/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setPatient)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPatient(); }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
    </div>
  );

  if (!patient) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">person_off</span>
      <p className="text-sm font-semibold text-[#1a1c1e]">{t.patients.title}</p>
      <button onClick={() => router.push("/patients")} className="text-sm text-[#1960a3] hover:underline">{t.common.back}</button>
    </div>
  );

  const firstName = patient.firstName as string;
  const lastName = patient.lastName as string;
  const fullName = `${firstName} ${lastName}`;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview",     label: "Overview",        icon: "person" },
    { key: "appointments", label: t.nav.appointments, icon: "calendar_month" },
    { key: "emr",          label: "EMR",             icon: "medical_information" },
    { key: "billing",      label: t.nav.billing,     icon: "receipt_long" },
  ];

  const appointments = (patient.appointments as unknown[]) ?? [];
  const consultations = (patient.consultations as unknown[]) ?? [];
  const invoices = (patient.invoices as unknown[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/patients")} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{fullName}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">MRN: {patient.mrn as string}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            {t.patients.editPatient}
          </button>
          <Link href={`/appointments?patientId=${id}&action=book`} className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
            {t.patients.bookAppt}
          </Link>
          <Link href={`/billing/new?patientId=${id}`} className="flex items-center gap-2 border border-[#c4c6cf] bg-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            {t.billing.newInvoice}
          </Link>
          <Link href={`/emr/${id}`} className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">medical_information</span>
            {t.patients.viewEmr}
          </Link>
        </div>
      </div>

      {/* Patient card */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#002045] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-bold">{getInitials(fullName)}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 flex-1">
            <Info label={t.patients.dateOfBirth} value={patient.dateOfBirth ? formatDate(patient.dateOfBirth as string) : "—"} />
            <Info label="Age" value={patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth as string)} ${t.common.yrs}` : "—"} />
            <Info label={t.common.type} value={patient.gender as string ?? "—"} />
            <Info label="Blood Type" value={patient.bloodType ? (BLOOD_LABELS[patient.bloodType as string] ?? patient.bloodType as string) : "—"} blood />
            <Info label={t.patients.nationalId} value={(patient.nationalId as string) ?? "—"} />
            <Info label={t.common.phone} value={(patient.phone as string) ?? "—"} />
            <Info label={t.common.email} value={(patient.email as string) ?? "—"} />
            <Info label="Insurance" value={(patient.insuranceProvider as string) ?? t.patients.noInsurance} />
            <Info label="Allergies" value={(patient.allergies as string[])?.join(", ") || "None documented"} full />
            <Info label="Chronic Conditions" value={(patient.chronicConditions as string[])?.join(", ") || "None documented"} full />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#e3e2e6]">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key ? "border-[#1960a3] text-[#1960a3]" : "border-transparent text-[#74777f] hover:text-[#43474e]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon="calendar_month" label={t.nav.appointments} value={String(appointments.length)} color="text-[#1960a3]" bg="bg-[#d3e4ff]" />
            <StatCard icon="medical_information" label="Consultations" value={String(consultations.length)} color="text-[#0d9488]" bg="bg-[#ccfbf1]" />
            <StatCard icon="receipt_long" label={t.nav.billing} value={String(invoices.length)} color="text-[#d97706]" bg="bg-[#fffbeb]" />
          </div>
        )}

        {activeTab === "appointments" && (
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            {appointments.length === 0 ? (
              <EmptyState icon="calendar_month" title="No appointments" subtitle="Appointments for this patient will appear here" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>{["Date & Time", "Doctor", "Type", "Status", "Reason"].map((h) => (
                    <th key={h} className="text-start text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(appointments as Record<string, unknown>[]).map((a) => (
                    <tr key={a.id as string} onClick={() => router.push(`/appointments/${a.id as string}`)} className="hover:bg-[#f4f3f7] transition-colors cursor-pointer">
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-xs font-mono text-[#43474e]">{formatDateTime(a.scheduledAt as string)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#1a1c1e]">{((a.doctor as Record<string, unknown>)?.user as Record<string, unknown>)?.name as string ?? "—"}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#43474e]">{a.type as string}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#d3e4ff] text-[#00477f]">{a.status as string}</span>
                      </td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#74777f]">{(a.reason as string) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "emr" && (
          <div className="space-y-4">
            {consultations.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#e3e2e6]">
                <EmptyState icon="medical_information" title="No consultations yet" subtitle="EMR entries will appear here after the first consultation" />
              </div>
            ) : (
              (consultations as Record<string, unknown>[]).map((c) => (
                <div key={c.id as string} className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#1a1c1e]">{formatDateTime(c.createdAt as string)}</p>
                    <Link href={`/emr/${id}`} className="text-xs text-[#1960a3] hover:underline font-semibold">Full EMR</Link>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {!!c.subjective && <Info label="Subjective" value={c.subjective as string} />}
                    {!!c.assessment && <Info label="Assessment" value={c.assessment as string} />}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "billing" && (
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            {invoices.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#74777f] text-2xl">receipt_long</span>
                </div>
                <p className="text-sm font-semibold text-[#1a1c1e]">No invoices</p>
                <p className="text-xs text-[#74777f]">Billing records for this patient will appear here</p>
                <Link href={`/billing/new?patientId=${id}`} className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity mt-1">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {t.billing.newInvoice}
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {["Invoice #", "Date", "Total", "Paid", "Balance", "Status", ""].map((h) => (
                      <th key={h} className="text-start text-xs font-semibold text-[#43474e] uppercase tracking-wider px-5 py-3.5 bg-[#f4f3f7] border-b border-[#e3e2e6]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(invoices as Record<string, unknown>[]).map((inv) => (
                    <tr key={inv.id as string} className="hover:bg-[#f4f3f7] transition-colors">
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-xs font-mono font-semibold text-[#43474e]">{inv.invoiceNo as string}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-xs text-[#74777f]">{formatDate(inv.createdAt as string)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm font-semibold text-[#1a1c1e]">{Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#0d9488]">{Number(inv.paidAmount).toFixed(2)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6] text-sm text-[#ba1a1a]">{Number(inv.balance).toFixed(2)}</td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${inv.status === "PAID" ? "bg-[#ccfbf1] text-[#0d9488]" : inv.status === "OVERDUE" ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#fffbeb] text-[#d97706]"}`}>{inv.status as string}</span>
                      </td>
                      <td className="px-5 py-3.5 border-b border-[#e3e2e6]">
                        <button onClick={() => router.push(`/billing/${inv.id as string}`)} className="text-xs text-[#1960a3] font-semibold hover:underline">
                          {t.common.view}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Attachments */}
      <AttachmentPanel entityType="patient" entityId={id} />

      {/* Edit Log */}
      <EditLog entityId={id} />

      {/* Edit Modal */}
      {editOpen && (
        <EditPatientModal
          patient={patient}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => { setPatient(updated); setEditOpen(false); }}
        />
      )}
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────────────────────
function EditPatientModal({ patient, onClose, onSaved }: {
  patient: Patient;
  onClose: () => void;
  onSaved: (p: Patient) => void;
}) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"basic" | "contact" | "medical" | "insurance">("basic");

  const [form, setForm] = useState({
    firstName:              (patient.firstName as string) ?? "",
    lastName:               (patient.lastName as string) ?? "",
    dateOfBirth:            patient.dateOfBirth ? (patient.dateOfBirth as string).slice(0, 10) : "",
    gender:                 (patient.gender as string) ?? "MALE",
    nationality:            (patient.nationality as string) ?? "",
    nationalId:             (patient.nationalId as string) ?? "",
    phone:                  (patient.phone as string) ?? "",
    email:                  (patient.email as string) ?? "",
    address:                (patient.address as string) ?? "",
    bloodType:              (patient.bloodType as string) ?? "",
    allergies:              ((patient.allergies as string[]) ?? []).join(", "),
    chronicConditions:      ((patient.chronicConditions as string[]) ?? []).join(", "),
    emergencyContactName:   (patient.emergencyContactName as string) ?? "",
    emergencyContactPhone:  (patient.emergencyContactPhone as string) ?? "",
    insuranceProvider:      (patient.insuranceProvider as string) ?? "",
    insurancePolicyNo:      (patient.insurancePolicyNo as string) ?? "",
    insuranceCoverageType:  (patient.insuranceCoverageType as string) ?? "",
    insuranceExpiry:        patient.insuranceExpiry ? (patient.insuranceExpiry as string).slice(0, 10) : "",
    notes:                  (patient.notes as string) ?? "",
  });

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!form.firstName || !form.lastName) { setError(t.common.required); return; }
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = {
        ...form,
        allergies: form.allergies.split(",").map(s => s.trim()).filter(Boolean),
        chronicConditions: form.chronicConditions.split(",").map(s => s.trim()).filter(Boolean),
      };
      if (!body.dateOfBirth) delete body.dateOfBirth;
      if (!body.insuranceExpiry) delete body.insuranceExpiry;
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.detail || t.common.error); return; }
      onSaved(await res.json());
    } catch { setError(t.common.error); }
    finally { setSaving(false); }
  }

  const SECTIONS = [
    { key: "basic" as const,     label: t.patients.basicInfo,     icon: "person" },
    { key: "contact" as const,   label: t.patients.contactInfo,   icon: "call" },
    { key: "medical" as const,   label: t.patients.medicalInfo,   icon: "medication" },
    { key: "insurance" as const, label: t.patients.insuranceInfo, icon: "health_and_safety" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e2e6]">
          <h2 className="text-lg font-bold text-[#1a1c1e]">{t.patients.editPatient}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
            <span className="material-symbols-outlined text-[#74777f]">close</span>
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-0 border-b border-[#e3e2e6] px-6 overflow-x-auto">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                section === s.key ? "border-[#1960a3] text-[#1960a3]" : "border-transparent text-[#74777f] hover:text-[#43474e]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{error}</div>}

          {section === "basic" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.patients.firstName + " *"}><input className="input-field" value={form.firstName} onChange={e => set("firstName", e.target.value)} /></Field>
              <Field label={t.patients.lastName + " *"}><input className="input-field" value={form.lastName} onChange={e => set("lastName", e.target.value)} /></Field>
              <Field label={t.patients.dateOfBirth}><input type="date" className="input-field" value={form.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} /></Field>
              <Field label={t.patients.gender}>
                <select className="input-field" value={form.gender} onChange={e => set("gender", e.target.value)}>
                  <option value="MALE">{t.common.male}</option>
                  <option value="FEMALE">{t.common.female}</option>
                  <option value="OTHER">{t.common.other}</option>
                </select>
              </Field>
              <Field label={t.patients.nationality}><input className="input-field" value={form.nationality} onChange={e => set("nationality", e.target.value)} /></Field>
              <Field label={t.patients.nationalId}><input className="input-field" value={form.nationalId} onChange={e => set("nationalId", e.target.value)} /></Field>
            </div>
          )}

          {section === "contact" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.common.phone}><input className="input-field" value={form.phone} onChange={e => set("phone", e.target.value)} /></Field>
              <Field label={t.common.email}><input type="email" className="input-field" value={form.email} onChange={e => set("email", e.target.value)} /></Field>
              <Field label={t.common.address} full><input className="input-field" value={form.address} onChange={e => set("address", e.target.value)} /></Field>
              <Field label="Emergency Contact"><input className="input-field" value={form.emergencyContactName} onChange={e => set("emergencyContactName", e.target.value)} /></Field>
              <Field label="Emergency Phone"><input className="input-field" value={form.emergencyContactPhone} onChange={e => set("emergencyContactPhone", e.target.value)} /></Field>
            </div>
          )}

          {section === "medical" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Blood Type">
                <select className="input-field" value={form.bloodType} onChange={e => set("bloodType", e.target.value)}>
                  <option value="">{t.common.none}</option>
                  {BLOOD_TYPES.map(b => <option key={b} value={b}>{BLOOD_LABELS[b]}</option>)}
                </select>
              </Field>
              <Field label="Allergies (comma separated)" full>
                <input className="input-field" value={form.allergies} onChange={e => set("allergies", e.target.value)} placeholder="Penicillin, Aspirin" />
              </Field>
              <Field label="Chronic Conditions (comma separated)" full>
                <input className="input-field" value={form.chronicConditions} onChange={e => set("chronicConditions", e.target.value)} placeholder="Diabetes, Hypertension" />
              </Field>
              <Field label={t.common.notes} full>
                <textarea className="input-field resize-none" rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} />
              </Field>
            </div>
          )}

          {section === "insurance" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Insurance Provider" full><input className="input-field" value={form.insuranceProvider} onChange={e => set("insuranceProvider", e.target.value)} /></Field>
              <Field label="Policy Number"><input className="input-field" value={form.insurancePolicyNo} onChange={e => set("insurancePolicyNo", e.target.value)} /></Field>
              <Field label="Coverage Type"><input className="input-field" value={form.insuranceCoverageType} onChange={e => set("insuranceCoverageType", e.target.value)} /></Field>
              <Field label="Expiry Date"><input type="date" className="input-field" value={form.insuranceExpiry} onChange={e => set("insuranceExpiry", e.target.value)} /></Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : t.hr.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value, full, blood }: { label: string; value: string; full?: boolean; blood?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider">{label}</p>
      {blood && value !== "—" ? (
        <span className="inline-block mt-0.5 text-sm font-bold px-2 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a]">{value}</span>
      ) : (
        <p className="text-sm text-[#1a1c1e] mt-0.5">{value}</p>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: string; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className={`p-2.5 ${bg} rounded-xl`}><span className={`material-symbols-outlined ${color} text-[22px]`}>{icon}</span></div>
      <div><p className="text-xl font-bold text-[#1a1c1e]">{value}</p><p className="text-xs text-[#74777f]">{label}</p></div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3">
      <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
        <span className="material-symbols-outlined text-[#74777f] text-2xl">{icon}</span>
      </div>
      <p className="text-sm font-semibold text-[#1a1c1e]">{title}</p>
      <p className="text-xs text-[#74777f]">{subtitle}</p>
    </div>
  );
}

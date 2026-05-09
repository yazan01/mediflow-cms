"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Doctor {
  id: string;
  user: { name: string };
  specialization: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    scheduledAt: "",
    scheduledEnd: "",
    type: "CONSULTATION",
    reason: "",
    notes: "",
    isUrgent: false,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/doctors").then((r) => r.ok ? r.json() : { data: [] }),
      fetch("/api/patients?pageSize=50").then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([doc, pat]) => {
      setDoctors(doc.data ?? []);
      setPatients(pat.data ?? []);
    });
  }, []);

  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q)
    );
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.doctorId || !form.scheduledAt) {
      setError(t.appointments.requiredFields);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          scheduledEnd: form.scheduledEnd ? new Date(form.scheduledEnd).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t.appointments.createFailed); return; }
      router.push("/appointments");
    } catch {
      setError(t.appointments.networkError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} aria-label={t.common.back} className="p-2 hover:bg-[var(--surface2)] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[var(--txt2)]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--txt1)]">{t.appointments.newAppointment}</h1>
          <p className="text-sm text-[var(--txt2)] mt-0.5">{t.appointments.scheduleTitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] p-6 space-y-6">

        {error && (
          <div className="bg-[var(--err-bg)] border border-[var(--err)]/20 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--err)] text-[20px]">error</span>
            <p className="text-sm text-[var(--err)] font-medium">{error}</p>
          </div>
        )}

        {/* Patient selection */}
        <div>
          <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.appointments.patientLabel}</label>
          <input
            className="input-field mb-2"
            placeholder={t.appointments.patientSearch}
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
          />
          {patientSearch && (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <p className="text-sm text-[var(--txt2)] p-3">{t.appointments.noPatients}</p>
              ) : (
                filteredPatients.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setForm((f) => ({ ...f, patientId: p.id })); setPatientSearch(`${p.firstName} ${p.lastName} (${p.mrn})`); }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-[var(--surface2)] border-b border-[var(--border)] last:border-b-0 transition-colors ${form.patientId === p.id ? "bg-[var(--blue-bg)]/30 font-semibold text-[var(--blue)]" : ""}`}
                  >
                    <span className="font-semibold">{p.firstName} {p.lastName}</span>
                    <span className="text-[var(--txt2)] ms-2 text-xs">{p.mrn}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Doctor */}
        <div>
          <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.appointments.doctorLabel}</label>
          <select
            className="input-field"
            value={form.doctorId}
            onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
            required
          >
            <option value="">{t.appointments.selectDoctor}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.user.name} — {d.specialization}</option>
            ))}
          </select>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.appointments.startTime}</label>
            <input
              type="datetime-local"
              className="input-field"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.appointments.endTime}</label>
            <input
              type="datetime-local"
              className="input-field"
              value={form.scheduledEnd}
              onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
            />
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.appointments.apptType}</label>
          <select
            className="input-field"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="CONSULTATION">{t.appointments.consultation}</option>
            <option value="FOLLOW_UP">{t.appointments.followUp}</option>
            <option value="PROCEDURE">{t.appointments.procedure}</option>
            <option value="LAB_VISIT">{t.appointments.labVisit}</option>
            <option value="IMAGING">{t.appointments.imaging}</option>
            <option value="EMERGENCY">{t.appointments.emergency}</option>
            <option value="DENTAL">{t.appointments.dental}</option>
            <option value="CHECKUP">{t.appointments.checkUp}</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.appointments.chiefComplaint}</label>
          <input
            className="input-field"
            placeholder={t.appointments.reasonPlaceholder}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5">{t.appointments.additionalNotes}</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder={t.appointments.notesPlaceholder}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {/* Urgent toggle */}
        <div className="flex items-center gap-3 p-4 bg-[#fffbeb] border border-[#d97706]/20 rounded-xl">
          <input
            type="checkbox"
            id="urgent"
            checked={form.isUrgent}
            onChange={(e) => setForm((f) => ({ ...f, isUrgent: e.target.checked }))}
            className="w-4 h-4 accent-[#002045]"
          />
          <label htmlFor="urgent" className="text-sm font-semibold text-[var(--txt1)] cursor-pointer">
            {t.appointments.markUrgent}
          </label>
          <p className="text-xs text-[var(--txt2)]">{t.appointments.urgentNote}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded-lg border border-[var(--border2)] text-sm font-semibold text-[var(--txt2)] hover:bg-[var(--surface2)] transition-colors">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[var(--brand)] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>{t.appointments.saving}</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">calendar_add_on</span>{t.appointments.bookBtn}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

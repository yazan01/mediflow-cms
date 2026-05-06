"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
      setError("Patient, doctor, and date/time are required.");
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
      if (!res.ok) { setError(data.error ?? "Failed to create appointment"); return; }
      router.push("/appointments");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">New Appointment</h1>
          <p className="text-sm text-[#74777f] mt-0.5">Schedule an appointment for a patient</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 space-y-6">

        {error && (
          <div className="bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[20px]">error</span>
            <p className="text-sm text-[#ba1a1a] font-medium">{error}</p>
          </div>
        )}

        {/* Patient selection */}
        <div>
          <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Patient</label>
          <input
            className="input-field mb-2"
            placeholder="Search by name or MRN..."
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
          />
          {patientSearch && (
            <div className="border border-[#e3e2e6] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <p className="text-sm text-[#74777f] p-3">No patients found</p>
              ) : (
                filteredPatients.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setForm((f) => ({ ...f, patientId: p.id })); setPatientSearch(`${p.firstName} ${p.lastName} (${p.mrn})`); }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-[#f4f3f7] border-b border-[#e3e2e6] last:border-b-0 transition-colors ${form.patientId === p.id ? "bg-[#d3e4ff]/30 font-semibold text-[#1960a3]" : ""}`}
                  >
                    <span className="font-semibold">{p.firstName} {p.lastName}</span>
                    <span className="text-[#74777f] ml-2 text-xs">{p.mrn}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Doctor */}
        <div>
          <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Doctor</label>
          <select
            className="input-field"
            value={form.doctorId}
            onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
            required
          >
            <option value="">Select a doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.user.name} — {d.specialization}</option>
            ))}
          </select>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Start Date & Time</label>
            <input
              type="datetime-local"
              className="input-field"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">End Time (optional)</label>
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
          <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Appointment Type</label>
          <select
            className="input-field"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="CONSULTATION">Consultation</option>
            <option value="FOLLOW_UP">Follow-up</option>
            <option value="PROCEDURE">Procedure</option>
            <option value="LAB_VISIT">Lab Visit</option>
            <option value="IMAGING">Imaging</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="DENTAL">Dental</option>
            <option value="CHECKUP">Check-up</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Chief Complaint / Reason</label>
          <input
            className="input-field"
            placeholder="Reason for visit..."
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">Additional Notes</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="Any relevant notes..."
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
          <label htmlFor="urgent" className="text-sm font-semibold text-[#1a1c1e] cursor-pointer">
            Mark as Urgent
          </label>
          <p className="text-xs text-[#74777f]">Urgent appointments are highlighted in the schedule view</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e2e6]">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded-lg border border-[#c4c6cf] text-sm font-semibold text-[#43474e] hover:bg-[#f4f3f7] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#002045] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Saving...</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">calendar_add_on</span>Book Appointment</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

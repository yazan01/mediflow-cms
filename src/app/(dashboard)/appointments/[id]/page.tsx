"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate, formatDateTime, calculateAge } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import EditLog from "@/components/layout/EditLog";

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−",
  AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SCHEDULED:       { bg: "bg-[#d3e4ff]",  text: "text-[#00477f]" },
  CHECKED_IN:      { bg: "bg-[#ccfbf1]",  text: "text-[#0d9488]" },
  IN_CONSULTATION: { bg: "bg-[#ffddba]",  text: "text-[#633f0f]" },
  COMPLETED:       { bg: "bg-[#d6e3ff]",  text: "text-[#002045]" },
  NO_SHOW:         { bg: "bg-[#ffdad6]",  text: "text-[#ba1a1a]" },
  CANCELLED:       { bg: "bg-[#e3e2e6]",  text: "text-[#74777f]" },
  URGENT:          { bg: "bg-[#ffdad6]",  text: "text-[#ba1a1a]" },
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const [appt, setAppt] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ sent: boolean; phone: string; message: string; configured: boolean } | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    fetch(`/api/appointments/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setAppt)
      .finally(() => setLoading(false));
  }, [id]);

  async function sendReminder() {
    setSendingReminder(true);
    setReminderResult(null);
    try {
      const res = await fetch(`/api/appointments/${id}/remind`, { method: "POST" });
      const data = await res.json();
      setReminderResult(data);
    } catch { /* ignore */ }
    finally { setSendingReminder(false); }
  }

  async function updateStatus(status: string) {
    setUpdating(true);
    const body: Record<string, unknown> = { status };
    if (status === "CHECKED_IN") body.checkedInAt = new Date().toISOString();
    if (status === "COMPLETED")  body.completedAt  = new Date().toISOString();
    if (status === "CANCELLED")  body.cancelledAt  = new Date().toISOString();
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) setAppt(await res.json());
    setUpdating(false);
  }

  function getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED:       t.appointments.scheduled,
      CHECKED_IN:      t.appointments.checkedIn,
      IN_CONSULTATION: t.appointments.inConsultation,
      COMPLETED:       t.appointments.completed,
      NO_SHOW:         t.appointments.noShow,
      CANCELLED:       t.appointments.cancelled,
      URGENT:          t.appointments.urgent,
    };
    return map[status] ?? status;
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
    </div>
  );

  if (!appt) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">event_busy</span>
      <p className="text-sm font-semibold text-[#1a1c1e]">{t.appointments.notFound}</p>
      <button onClick={() => router.push("/appointments")} className="text-sm text-[#1960a3] hover:underline">
        {t.appointments.backToList}
      </button>
    </div>
  );

  const status = appt.status as string;
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.SCHEDULED;
  const statusLabel = getStatusLabel(status);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/appointments")} aria-label={t.common.back} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.appointments.detailTitle}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{formatDateTime(appt.scheduledAt as string)}</p>
        </div>
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${colors.bg} ${colors.text}`}>{statusLabel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main info */}
        <div className="md:col-span-2 space-y-5">

          {/* Appointment card */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{t.appointments.appointmentInfo}</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Info label={t.appointments.dateTime}           value={formatDateTime(appt.scheduledAt as string)} />
              <Info label={t.appointments.endDateTime}        value={appt.scheduledEnd ? formatDateTime(appt.scheduledEnd as string) : "—"} />
              <Info label={t.common.type}                     value={appt.type as string} />
              <Info label={t.common.room}                     value={(appt.room as string) ?? "—"} />
              <Info label={t.appointments.doctor}             value={(appt.doctorName as string) ?? "—"} />
              <Info label={t.appointments.specialization}     value={(appt.specialization as string) ?? "—"} />
              <Info label={t.common.reason}                   value={(appt.reason as string) ?? "—"} full />
              {!!(appt.notes as string) && <Info label={t.appointments.notes} value={appt.notes as string} full />}
              {!!(appt.chiefComplaint as string) && <Info label={t.appointments.chiefComplaintLabel} value={appt.chiefComplaint as string} full />}
              {!!(appt.assessment as string) && <Info label={t.appointments.assessment} value={appt.assessment as string} full />}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{t.common.actions}</h2>
            <div className="flex flex-wrap gap-3">
              {status === "SCHEDULED" && (
                <ActionBtn icon="login" label={t.appointments.checkIn} color="bg-[#0d9488] text-white" onClick={() => updateStatus("CHECKED_IN")} loading={updating} />
              )}
              {status === "CHECKED_IN" && (
                <ActionBtn icon="stethoscope" label={t.appointments.startConsultation} color="bg-[#1960a3] text-white" onClick={() => updateStatus("IN_CONSULTATION")} loading={updating} />
              )}
              {(status === "IN_CONSULTATION" || status === "CHECKED_IN") && (
                <ActionBtn icon="check_circle" label={t.appointments.markCompleted} color="bg-[#002045] text-white" onClick={() => updateStatus("COMPLETED")} loading={updating} />
              )}
              {status === "COMPLETED" && !!(appt.patientId) && (
                <ActionBtn icon="clinical_notes" label={t.appointments.openEMR} color="bg-[#002045] text-white" onClick={() => router.push(`/emr/${appt.patientId}`)} />
              )}
              {status === "SCHEDULED" && (
                <ActionBtn icon="person_off" label={t.appointments.markNoShow} color="bg-[#e3e2e6] text-[#43474e]" onClick={() => updateStatus("NO_SHOW")} loading={updating} />
              )}
              {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status) && (
                <ActionBtn icon="cancel" label={t.appointments.cancelAppt} color="bg-[#ffdad6] text-[#ba1a1a]" onClick={() => updateStatus("CANCELLED")} loading={updating} />
              )}
              <ActionBtn icon="person" label={t.appointments.patientProfile} color="bg-[#f4f3f7] text-[#43474e]" onClick={() => router.push(`/patients/${appt.patientId}`)} />
              {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status) && (
                <ActionBtn icon="chat" label={sendingReminder ? "Sending..." : "WhatsApp Reminder"} color="bg-[#d4f7dc] text-[#1a7d3a]" onClick={sendReminder} loading={sendingReminder} />
              )}
            </div>

            {/* Reminder result panel */}
            {reminderResult && (
              <div className={`mt-4 p-3 rounded-xl border text-sm ${reminderResult.sent ? "bg-[#d4f7dc] border-[#1a7d3a]/20 text-[#1a7d3a]" : "bg-[#f0fdf4] border-[#1a7d3a]/20 text-[#1a1c1e]"}`}>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">{reminderResult.sent ? "check_circle" : "chat"}</span>
                  <div className="flex-1 min-w-0">
                    {reminderResult.sent ? (
                      <p className="font-semibold">WhatsApp reminder sent to {reminderResult.phone} ✓</p>
                    ) : (
                      <>
                        <p className="font-semibold text-[#1a7d3a]">
                          {reminderResult.configured ? "Send failed — message preview:" : "WhatsApp not configured — message preview:"}
                        </p>
                        <p className="text-xs text-[#43474e] mt-1 italic">To: {reminderResult.phone}</p>
                        <pre className="text-xs text-[#43474e] mt-1.5 bg-white/70 p-2.5 rounded-lg whitespace-pre-wrap font-sans leading-relaxed">{reminderResult.message}</pre>
                        {!reminderResult.configured && (
                          <p className="text-[10px] text-[#74777f] mt-1.5">
                            Add <code className="bg-white/60 px-1 rounded">TWILIO_SID</code>, <code className="bg-white/60 px-1 rounded">TWILIO_TOKEN</code>, <code className="bg-white/60 px-1 rounded">TWILIO_WA_FROM</code> to <code className="bg-white/60 px-1 rounded">backend/.env</code> to enable sending.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={() => setReminderResult(null)} className="flex-shrink-0 text-[#74777f] hover:text-[#1a1c1e]">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Patient sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{t.appointments.patientSection}</h2>
            <button
              onClick={() => router.push(`/patients/${appt.patientId}`)}
              className="w-full text-left hover:bg-[#f4f3f7] rounded-lg p-2 -mx-2 transition-colors mb-3"
            >
              <p className="text-sm font-bold text-[#1960a3]">{appt.patientName as string}</p>
              <p className="text-xs text-[#74777f] font-mono">{appt.mrn as string}</p>
            </button>
            <div className="space-y-3">
              {!!(appt.patientDob) && (
                <Info label={t.patients.dob} value={`${formatDate(appt.patientDob as string)} (${calculateAge(appt.patientDob as string)} yrs)`} />
              )}
              {!!(appt.patientBloodType) && (
                <div>
                  <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider">{t.patients.bloodType}</p>
                  <span className="inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a]">
                    {BLOOD_LABELS[appt.patientBloodType as string] ?? appt.patientBloodType as string}
                  </span>
                </div>
              )}
              {(appt.patientAllergies as string[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#ba1a1a] uppercase tracking-wider mb-1">{t.patients.allergies}</p>
                  <div className="flex flex-wrap gap-1">
                    {(appt.patientAllergies as string[]).map((a) => (
                      <span key={a} className="text-xs bg-[#ffdad6] text-[#93000a] px-1.5 py-0.5 rounded-full font-semibold">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {(appt.patientChronicConditions as string[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1">{t.patients.conditions}</p>
                  <div className="flex flex-wrap gap-1">
                    {(appt.patientChronicConditions as string[]).map((c) => (
                      <span key={c} className="text-xs bg-[#fff7ed] text-[#d97706] px-1.5 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Log */}
      <EditLog entityId={id} />
    </div>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider">{label}</p>
      <p className="text-sm text-[#1a1c1e] mt-0.5">{value}</p>
    </div>
  );
}

function ActionBtn({ icon, label, color, onClick, loading }: {
  icon: string; label: string; color: string; onClick: () => void; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${color}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></span>
      ) : (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      )}
      {label}
    </button>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, formatDateTime, calculateAge } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import EditLog from "@/components/layout/EditLog";
import { apiFetch } from "@/lib/hooks/useDataFetch";

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

const INVOICE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: "bg-[#fff7ed]",  text: "text-[#d97706]" },
  PARTIAL:   { bg: "bg-[#d3e4ff]",  text: "text-[#00477f]" },
  PAID:      { bg: "bg-[#ccfbf1]",  text: "text-[#0d9488]" },
  OVERDUE:   { bg: "bg-[#ffdad6]",  text: "text-[#ba1a1a]" },
  CANCELLED: { bg: "bg-[#e3e2e6]",  text: "text-[#74777f]" },
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const a = t.appointments;

  const [appt, setAppt]                   = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]             = useState(true);
  const [updating, setUpdating]           = useState(false);
  const [startingConsult, setStartingConsult] = useState(false);
  const [consultError, setConsultError]   = useState("");
  const [reminderResult, setReminderResult] = useState<{ sent: boolean; phone: string; message: string; configured: boolean } | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  function fetchAppt() {
    return fetch(`/api/appointments/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setAppt)
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAppt(); }, [id]);

  async function sendReminder() {
    setSendingReminder(true);
    setReminderResult(null);
    try {
      const data = await apiFetch<Record<string, unknown>>(`/api/appointments/${id}/remind`, { method: "POST" });
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
    try {
      const updated = await apiFetch<typeof appt>(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setAppt(updated);
    } catch { /* handled by existing error state */ }
    setUpdating(false);
  }

  async function startConsultation() {
    if (!appt) return;
    setStartingConsult(true);
    setConsultError("");
    try {
      // If consultation already exists, just navigate
      if (appt.consultationId) {
        router.push(`/emr/${appt.patientId}?consultation=${appt.consultationId}`);
        return;
      }
      let data: { id: string };
      try {
        data = await apiFetch<{ id: string }>("/api/consultations", {
          method: "POST",
          body: JSON.stringify({ appointmentId: id }),
        });
      } catch (err: unknown) {
        setConsultError(err instanceof Error ? err.message : "Failed to start consultation");
        return;
      }
      // Refresh appointment data then navigate to EMR with consultation context
      await fetchAppt();
      router.push(`/emr/${appt.patientId}?consultation=${data.id}`);
    } catch { setConsultError("Network error"); }
    finally { setStartingConsult(false); }
  }

  function getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED:       a.scheduled,
      CHECKED_IN:      a.checkedIn,
      IN_CONSULTATION: a.inConsultation,
      COMPLETED:       a.completed,
      NO_SHOW:         a.noShow,
      CANCELLED:       a.cancelled,
      URGENT:          a.urgent,
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
      <p className="text-sm font-semibold text-[#1a1c1e]">{a.notFound}</p>
      <button onClick={() => router.push("/appointments")} className="text-sm text-[#1960a3] hover:underline">
        {a.backToList}
      </button>
    </div>
  );

  const status = appt.status as string;
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.SCHEDULED;
  const statusLabel = getStatusLabel(status);
  const hasConsultation = !!appt.consultationId;
  const hasInvoice = !!appt.invoiceId;
  const isActive = !["CANCELLED", "NO_SHOW"].includes(status);
  const invoiceSt = INVOICE_STATUS_COLORS[appt.invoiceStatus as string ?? "PENDING"];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/appointments")} aria-label={t.common.back} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{a.detailTitle}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{formatDateTime(appt.scheduledAt as string)}</p>
        </div>
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${colors.bg} ${colors.text}`}>{statusLabel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ── Main info ── */}
        <div className="md:col-span-2 space-y-5">

          {/* Appointment card */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{a.appointmentInfo}</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Info label={a.dateTime}           value={formatDateTime(appt.scheduledAt as string)} />
              <Info label={a.endDateTime}        value={appt.scheduledEnd ? formatDateTime(appt.scheduledEnd as string) : "—"} />
              <Info label={t.common.type}        value={appt.type as string} />
              <Info label={t.common.room}        value={(appt.room as string) ?? "—"} />
              <Info label={a.doctor}             value={(appt.doctorName as string) ?? "—"} />
              <Info label={a.specialization}     value={(appt.specialization as string) ?? "—"} />
              <Info label={t.common.reason}      value={(appt.reason as string) ?? "—"} full />
              {!!(appt.notes as string)          && <Info label={a.notes} value={appt.notes as string} full />}
              {!!(appt.chiefComplaint as string) && <Info label={a.chiefComplaintLabel} value={appt.chiefComplaint as string} full />}
              {!!(appt.assessment as string)     && <Info label={a.assessment} value={appt.assessment as string} full />}
            </div>
          </div>

          {/* ── Consultation card ── */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">{a.consultationCard}</h2>
              {hasConsultation && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  appt.consultationLocked ? "bg-[#002045] text-white" : "bg-[#ede9fe] text-[#6b21a8]"
                }`}>
                  {appt.consultationLocked ? t.emr.locked : t.emr.draft}
                </span>
              )}
            </div>

            {consultError && (
              <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] rounded-lg px-3 py-2 mb-3">{consultError}</p>
            )}

            {hasConsultation ? (
              <div className="space-y-3">
                {!!appt.chiefComplaint && (
                  <div className="p-3 bg-[#f4f3f7] rounded-lg">
                    <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-1">{a.chiefComplaintLabel}</p>
                    <p className="text-sm text-[#1a1c1e]">{String(appt.chiefComplaint)}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Link
                    href={`/emr/${appt.patientId}?consultation=${appt.consultationId}`}
                    className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                    {a.openConsultation}
                  </Link>
                  <Link
                    href={`/emr/${appt.patientId}`}
                    className="flex items-center gap-2 border border-[#c4c6cf] px-4 py-2 rounded-lg text-sm text-[#43474e] hover:bg-[#f4f3f7] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    {a.openEMR}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-12 h-12 bg-[#f4f3f7] rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#74777f] text-2xl">clinical_notes</span>
                </div>
                <p className="text-sm text-[#74777f]">{a.noConsultationYet}</p>
                {isActive && (
                  <button
                    onClick={startConsultation}
                    disabled={startingConsult}
                    className="flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {startingConsult
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <span className="material-symbols-outlined text-[18px]">stethoscope</span>}
                    {startingConsult ? t.common.loading : a.startConsultation}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Invoice card ── */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">{a.invoiceCard}</h2>
              {hasInvoice && invoiceSt && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${invoiceSt.bg} ${invoiceSt.text}`}>
                  {appt.invoiceStatus as string}
                </span>
              )}
            </div>

            {hasInvoice ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#f4f3f7] rounded-lg">
                  <div>
                    <p className="text-xs text-[#74777f]">{appt.invoiceNo as string}</p>
                    <p className="text-base font-bold text-[#1a1c1e]">
                      {typeof appt.invoiceTotal === "number" ? appt.invoiceTotal.toFixed(2) : "0.00"}
                    </p>
                  </div>
                  <Link
                    href={`/billing?invoice=${appt.invoiceId}`}
                    className="flex items-center gap-2 border border-[#c4c6cf] px-3 py-2 rounded-lg text-sm text-[#43474e] hover:bg-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                    {a.viewInvoice}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-12 h-12 bg-[#f4f3f7] rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#74777f] text-2xl">receipt_long</span>
                </div>
                <p className="text-sm text-[#74777f]">{a.noInvoiceYet}</p>
                {hasConsultation && (
                  <p className="text-xs text-[#74777f] text-center">Invoice will be auto-created when consultation is completed</p>
                )}
                <Link
                  href={`/billing?patient=${appt.patientId}&appointment=${id}`}
                  className="flex items-center gap-2 border border-[#c4c6cf] px-4 py-2 rounded-lg text-sm text-[#43474e] hover:bg-[#f4f3f7] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {a.issueInvoiceNow}
                </Link>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{t.common.actions}</h2>
            <div className="flex flex-wrap gap-3">
              {status === "SCHEDULED" && (
                <ActionBtn icon="login" label={a.checkIn} color="bg-[#0d9488] text-white" onClick={() => updateStatus("CHECKED_IN")} loading={updating} />
              )}
              {status === "CHECKED_IN" && (
                <ActionBtn icon="stethoscope" label={a.startConsultation} color="bg-[#1960a3] text-white" onClick={() => updateStatus("IN_CONSULTATION")} loading={updating} />
              )}
              {(status === "IN_CONSULTATION" || status === "CHECKED_IN") && (
                <ActionBtn icon="check_circle" label={a.markCompleted} color="bg-[#002045] text-white" onClick={() => updateStatus("COMPLETED")} loading={updating} />
              )}
              {status === "SCHEDULED" && (
                <ActionBtn icon="person_off" label={a.markNoShow} color="bg-[#e3e2e6] text-[#43474e]" onClick={() => updateStatus("NO_SHOW")} loading={updating} />
              )}
              {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status) && (
                <ActionBtn icon="cancel" label={a.cancelAppt} color="bg-[#ffdad6] text-[#ba1a1a]" onClick={() => updateStatus("CANCELLED")} loading={updating} />
              )}
              <ActionBtn icon="person" label={a.patientProfile} color="bg-[#f4f3f7] text-[#43474e]" onClick={() => router.push(`/patients/${appt.patientId}`)} />
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

        {/* ── Patient sidebar ── */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h2 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">{a.patientSection}</h2>
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
                    {(appt.patientAllergies as string[]).map((al) => (
                      <span key={al} className="text-xs bg-[#ffdad6] text-[#93000a] px-1.5 py-0.5 rounded-full font-semibold">{al}</span>
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

              {/* Quick links */}
              <div className="pt-2 border-t border-[#e3e2e6] space-y-2">
                <Link href={`/emr/${appt.patientId}`}
                  className="flex items-center gap-2 text-sm text-[#1960a3] font-semibold hover:underline">
                  <span className="material-symbols-outlined text-[16px]">clinical_notes</span>
                  {a.openEMR}
                </Link>
                <Link href={`/emr/${appt.patientId}/new-consultation?appointment=${id}`}
                  className="flex items-center gap-2 text-sm text-[#7c3aed] font-semibold hover:underline">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  {t.emr.newConsultation}
                </Link>
              </div>
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

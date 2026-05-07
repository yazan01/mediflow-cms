"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Appointment } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { QuickConsultationModal } from "@/components/QuickConsultationModal";

interface Doctor { id: string; user: { name: string }; specialization: string }

export default function AppointmentsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const calendarRef = useRef<HTMLDivElement>(null);

  const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; bar: string }> = {
    SCHEDULED:       { label: t.appointments.scheduled,       bg: "bg-[#f0f4ff]",  text: "text-[#43474e]",  bar: "bg-[#74777f]" },
    CHECKED_IN:      { label: t.appointments.checkedIn,       bg: "bg-[#dbeafe]",  text: "text-[#00477f]",  bar: "bg-[#1960a3]" },
    IN_CONSULTATION: { label: t.appointments.inConsultation,  bg: "bg-[#eff6ff]",  text: "text-[#1960a3]",  bar: "bg-[#1960a3]" },
    COMPLETED:       { label: t.appointments.completed,       bg: "bg-[#ccfbf1]",  text: "text-[#0d9488]",  bar: "bg-[#0d9488]" },
    NO_SHOW:         { label: t.appointments.noShow,          bg: "bg-[#ffdad6]",  text: "text-[#93000a]",  bar: "bg-[#ba1a1a]" },
    CANCELLED:       { label: t.appointments.cancelled,       bg: "bg-[#e3e2e6]",  text: "text-[#74777f]",  bar: "bg-[#74777f]" },
    RESCHEDULED:     { label: t.appointments.rescheduled,     bg: "bg-[#ffddba]",  text: "text-[#633f0f]",  bar: "bg-[#d97706]" },
    URGENT:          { label: t.appointments.urgent,          bg: "bg-[#ffdad6]",  text: "text-[#93000a]",  bar: "bg-[#ba1a1a]" },
  };

  const DAYS = t.appointments.days;
  const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM → 7 PM

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors]           = useState<Doctor[]>([]);
  const [loading, setLoading]           = useState(true);
  const [view, setView]                 = useState<"week" | "day" | "list">("week");
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDoctor, setFilterDoctor] = useState("ALL");
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [quickConsult, setQuickConsult] = useState<{ appointmentId: string; patientName: string; doctorName: string } | null>(null);

  // Fetch doctors for filter dropdown
  useEffect(() => {
    fetch("/api/doctors").then((r) => r.ok ? r.json() : []).then(setDoctors).catch(() => {});
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ pageSize: "200" });
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterDoctor !== "ALL") params.set("doctorId", filterDoctor);
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      setAppointments((await res.json()).data ?? []);
    } catch (err) {
      setFetchError(err as Error);
    } finally { setLoading(false); }
  }, [filterStatus, filterDoctor]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // Auto-scroll calendar to current time on mount
  useEffect(() => {
    if (!calendarRef.current) return;
    const now = new Date();
    const hourOffset = now.getHours() - 7; // relative to 7AM start
    const scrollTo = Math.max(0, hourOffset * 80 - 120);
    calendarRef.current.scrollTop = scrollTo;
  }, [view, loading]);

  // ── Helpers ──────────────────────────────────────────────────
  function getWeekDates(date: Date): Date[] {
    const d = new Date(date);
    const diff = d.getDate() - d.getDay();
    return Array.from({ length: 7 }, (_, i) => {
      const wd = new Date(d); wd.setDate(diff + i); return wd;
    });
  }

  /** Compare date using local timezone, not UTC */
  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  /** Parse appointment date respecting naive ISO string as local time */
  function parseLocal(iso: string): Date {
    // Backend returns "2026-05-07T09:00:00" without Z — treat as local
    if (iso && !iso.endsWith("Z") && !iso.includes("+")) {
      return new Date(iso.replace(" ", "T"));
    }
    return new Date(iso);
  }

  const weekDates  = getWeekDates(currentDate);
  const visibleDates = view === "day" ? [currentDate] : weekDates;
  const today = new Date();
  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prevPeriod() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (view === "day" ? 1 : 7));
    setCurrentDate(d);
  }
  function nextPeriod() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (view === "day" ? 1 : 7));
    setCurrentDate(d);
  }

  const stats = {
    total:     appointments.length,
    scheduled: appointments.filter((a) => a.status === "SCHEDULED").length,
    checkedIn: appointments.filter((a) => a.status === "CHECKED_IN").length,
    inConsult: appointments.filter((a) => a.status === "IN_CONSULTATION").length,
    urgent:    appointments.filter((a) => a.status === "URGENT").length,
  };

  // Current time line position
  const now = new Date();
  const nowMinutesFrom7 = (now.getHours() - 7) * 60 + now.getMinutes();
  const nowTop = (nowMinutesFrom7 / 60) * 80 + 56; // px from top of column

  return (
    <div className="flex flex-col h-full -m-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-[#e3e2e6] bg-[#faf9fd] flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1c1e]">{t.appointments.title}</h1>
            <p className="text-sm text-[#74777f] mt-0.5">{stats.total} {t.appointments.title.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Doctor filter */}
            <select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">{t.appointments.allDoctors ?? "All Doctors"}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.user?.name} — {d.specialization}</option>
              ))}
            </select>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">{t.appointments.allStatuses}</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {/* View toggle */}
            <div className="flex bg-[#f4f3f7] rounded-xl p-1">
              {(["week", "day", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                    view === v ? "bg-white text-[#1960a3] shadow-sm" : "text-[#74777f] hover:text-[#1a1c1e]"
                  }`}
                >
                  {v === "week" ? (t.appointments.weekView ?? "Week") :
                   v === "day"  ? (t.appointments.dayView  ?? "Day")  :
                                  (t.appointments.listView ?? "List")}
                </button>
              ))}
            </div>
            <Link
              href="/appointments/new"
              className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t.appointments.newAppointment}
            </Link>
          </div>
        </div>

        {fetchError && <div className="mb-2"><ErrorBanner error={fetchError} onRetry={fetchAppointments} /></div>}

        {/* Stats + navigation */}
        <div className="flex items-center gap-6">
          {[
            { label: t.appointments.total,          value: stats.total,     color: "text-[#1a1c1e]" },
            { label: t.appointments.scheduled,       value: stats.scheduled, color: "text-[#74777f]" },
            { label: t.appointments.checkedIn,       value: stats.checkedIn, color: "text-[#1960a3]" },
            { label: t.appointments.inConsultation,  value: stats.inConsult, color: "text-[#1960a3]" },
            { label: t.appointments.urgent,          value: stats.urgent,    color: "text-[#ba1a1a]" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#74777f]">{s.label}</p>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 bg-[#f4f3f7] rounded-xl p-1">
            <button onClick={prevPeriod} className="p-1.5 hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[18px] text-[#74777f]">chevron_left</span>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm font-semibold text-[#1a1c1e] hover:bg-white rounded-lg transition-colors"
            >
              {t.appointments.today}
            </button>
            <span className="text-sm font-semibold text-[#1a1c1e] px-2">
              {view === "day"
                ? currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                : monthLabel}
            </span>
            <button onClick={nextPeriod} className="p-1.5 hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[18px] text-[#74777f]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {view === "list" ? (
          /* ── LIST VIEW ── */
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="material-symbols-outlined text-[#c4c6cf] text-5xl">event_busy</span>
                <p className="text-sm font-semibold text-[#1a1c1e]">{t.appointments.noAppointments}</p>
                <Link href="/appointments/new" className="text-sm text-[#1960a3] font-semibold hover:underline">
                  {t.appointments.bookFirst}
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {[
                          t.appointments.time ?? "الوقت",
                          t.appointments.patient ?? "المريض",
                          t.appointments.doctor ?? "الطبيب",
                          t.appointments.type ?? "النوع",
                          t.common.room ?? "الغرفة",
                          t.common.status ?? "الحالة",
                          "إجراءات سريعة",
                        ].map((h) => (
                          <th key={h} className="text-start text-xs font-semibold text-[#43474e] uppercase tracking-wider px-4 py-3 bg-[#f4f3f7] border-b border-[#e3e2e6] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {appointments
                        .slice()
                        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                        .map((apt) => {
                          const st = STATUS_STYLES[apt.status] ?? STATUS_STYLES.SCHEDULED;
                          const apptDate = parseLocal(apt.scheduledAt);
                          return (
                            <tr
                              key={apt.id}
                              className="hover:bg-[#f4f3f7] transition-colors cursor-pointer group"
                            >
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]" onClick={() => router.push(`/appointments/${apt.id}`)}>
                                <p className="text-sm font-bold text-[#1a1c1e]">
                                  {apptDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                </p>
                                <p className="text-[10px] text-[#74777f] mt-0.5">
                                  {apptDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]" onClick={() => router.push(`/appointments/${apt.id}`)}>
                                <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors">{apt.patientName}</p>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]" onClick={() => router.push(`/appointments/${apt.id}`)}>
                                <p className="text-sm text-[#43474e]">{apt.doctorName ?? "—"}</p>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]" onClick={() => router.push(`/appointments/${apt.id}`)}>
                                <p className="text-xs text-[#74777f]">{apt.type}</p>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]" onClick={() => router.push(`/appointments/${apt.id}`)}>
                                <p className="text-xs text-[#74777f]">{apt.room ?? "—"}</p>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]" onClick={() => router.push(`/appointments/${apt.id}`)}>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]">
                                <div className="flex items-center gap-1">
                                  <button
                                    aria-label="فتح السجل الطبي"
                                    title="فتح السجل الطبي"
                                    onClick={(e) => { e.stopPropagation(); router.push(`/emr/${apt.patientId}`); }}
                                    className="p-1.5 hover:bg-[#d3e4ff] rounded-lg text-[#74777f] hover:text-[#1960a3] transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                                  </button>
                                  <button
                                    aria-label="استشارة سريعة"
                                    title="استشارة سريعة"
                                    onClick={(e) => { e.stopPropagation(); setQuickConsult({ appointmentId: apt.id, patientName: apt.patientName, doctorName: apt.doctorName ?? "" }); }}
                                    className="p-1.5 hover:bg-[#ccfbf1] rounded-lg text-[#74777f] hover:text-[#0d9488] transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                                  </button>
                                  <button
                                    aria-label="إصدار فاتورة"
                                    title="إصدار فاتورة"
                                    onClick={(e) => { e.stopPropagation(); router.push(`/billing?appointmentId=${apt.id}`); }}
                                    className="p-1.5 hover:bg-[#ffddba] rounded-lg text-[#74777f] hover:text-[#d97706] transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── WEEK / DAY CALENDAR ── */
          <div ref={calendarRef} className="flex-1 overflow-auto bg-[#faf9fd]">
            <div className={`flex ${view === "day" ? "min-w-[400px]" : "min-w-[800px]"}`}>
              {/* Time column */}
              <div className="w-16 border-e border-[#e3e2e6] bg-white sticky start-0 z-10 flex-shrink-0">
                <div className="h-14 border-b border-[#e3e2e6]"></div>
                {HOURS.map((h) => (
                  <div key={h} className="h-20 flex items-start justify-end pe-2 pt-1 text-[10px] text-[#74777f] font-semibold border-b border-[#e3e2e6]">
                    {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              <div className={`flex-1 grid`} style={{ gridTemplateColumns: `repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                {visibleDates.map((date) => {
                  const isToday    = date.toDateString() === today.toDateString();
                  const dateKey    = localDateStr(date);
                  const dayAppts   = appointments.filter((a) => {
                    const apptDate = parseLocal(a.scheduledAt);
                    return localDateStr(apptDate) === dateKey;
                  });

                  return (
                    <div key={dateKey} className="border-e border-[#e3e2e6] last:border-e-0">
                      {/* Day header */}
                      <div className={`h-14 flex flex-col items-center justify-center border-b border-[#e3e2e6] sticky top-0 z-10 ${isToday ? "bg-[#d6e3ff]/20" : "bg-white"}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? "text-[#1960a3]" : "text-[#74777f]"}`}>
                          {DAYS[date.getDay()]}
                        </span>
                        <span className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                          isToday ? "bg-[#002045] text-white" : "text-[#1a1c1e]"
                        }`}>
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Hour grid + appointments */}
                      <div className="relative">
                        {HOURS.map((h) => (
                          <div key={h} className="h-20 border-b border-[#e3e2e6] hover:bg-[#f4f3f7]/40 transition-colors" />
                        ))}

                        {/* Current time indicator */}
                        {isToday && nowMinutesFrom7 >= 0 && nowMinutesFrom7 <= HOURS.length * 60 && (
                          <div
                            className="absolute left-0 right-0 z-30 pointer-events-none"
                            style={{ top: nowTop - 56 }}
                          >
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full bg-[#ba1a1a] flex-shrink-0 -ms-1"></div>
                              <div className="flex-1 h-px bg-[#ba1a1a]"></div>
                            </div>
                          </div>
                        )}

                        {/* Appointment blocks */}
                        {dayAppts.map((apt) => {
                          const startDate   = parseLocal(apt.scheduledAt);
                          const hour        = startDate.getHours();
                          const min         = startDate.getMinutes();
                          const endDate     = apt.scheduledEnd
                            ? parseLocal(apt.scheduledEnd as string)
                            : new Date(startDate.getTime() + 30 * 60000);
                          const durationMin = (endDate.getTime() - startDate.getTime()) / 60000;
                          const topPx       = ((hour - 7) * 80) + (min / 60 * 80);
                          const heightPx    = Math.max((durationMin / 60) * 80, 28);
                          const st          = STATUS_STYLES[apt.status] ?? STATUS_STYLES.SCHEDULED;

                          return (
                            <div
                              key={apt.id}
                              onClick={() => setSelectedAppt(apt)}
                              style={{ top: topPx, height: heightPx, borderInlineStartColor: st.bar.replace("bg-[", "").replace("]", "") }}
                              className={`absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 cursor-pointer hover:shadow-md transition-all z-20 border-s-4 overflow-hidden ${st.bg}`}
                              title={`${apt.patientName} — ${startDate.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}`}
                            >
                              <p className={`text-[11px] font-bold truncate leading-tight ${st.text}`}>
                                {apt.patientName}
                              </p>
                              {heightPx > 36 && (
                                <p className="text-[9px] text-[#74777f] truncate">
                                  {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                  {" · "}{apt.type}
                                </p>
                              )}
                              {heightPx > 52 && (
                                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                                  {st.label}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Consultation Modal ─────────────────────────── */}
      {quickConsult && (
        <QuickConsultationModal
          appointmentId={quickConsult.appointmentId}
          patientName={quickConsult.patientName}
          doctorName={quickConsult.doctorName}
          onClose={() => setQuickConsult(null)}
          onSuccess={fetchAppointments}
        />
      )}

      {/* ── Appointment detail popup ─────────────────────────── */}
      {selectedAppt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedAppt(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#1a1c1e]">{t.appointments.detailTitle}</h3>
              <button onClick={() => setSelectedAppt(null)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[20px] text-[#74777f]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Patient avatar + status */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#002045] text-white rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {selectedAppt.patientName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1a1c1e] truncate">{selectedAppt.patientName}</p>
                  <p className="text-xs text-[#74777f]">{selectedAppt.type}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${STATUS_STYLES[selectedAppt.status]?.bg} ${STATUS_STYLES[selectedAppt.status]?.text}`}>
                  {STATUS_STYLES[selectedAppt.status]?.label}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-[#f4f3f7] rounded-xl">
                <InfoRow icon="calendar_today" label={t.common.date}
                  value={parseLocal(selectedAppt.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} />
                <InfoRow icon="schedule" label={t.common.time}
                  value={parseLocal(selectedAppt.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} />
                <InfoRow icon="stethoscope" label={t.appointments.doctor} value={selectedAppt.doctorName ?? "—"} />
                {selectedAppt.room && <InfoRow icon="meeting_room" label={t.common.room} value={selectedAppt.room} />}
              </div>

              {selectedAppt.reason && (
                <div className="p-3 bg-[#eff6ff] rounded-xl">
                  <p className="text-xs font-semibold text-[#1960a3] mb-1">{t.common.reason}</p>
                  <p className="text-sm text-[#1a1c1e]">{selectedAppt.reason}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setSelectedAppt(null); router.push(`/appointments/${selectedAppt.id}`); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#002045] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  {t.appointments.viewDetail ?? "View Detail"}
                </button>
                <Link
                  href={`/emr/${selectedAppt.patientId}`}
                  className="flex-1 flex items-center justify-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                  {t.appointments.openEMR}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="material-symbols-outlined text-[15px] text-[#74777f] mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] text-[#74777f] font-bold uppercase tracking-wider">{label}</p>
        <p className="text-xs font-semibold text-[#1a1c1e] truncate">{value}</p>
      </div>
    </div>
  );
}

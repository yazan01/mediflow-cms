"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Appointment } from "@/types";

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  SCHEDULED:       { label: "Scheduled",        bg: "bg-[#e9e7eb]",      text: "text-[#43474e]",  dot: "bg-[#74777f]" },
  CHECKED_IN:      { label: "Checked In",       bg: "bg-[#d3e4ff]",      text: "text-[#00477f]",  dot: "bg-[#1960a3]" },
  IN_CONSULTATION: { label: "In Consultation",  bg: "bg-[#dbeafe]",      text: "text-[#1960a3]",  dot: "bg-[#1960a3] animate-pulse" },
  COMPLETED:       { label: "Completed",        bg: "bg-[#ccfbf1]",      text: "text-[#0d9488]",  dot: "bg-[#0d9488]" },
  NO_SHOW:         { label: "No Show",          bg: "bg-[#ffdad6]",      text: "text-[#93000a]",  dot: "bg-[#ba1a1a]" },
  CANCELLED:       { label: "Cancelled",        bg: "bg-[#e3e2e6]",      text: "text-[#74777f]",  dot: "bg-[#74777f]" },
  RESCHEDULED:     { label: "Rescheduled",      bg: "bg-[#ffddba]",      text: "text-[#633f0f]",  dot: "bg-[#d97706]" },
  URGENT:          { label: "Urgent",           bg: "bg-[#ba1a1a]",      text: "text-white",      dot: "bg-white" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "day" | "list">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDoctor, setFilterDoctor] = useState("ALL");

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(filterStatus !== "ALL" && { status: filterStatus }),
        ...(filterDoctor !== "ALL" && { doctorId: filterDoctor }),
      });
      const res = await fetch(`/api/appointments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.data ?? []);
      }
    } catch {
      /* network error */
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDoctor]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // Get week dates
  function getWeekDates(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return Array.from({ length: 7 }, (_, i) => {
      const wd = new Date(d);
      wd.setDate(diff + i);
      return wd;
    });
  }

  const weekDates = getWeekDates(currentDate);

  function prevWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  }
  function nextWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  }

  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = new Date();

  const stats = {
    total: appointments.length,
    scheduled: appointments.filter((a) => a.status === "SCHEDULED").length,
    checkedIn: appointments.filter((a) => a.status === "CHECKED_IN").length,
    inConsult: appointments.filter((a) => a.status === "IN_CONSULTATION").length,
    urgent: appointments.filter((a) => a.status === "URGENT").length,
  };

  return (
    <div className="flex flex-col h-full space-y-0 -m-6">
      <div className="px-6 pt-6 pb-4 border-b border-[#e3e2e6] bg-[#faf9fd]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1c1e]">Appointments</h1>
            <p className="text-sm text-[#74777f] mt-0.5">{stats.total} appointments loaded</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-[#c4c6cf] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <div className="flex bg-[#f4f3f7] rounded-xl p-1">
              {(["week", "day", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                    view === v ? "bg-white text-[#1960a3] shadow-sm" : "text-[#74777f] hover:text-[#1a1c1e]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Link
              href="/appointments/new"
              className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Appointment
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6">
          {[
            { label: "Total", value: stats.total, color: "text-[#1a1c1e]" },
            { label: "Scheduled", value: stats.scheduled, color: "text-[#74777f]" },
            { label: "Checked In", value: stats.checkedIn, color: "text-[#1960a3]" },
            { label: "In Consultation", value: stats.inConsult, color: "text-[#1960a3]" },
            { label: "Urgent", value: stats.urgent, color: "text-[#ba1a1a]" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#74777f]">{s.label}</p>
            </div>
          ))}
          {/* Date navigation */}
          <div className="ml-auto flex items-center gap-2 bg-[#f4f3f7] rounded-xl p-1">
            <button onClick={prevWeek} className="p-1.5 hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[18px] text-[#74777f]">chevron_left</span>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm font-semibold text-[#1a1c1e] hover:bg-white rounded-lg transition-colors"
            >
              Today
            </button>
            <span className="text-sm font-semibold text-[#1a1c1e] px-2">{monthLabel}</span>
            <button onClick={nextWeek} className="p-1.5 hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[18px] text-[#74777f]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar / List body */}
      <div className="flex-1 flex overflow-hidden">
        {view === "list" ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#74777f] text-3xl">event_busy</span>
                </div>
                <p className="text-sm font-semibold text-[#1a1c1e]">No appointments found</p>
                <Link href="/appointments/new" className="text-sm text-[#1960a3] font-semibold hover:underline">
                  Book first appointment →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => {
                  const st = STATUS_STYLES[apt.status] ?? STATUS_STYLES.SCHEDULED;
                  return (
                    <div
                      key={apt.id}
                      onClick={() => setSelectedAppt(apt)}
                      className={`bg-white rounded-xl border border-[#e3e2e6] p-4 flex items-center justify-between hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all cursor-pointer group ${
                        apt.status === "URGENT" ? "border-l-4 border-l-[#ba1a1a]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
                          apt.status === "URGENT" ? "bg-[#ffdad6]" : "bg-[#f4f3f7]"
                        }`}>
                          <span className={`text-sm font-bold ${apt.status === "URGENT" ? "text-[#ba1a1a]" : "text-[#1a1c1e]"}`}>
                            {new Date(apt.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                          <span className="text-[10px] text-[#74777f]">{apt.type}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors">
                            {apt.patientName}
                          </p>
                          <p className="text-xs text-[#74777f]">{apt.type} · {apt.doctorName}</p>
                          {apt.room && <p className="text-xs text-[#74777f]">{apt.room}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-[#74777f] group-hover:text-[#1960a3]">chevron_right</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Week / Day calendar grid */
          <div className="flex-1 overflow-auto bg-[#faf9fd]">
            <div className="flex min-w-[800px]">
              {/* Time column */}
              <div className="w-20 border-r border-[#e3e2e6] bg-white sticky left-0 z-10 flex-shrink-0">
                <div className="h-14 border-b border-[#e3e2e6]"></div>
                {HOURS.map((h) => (
                  <div key={h} className="h-20 flex items-start justify-center pt-2 text-[11px] text-[#74777f] font-semibold border-b border-[#e3e2e6]">
                    {h > 12 ? `${h - 12}:00 PM` : `${h}:00 ${h === 12 ? "PM" : "AM"}`}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              <div className="flex-1 grid grid-cols-7">
                {weekDates.map((date) => {
                  const isToday = date.toDateString() === today.toDateString();
                  const dateStr = date.toISOString().split("T")[0];
                  const dayAppts = appointments.filter((a) => a.scheduledAt?.startsWith(dateStr));

                  return (
                    <div key={dateStr} className="border-r border-[#e3e2e6] last:border-r-0">
                      {/* Day header */}
                      <div className={`h-14 flex flex-col items-center justify-center border-b border-[#e3e2e6] sticky top-0 z-10 ${isToday ? "bg-[#d6e3ff]/30" : "bg-white"}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? "text-[#1960a3]" : "text-[#74777f]"}`}>
                          {DAYS[date.getDay()]}
                        </span>
                        <span className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                          isToday ? "bg-[#002045] text-white" : "text-[#1a1c1e]"
                        }`}>
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Hour slots */}
                      <div className="relative">
                        {HOURS.map((h) => (
                          <div
                            key={h}
                            className="h-20 border-b border-[#e3e2e6] hover:bg-[#f4f3f7]/50 transition-colors cursor-pointer"
                          ></div>
                        ))}

                        {/* Appointments overlay */}
                        {dayAppts.map((apt) => {
                          const startDate = new Date(apt.scheduledAt);
                          const hour = startDate.getHours();
                          const min = startDate.getMinutes();
                          const topOffset = ((hour - 8) * 80) + (min / 60 * 80) + 56;
                          const endDate = apt.scheduledEnd ? new Date(apt.scheduledEnd) : new Date(startDate.getTime() + 30 * 60000);
                          const durationMin = (endDate.getTime() - startDate.getTime()) / 60000;
                          const height = Math.max((durationMin / 60) * 80, 32);
                          const st = STATUS_STYLES[apt.status] ?? STATUS_STYLES.SCHEDULED;
                          const isUrgent = apt.status === "URGENT";

                          return (
                            <div
                              key={apt.id}
                              onClick={() => setSelectedAppt(apt)}
                              style={{ top: topOffset, height }}
                              className={`absolute left-1 right-1 rounded-lg p-1.5 cursor-pointer hover:shadow-md transition-all z-20 border-l-4 overflow-hidden ${
                                isUrgent
                                  ? "bg-[#ffdad6] border-l-[#ba1a1a]"
                                  : "bg-[#d3e4ff]/30 border-l-[#1960a3]"
                              }`}
                            >
                              <p className={`text-[11px] font-bold truncate ${isUrgent ? "text-[#93000a]" : "text-[#00477f]"}`}>
                                {apt.patientName}
                              </p>
                              {height > 40 && (
                                <p className="text-[9px] text-[#74777f] truncate">{apt.type} · {new Date(apt.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</p>
                              )}
                              {height > 55 && (
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>
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

      {/* Appointment detail panel */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedAppt(null)}>
          <div className="bg-white rounded-2xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#1a1c1e]">Appointment Details</h3>
              <button onClick={() => setSelectedAppt(null)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[20px] text-[#74777f]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#1a365d] text-white rounded-xl flex items-center justify-center text-sm font-bold">
                  {selectedAppt.patientName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <p className="font-bold text-[#1a1c1e]">{selectedAppt.patientName}</p>
                  <p className="text-xs text-[#74777f]">{selectedAppt.type}</p>
                </div>
                <div className="ml-auto">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_STYLES[selectedAppt.status]?.bg} ${STATUS_STYLES[selectedAppt.status]?.text}`}>
                    {STATUS_STYLES[selectedAppt.status]?.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-[#f4f3f7] rounded-xl">
                <InfoRow icon="calendar_today" label="Date" value={new Date(selectedAppt.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} />
                <InfoRow icon="schedule" label="Time" value={new Date(selectedAppt.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} />
                <InfoRow icon="stethoscope" label="Doctor" value={selectedAppt.doctorName} />
                {selectedAppt.room && <InfoRow icon="door_front" label="Room" value={selectedAppt.room} />}
              </div>

              {selectedAppt.notes && (
                <div className="p-3 bg-[#eff6ff] rounded-xl">
                  <p className="text-xs font-semibold text-[#1960a3] mb-1">Notes</p>
                  <p className="text-sm text-[#1a1c1e]">{selectedAppt.notes}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Link
                  href={`/emr/${selectedAppt.patientId}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#002045] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                  Open EMR
                </Link>
                <button className="flex-1 flex items-center justify-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Edit
                </button>
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
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-[16px] text-[#74777f]">{icon}</span>
      <div>
        <p className="text-[10px] text-[#74777f] font-semibold uppercase">{label}</p>
        <p className="text-sm font-semibold text-[#1a1c1e]">{value}</p>
      </div>
    </div>
  );
}

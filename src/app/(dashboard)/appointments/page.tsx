"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Appointment } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { QuickConsultationModal } from "@/components/QuickConsultationModal";
import { useDebounce } from "@/lib/hooks/useDebounce";

// ── Local types ────────────────────────────────────────────────────────────────

interface Doctor {
  id: string; name: string; user?: { name: string };
  specialization: string; departmentName?: string;
  jobTitle?: string; empCode?: string;
  branchId?: string; branchName?: string;
}
interface Branch { id: string; name: string; code: string; }
interface Patient { id: string; firstName: string; lastName: string; mrn: string; }
interface WorkingConfig {
  startTime: string; endTime: string;
  workingDays: string[]; slotDuration: number;
}
interface OverlapInfo { col: number; totalCols: number; }

// ── Type color map (color by appointment type, not status) ─────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; barHex: string; dotCls: string }> = {
  CONSULTATION: { bg: "bg-[#eff6ff]", text: "text-[#1d4ed8]", barHex: "#1960a3", dotCls: "bg-[#1960a3]" },
  FOLLOW_UP:    { bg: "bg-[#f0fdf4]", text: "text-[#166534]", barHex: "#16a34a", dotCls: "bg-[#16a34a]" },
  PROCEDURE:    { bg: "bg-[#faf5ff]", text: "text-[#6b21a8]", barHex: "#7c3aed", dotCls: "bg-[#7c3aed]" },
  LAB_VISIT:    { bg: "bg-[#fffbeb]", text: "text-[#92400e]", barHex: "#d97706", dotCls: "bg-[#d97706]" },
  IMAGING:      { bg: "bg-[#eef2ff]", text: "text-[#3730a3]", barHex: "#4f46e5", dotCls: "bg-[#4f46e5]" },
  EMERGENCY:    { bg: "bg-[#fef2f2]", text: "text-[#991b1b]", barHex: "#ba1a1a", dotCls: "bg-[#ba1a1a]" },
  DENTAL:       { bg: "bg-[#fdf2f8]", text: "text-[#9d174d]", barHex: "#db2777", dotCls: "bg-[#db2777]" },
  CHECKUP:      { bg: "bg-[#ecfdf5]", text: "text-[#065f46]", barHex: "#0d9488", dotCls: "bg-[#0d9488]" },
};

const STATUS_DOT: Record<string, string> = {
  SCHEDULED:       "bg-[#94a3b8]",
  CHECKED_IN:      "bg-[#1960a3]",
  IN_CONSULTATION: "bg-[#7c3aed]",
  COMPLETED:       "bg-[#0d9488]",
  NO_SHOW:         "bg-[#ba1a1a]",
  CANCELLED:       "bg-[#94a3b8] opacity-50",
  RESCHEDULED:     "bg-[#d97706]",
  URGENT:          "bg-[#ba1a1a] animate-pulse",
};

// ── Overlap detection ──────────────────────────────────────────────────────────

function computeOverlap(appts: Appointment[], parseLocalFn: (s: string) => Date): Map<string, OverlapInfo> {
  const result = new Map<string, OverlapInfo>();
  if (!appts.length) return result;

  const getRange = (a: Appointment) => {
    const start = parseLocalFn(a.scheduledAt).getTime();
    const end = a.scheduledEnd ? parseLocalFn(a.scheduledEnd).getTime() : start + 30 * 60000;
    return { start, end };
  };

  const sorted = [...appts].sort((a, b) => getRange(a).start - getRange(b).start);
  const groups: Appointment[][] = [];

  for (const appt of sorted) {
    const { start, end } = getRange(appt);
    let placed = false;
    for (const group of groups) {
      const overlaps = group.some(g => { const r = getRange(g); return start < r.end && end > r.start; });
      if (overlaps) { group.push(appt); placed = true; break; }
    }
    if (!placed) groups.push([appt]);
  }

  for (const group of groups) {
    const cols: Appointment[][] = [];
    const gs = [...group].sort((a, b) => getRange(a).start - getRange(b).start);
    for (const appt of gs) {
      const { start } = getRange(appt);
      let ci = cols.findIndex(col => { const last = col[col.length - 1]; return start >= getRange(last).end; });
      if (ci === -1) { ci = cols.length; cols.push([]); }
      cols[ci].push(appt);
    }
    const totalCols = cols.length;
    for (let c = 0; c < cols.length; c++) {
      for (const a of cols[c]) result.set(a.id, { col: c, totalCols });
    }
  }
  return result;
}

// ── Mini calendar (sidebar) ────────────────────────────────────────────────────

function MiniCalendar({ value, onChange, appointments, parseLocalFn }: {
  value: Date; onChange: (d: Date) => void;
  appointments: Appointment[]; parseLocalFn: (s: string) => Date;
}) {
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const today = new Date();
  const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const monthLabel = viewMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const apptDays = new Set(
    appointments.flatMap(a => {
      try {
        const d = parseLocalFn(a.scheduledAt);
        if (d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth()) return [d.getDate()];
      } catch { /* ignore */ }
      return [];
    })
  );

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="p-3 border-b border-[#e3e2e6]">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          className="p-1 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[14px] text-[#74777f]">chevron_left</span>
        </button>
        <span className="text-[11px] font-bold text-[#1a1c1e]">{monthLabel}</span>
        <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          className="p-1 hover:bg-[#f4f3f7] rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[14px] text-[#74777f]">chevron_right</span>
        </button>
      </div>
      <div className="grid grid-cols-7">
        {DAYS_SHORT.map((d, i) => (
          <div key={i} className="text-[9px] font-bold text-center text-[#74777f] uppercase py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = day === today.getDate() && viewMonth.getMonth() === today.getMonth() && viewMonth.getFullYear() === today.getFullYear();
          const isSelected = day === value.getDate() && viewMonth.getMonth() === value.getMonth() && viewMonth.getFullYear() === value.getFullYear();
          const hasAppt = apptDays.has(day);
          return (
            <button key={i} onClick={() => onChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day))}
              className={`relative w-7 h-7 mx-auto flex items-center justify-center text-[11px] font-semibold rounded-full transition-all ${
                isSelected ? "bg-[#002045] text-white" :
                isToday ? "bg-[#1960a3]/10 text-[#1960a3] font-bold" :
                "text-[#1a1c1e] hover:bg-[#f4f3f7]"
              }`}>
              {day}
              {hasAppt && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1960a3]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Appointment chip (calendar block) ─────────────────────────────────────────

function ApptChip({ apt, onClick, height, style, parseLocalFn }: {
  apt: Appointment; onClick: () => void;
  height: number; style: React.CSSProperties; parseLocalFn: (s: string) => Date;
}) {
  const tc = TYPE_COLORS[apt.type] ?? TYPE_COLORS.CONSULTATION;
  const startDate = parseLocalFn(apt.scheduledAt);
  const timeStr = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const isUrgent = apt.status === "URGENT" || apt.isUrgent;

  return (
    <div
      onClick={onClick}
      style={{ ...style, borderInlineStartColor: tc.barHex }}
      className={`absolute rounded-lg ps-1.5 pe-1 py-1 cursor-pointer hover:shadow-md hover:brightness-95 transition-all z-20 border-s-[3px] overflow-hidden select-none ${tc.bg} ${isUrgent ? "ring-1 ring-[#ba1a1a]" : ""}`}
    >
      {/* Status dot */}
      <span className={`absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT[apt.status] ?? "bg-[#94a3b8]"}`} />

      <p className={`text-[11px] font-bold truncate leading-tight ${tc.text} pe-2`}>
        {apt.patientName}
      </p>
      {height > 36 && (
        <p className="text-[9px] text-[#74777f] truncate">
          {timeStr}{apt.doctorName ? ` · ${apt.doctorName.split(" ").slice(-1)[0]}` : ""}
        </p>
      )}
      {height > 52 && apt.room && (
        <p className="text-[9px] text-[#74777f] truncate">{apt.room}</p>
      )}
    </div>
  );
}

// ── InfoRow helper ─────────────────────────────────────────────────────────────

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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const calendarRef = useRef<HTMLDivElement>(null);

  const a = t.appointments;

  const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
    SCHEDULED:       { label: a.scheduled,       bg: "bg-[#f1f5f9]", text: "text-[#475569]" },
    CHECKED_IN:      { label: a.checkedIn,       bg: "bg-[#dbeafe]", text: "text-[#1d4ed8]" },
    IN_CONSULTATION: { label: a.inConsultation,  bg: "bg-[#ede9fe]", text: "text-[#6b21a8]" },
    COMPLETED:       { label: a.completed,       bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
    NO_SHOW:         { label: a.noShow,          bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
    CANCELLED:       { label: a.cancelled,       bg: "bg-[#f1f5f9]", text: "text-[#64748b]" },
    RESCHEDULED:     { label: a.rescheduled,     bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
    URGENT:          { label: a.urgent,          bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  };

  const DAYS = a.days;
  const DAY_NAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const CELL_H = 72; // px per hour
  const HOURS_START = 6;
  const HOURS_END = 21;
  const HOURS = Array.from({ length: HOURS_END - HOURS_START }, (_, i) => i + HOURS_START);

  // ── State ──────────────────────────────────────────────────────────────────

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors]           = useState<Doctor[]>([]);
  const [branches, setBranches]         = useState<Branch[]>([]);
  const [workingCfg, setWorkingCfg]     = useState<WorkingConfig>({ startTime: "08:00", endTime: "17:00", workingDays: ["MON","TUE","WED","THU","FRI"], slotDuration: 30 });
  const [loading, setLoading]           = useState(true);
  const [view, setView]                 = useState<"month" | "week" | "day" | "list">("week");
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDoctor, setFilterDoctor] = useState("ALL");
  const [filterBranch, setFilterBranch] = useState("ALL");
  const [fetchError, setFetchError]     = useState<Error | null>(null);
  const [quickConsult, setQuickConsult] = useState<{ appointmentId: string; patientName: string; doctorName: string } | null>(null);

  // Quick book
  const [quickBook, setQuickBook]             = useState<{ date: Date; hour: number; minute: number } | null>(null);
  const [qbPatientSearch, setQbPatientSearch] = useState("");
  const [qbPatients, setQbPatients]           = useState<Patient[]>([]);
  const [qbSelectedPatient, setQbSelectedPatient] = useState<Patient | null>(null);
  const [qbDoctor, setQbDoctor]               = useState("");
  const [qbType, setQbType]                   = useState("CONSULTATION");
  const [qbRoom, setQbRoom]                   = useState("");
  const [qbNotes, setQbNotes]                 = useState("");
  const [qbSaving, setQbSaving]               = useState(false);
  const [qbError, setQbError]                 = useState("");
  const [qbDropdownOpen, setQbDropdownOpen]   = useState(false);

  const debouncedSearch = useDebounce(qbPatientSearch, 300);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function localDateTimeStr(d: Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
  }
  function parseLocal(iso: string): Date {
    if (iso && !iso.endsWith("Z") && !iso.includes("+")) return new Date(iso.replace(" ", "T"));
    return new Date(iso);
  }
  function getWeekDates(date: Date): Date[] {
    const d = new Date(date);
    const diff = d.getDate() - d.getDay();
    return Array.from({ length: 7 }, (_, i) => { const wd = new Date(d); wd.setDate(diff + i); return wd; });
  }
  function isWorkingDay(date: Date): boolean {
    return workingCfg.workingDays.includes(DAY_NAMES[date.getDay()]);
  }
  function workingStartH() { return parseInt(workingCfg.startTime.split(":")[0]); }
  function workingEndH()   { return parseInt(workingCfg.endTime.split(":")[0]); }
  function formatHour(h: number) {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} ${t.common.am}`;
    if (h === 12) return `12 ${t.common.pm}`;
    return `${h - 12} ${t.common.pm}`;
  }

  const today = new Date();
  const weekDates = getWeekDates(currentDate);
  const visibleDates = view === "day" ? [currentDate] : weekDates;

  // Month view
  function getMonthCells(): (Date | null)[] {
    const yr = currentDate.getFullYear(), mo = currentDate.getMonth();
    const firstDay = new Date(yr, mo, 1).getDay();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: firstDay }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(yr, mo, d));
    return cells;
  }

  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Current time indicator
  const nowH = today.getHours(), nowM = today.getMinutes();
  const nowPx = ((nowH - HOURS_START) + nowM / 60) * CELL_H;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ pageSize: "500" });
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterDoctor !== "ALL") params.set("doctorId", filterDoctor);
      if (filterBranch !== "ALL") params.set("branch_id", filterBranch);

      if (view === "week") {
        const s = new Date(weekDates[0]); s.setHours(0,0,0,0);
        const e = new Date(weekDates[6]); e.setHours(23,59,59,999);
        params.set("startDate", localDateTimeStr(s));
        params.set("endDate", localDateTimeStr(new Date(e.getTime() + 1)));
      } else if (view === "day") {
        params.set("date", localDateStr(currentDate));
      } else if (view === "month") {
        const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        params.set("startDate", localDateTimeStr(s));
        params.set("endDate", localDateTimeStr(e));
      } else {
        // list view: today ±30 days
        const s = new Date(today); s.setDate(s.getDate() - 30); s.setHours(0,0,0,0);
        const e = new Date(today); e.setDate(e.getDate() + 30); e.setHours(23,59,59,999);
        params.set("startDate", localDateTimeStr(s));
        params.set("endDate", localDateTimeStr(new Date(e.getTime() + 1)));
      }

      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status });
      setAppointments((await res.json()).data ?? []);
    } catch (err) { setFetchError(err as Error); }
    finally { setLoading(false); }
  }, [filterStatus, filterDoctor, filterBranch, view, currentDate]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    fetch("/api/branches").then(r => r.ok ? r.json() : []).then(setBranches).catch(() => {});
  }, []);

  // Reload doctors when branch filter changes (show only doctors in that branch)
  useEffect(() => {
    const url = filterBranch !== "ALL"
      ? `/api/doctors?branch_id=${filterBranch}`
      : "/api/doctors";
    fetch(url).then(r => r.ok ? r.json() : []).then(setDoctors).catch(() => {});
  }, [filterBranch]);

  // Load branch working config
  useEffect(() => {
    if (filterBranch === "ALL") {
      setWorkingCfg({ startTime: "06:00", endTime: "21:00", workingDays: ["SUN","MON","TUE","WED","THU","FRI","SAT"], slotDuration: 30 });
      return;
    }
    fetch(`/api/appointments/config?branch_id=${filterBranch}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setWorkingCfg(d); })
      .catch(() => {});
  }, [filterBranch]);

  // Auto-scroll: show working hours start (8 AM) with current time visible if possible
  useEffect(() => {
    if (!calendarRef.current || (view !== "week" && view !== "day")) return;
    const workStartPx = (workingStartH() - HOURS_START) * CELL_H;
    // Prefer showing work-start, but shift forward if now is past it + viewport
    const target = Math.min(nowPx - 120, workStartPx);
    calendarRef.current.scrollTop = Math.max(0, target);
  }, [view, loading]);

  // Patient search for quick book
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) { setQbPatients([]); return; }
    fetch(`/api/patients?search=${encodeURIComponent(debouncedSearch)}&pageSize=8`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setQbPatients(d.data ?? []))
      .catch(() => {});
  }, [debouncedSearch]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  function prevPeriod() {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  }
  function nextPeriod() {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  }

  // ── Quick Book ──────────────────────────────────────────────────────────────

  function openQuickBook(date: Date, hour: number, minute = 0) {
    setQuickBook({ date, hour, minute });
    setQbDoctor(filterDoctor !== "ALL" ? filterDoctor : "");
    setQbType("CONSULTATION");
    setQbRoom("");
    setQbNotes("");
    setQbSelectedPatient(null);
    setQbPatientSearch("");
    setQbError("");
  }

  async function handleQuickBook() {
    if (!quickBook || !qbSelectedPatient || !qbDoctor) {
      setQbError(a.requiredFields);
      return;
    }
    setQbSaving(true);
    setQbError("");
    try {
      const d = new Date(quickBook.date);
      d.setHours(quickBook.hour, quickBook.minute, 0, 0);
      const end = new Date(d.getTime() + workingCfg.slotDuration * 60000);
      const body = {
        patientId: qbSelectedPatient.id,
        doctorId: qbDoctor,
        scheduledAt: localDateTimeStr(d),
        scheduledEnd: localDateTimeStr(end),
        type: qbType,
        room: qbRoom || undefined,
        notes: qbNotes || undefined,
        branchId: filterBranch !== "ALL" ? filterBranch : undefined,
      };
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setQbError(err.detail || a.createFailed);
        return;
      }
      setQuickBook(null);
      fetchAppointments();
    } catch { setQbError(a.networkError); }
    finally { setQbSaving(false); }
  }

  // ── Status update ───────────────────────────────────────────────────────────

  async function updateStatus(apptId: string, status: string) {
    await fetch(`/api/appointments/${apptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAppointments();
    setSelectedAppt(prev => prev ? { ...prev, status: status as Appointment["status"] } : null);
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total:     appointments.length,
    scheduled: appointments.filter(x => x.status === "SCHEDULED").length,
    checkedIn: appointments.filter(x => x.status === "CHECKED_IN").length,
    inConsult: appointments.filter(x => x.status === "IN_CONSULTATION").length,
    urgent:    appointments.filter(x => x.status === "URGENT" || x.isUrgent).length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full -m-6 overflow-hidden">

      {/* ── LEFT SIDEBAR ───────────────────────────────────────── */}
      <aside className="w-56 border-e border-[#e3e2e6] bg-white flex-shrink-0 flex flex-col overflow-y-auto hidden md:flex">
        {/* Mini calendar */}
        <MiniCalendar
          value={currentDate}
          onChange={d => { setCurrentDate(d); if (view === "month") setView("day"); }}
          appointments={appointments}
          parseLocalFn={parseLocal}
        />

        {/* Filters */}
        <div className="p-3 space-y-3 flex-1">
          <p className="text-[10px] font-bold text-[#74777f] uppercase tracking-wider">Filters</p>

          {/* Branch */}
          {branches.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-[#43474e] block mb-1">{a.branch}</label>
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="w-full border border-[#c4c6cf] bg-white rounded-lg px-2.5 py-2 text-xs text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
              >
                <option value="ALL">{a.allBranches}</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Doctor */}
          <div>
            <label className="text-[10px] font-semibold text-[#43474e] block mb-1">{a.doctor}</label>
            <select
              value={filterDoctor}
              onChange={e => setFilterDoctor(e.target.value)}
              className="w-full border border-[#c4c6cf] bg-white rounded-lg px-2.5 py-2 text-xs text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">{a.allDoctors}</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name || d.user?.name}
                  {d.departmentName ? ` — ${d.departmentName}` : d.specialization ? ` — ${d.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-semibold text-[#43474e] block mb-1">{t.common.status}</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-[#c4c6cf] bg-white rounded-lg px-2.5 py-2 text-xs text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            >
              <option value="ALL">{a.allStatuses}</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Type legend */}
          <div>
            <p className="text-[10px] font-bold text-[#74777f] uppercase tracking-wider mb-2">Type Legend</p>
            <div className="space-y-1.5">
              {Object.entries(TYPE_COLORS).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.barHex }} />
                  <span className="text-[10px] text-[#43474e] capitalize">{type.replace("_", " ").toLowerCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Working hours info (when branch selected) */}
          {filterBranch !== "ALL" && (
            <div className="bg-[#f4f3f7] rounded-lg p-2.5">
              <p className="text-[10px] font-bold text-[#74777f] uppercase tracking-wider mb-1.5">{a.workingHoursNote}</p>
              <p className="text-[11px] text-[#43474e]">{workingCfg.startTime} – {workingCfg.endTime}</p>
              <p className="text-[10px] text-[#74777f] mt-0.5">{workingCfg.slotDuration} {a.minutesSuffix} slots</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN AREA ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top bar ── */}
        <div className="px-4 pt-4 pb-3 border-b border-[#e3e2e6] bg-[#faf9fd] flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-[#1a1c1e]">{a.title}</h1>
              <p className="text-xs text-[#74777f]">{stats.total} {a.title.toLowerCase()}</p>
            </div>
            <Link
              href="/appointments/new"
              className="flex items-center gap-1.5 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {a.newAppointment}
            </Link>
          </div>

          {fetchError && <div className="mb-2"><ErrorBanner error={fetchError} onRetry={fetchAppointments} /></div>}

          {/* Stats + navigation */}
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: a.total,         value: stats.total,     color: "text-[#1a1c1e]" },
              { label: a.scheduled,     value: stats.scheduled, color: "text-[#74777f]" },
              { label: a.checkedIn,     value: stats.checkedIn, color: "text-[#1960a3]" },
              { label: a.inConsultation,value: stats.inConsult, color: "text-[#7c3aed]" },
              { label: a.urgent,        value: stats.urgent,    color: "text-[#ba1a1a]" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-[#74777f] whitespace-nowrap">{s.label}</p>
              </div>
            ))}

            <div className="ms-auto flex items-center gap-2">
              {/* Navigation */}
              <div className="flex items-center gap-1 bg-[#f4f3f7] rounded-xl p-1">
                <button onClick={prevPeriod} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-[#74777f]">chevron_left</span>
                </button>
                <button onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-xs font-bold text-[#1960a3] hover:bg-white rounded-lg transition-colors">
                  {a.today}
                </button>
                <span className="text-sm font-semibold text-[#1a1c1e] px-2 whitespace-nowrap">
                  {view === "day"
                    ? currentDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
                    : monthLabel}
                </span>
                <button onClick={nextPeriod} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-[#74777f]">chevron_right</span>
                </button>
              </div>

              {/* View toggle */}
              <div className="flex bg-[#f4f3f7] rounded-xl p-1">
                {(["month", "week", "day", "list"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                      view === v ? "bg-white text-[#1960a3] shadow-sm" : "text-[#74777f] hover:text-[#1a1c1e]"
                    }`}>
                    {v === "month" ? a.monthView :
                     v === "week"  ? a.weekView  :
                     v === "day"   ? a.dayView   : a.listView}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Calendar body ── */}
        <div className="flex-1 overflow-hidden">

          {/* ── MONTH VIEW ── */}
          {view === "month" && (
            <div className="h-full overflow-y-auto bg-[#faf9fd]">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-[#e3e2e6] bg-white sticky top-0 z-10">
                {DAYS.map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-[#74777f] uppercase tracking-wider py-2 border-e border-[#e3e2e6] last:border-e-0">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {getMonthCells().map((date, i) => {
                  if (!date) return <div key={i} className="min-h-[120px] border-e border-b border-[#e3e2e6] bg-[#f9f9fb]" />;
                  const isToday = date.toDateString() === today.toDateString();
                  const dateKey = localDateStr(date);
                  const dayAppts = appointments.filter(ap => localDateStr(parseLocal(ap.scheduledAt)) === dateKey);
                  const visible = dayAppts.slice(0, 3);
                  const extra = dayAppts.length - visible.length;
                  return (
                    <div key={i}
                      className={`min-h-[120px] border-e border-b border-[#e3e2e6] p-1.5 last:border-e-0 cursor-pointer group transition-colors ${
                        isToday ? "bg-[#eff6ff]/40" : "bg-white hover:bg-[#f4f3f7]/60"
                      }`}
                      onClick={() => { setCurrentDate(date); setView("day"); }}
                    >
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold mb-1 ${
                        isToday ? "bg-[#002045] text-white" : "text-[#1a1c1e]"
                      }`}>{date.getDate()}</div>
                      <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                        {visible.map(ap => {
                          const tc = TYPE_COLORS[ap.type] ?? TYPE_COLORS.CONSULTATION;
                          return (
                            <div key={ap.id}
                              onClick={() => setSelectedAppt(ap)}
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer ${tc.bg} ${tc.text}`}
                              style={{ borderLeft: `2px solid ${tc.barHex}` }}>
                              {parseLocal(ap.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} {ap.patientName}
                            </div>
                          );
                        })}
                        {extra > 0 && (
                          <div className="text-[10px] text-[#1960a3] font-semibold px-1 cursor-pointer hover:underline">
                            +{extra} {a.moreEvents}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="h-full overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-16 h-16 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#74777f] text-3xl">event_busy</span>
                  </div>
                  <p className="text-sm font-semibold text-[#1a1c1e]">{a.noAppointments}</p>
                  <Link href="/appointments/new" className="text-sm text-[#1960a3] font-semibold hover:underline">{a.bookFirst}</Link>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {[a.time, a.patient, a.doctor, a.type, t.common.room, t.common.status, t.common.actions].map(h => (
                            <th key={h} className="text-start text-xs font-semibold text-[#43474e] uppercase tracking-wider px-4 py-3 bg-[#f4f3f7] border-b border-[#e3e2e6] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.slice().sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).map(apt => {
                          const st = STATUS_STYLES[apt.status] ?? STATUS_STYLES.SCHEDULED;
                          const tc = TYPE_COLORS[apt.type] ?? TYPE_COLORS.CONSULTATION;
                          const dt = parseLocal(apt.scheduledAt);
                          return (
                            <tr key={apt.id} className="hover:bg-[#f4f3f7] transition-colors cursor-pointer group" onClick={() => setSelectedAppt(apt)}>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]">
                                <p className="text-sm font-bold text-[#1a1c1e]">{dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</p>
                                <p className="text-[10px] text-[#74777f]">{dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]">
                                <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors">{apt.patientName}</p>
                                {apt.mrn && <p className="text-[10px] text-[#74777f]">{apt.mrn}</p>}
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6] text-sm text-[#43474e]">{apt.doctorName ?? "—"}</td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>{apt.type.replace("_"," ")}</span>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6] text-xs text-[#74777f]">{apt.room ?? "—"}</td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                              </td>
                              <td className="px-4 py-3.5 border-b border-[#e3e2e6]">
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <button aria-label={a.openEMR} title={a.openEMR} onClick={() => router.push(`/emr/${apt.patientId}`)}
                                    className="p-1.5 hover:bg-[#d3e4ff] rounded-lg text-[#74777f] hover:text-[#1960a3] transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                                  </button>
                                  <button aria-label={a.quickConsult} title={a.quickConsult}
                                    onClick={() => setQuickConsult({ appointmentId: apt.id, patientName: apt.patientName, doctorName: apt.doctorName ?? "" })}
                                    className="p-1.5 hover:bg-[#ccfbf1] rounded-lg text-[#74777f] hover:text-[#0d9488] transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">stethoscope</span>
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
          )}

          {/* ── WEEK / DAY VIEW ── */}
          {(view === "week" || view === "day") && (
            <div ref={calendarRef} className="flex-1 overflow-auto h-full bg-[#faf9fd]">
              <div className={`flex ${view === "day" ? "min-w-[500px]" : "min-w-[900px]"}`}>

                {/* Time column */}
                <div className="w-14 border-e border-[#e3e2e6] bg-white sticky start-0 z-10 flex-shrink-0">
                  <div className="sticky top-0 h-14 border-b border-[#e3e2e6] bg-white z-20" />
                  {HOURS.map(h => (
                    <div key={h} className={`flex items-start justify-end pe-2 pt-1 text-[9px] font-semibold border-b border-[#e3e2e6] relative ${
                      h >= workingStartH() && h < workingEndH() ? "text-[#74777f]" : "text-[#c4c6cf]"
                    }`} style={{ height: CELL_H }}>
                      {formatHour(h)}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                  {visibleDates.map(date => {
                    const isToday = date.toDateString() === today.toDateString();
                    const isWorking = isWorkingDay(date);
                    const dateKey = localDateStr(date);
                    const dayAppts = appointments.filter(ap => localDateStr(parseLocal(ap.scheduledAt)) === dateKey);
                    const overlapMap = computeOverlap(dayAppts, parseLocal);

                    return (
                      <div key={dateKey} className="border-e border-[#e3e2e6] last:border-e-0">
                        {/* Day header */}
                        <div className={`h-14 flex flex-col items-center justify-center border-b border-[#e3e2e6] sticky top-0 z-10 ${isToday ? "bg-[#eff6ff]" : "bg-white"}`}>
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${isToday ? "text-[#1960a3]" : "text-[#74777f]"}`}>
                            {DAYS[date.getDay()]}
                          </span>
                          <span className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                            isToday ? "bg-[#002045] text-white" : "text-[#1a1c1e]"
                          }`}>{date.getDate()}</span>
                          {!isWorking && filterBranch !== "ALL" && (
                            <span className="text-[9px] text-[#ba1a1a] font-bold">{a.nonWorkingDay}</span>
                          )}
                        </div>

                        {/* Hour grid + events */}
                        <div className="relative">
                          {HOURS.map(h => {
                            const isWorkingHour = h >= workingStartH() && h < workingEndH() && isWorking;
                            return (
                              <div
                                key={h}
                                className={`border-b border-[#e3e2e6] transition-colors cursor-pointer ${
                                  isWorkingHour
                                    ? "hover:bg-[#eff6ff]/50 bg-white"
                                    : "bg-[#f9f9fb]"
                                }`}
                                style={{ height: CELL_H }}
                                onClick={() => isWorkingHour && openQuickBook(date, h)}
                              >
                                {/* Half-hour divider */}
                                <div className="h-1/2 border-b border-dashed border-[#e3e2e6]/60"
                                  onClick={e => { e.stopPropagation(); isWorkingHour && openQuickBook(date, h, 30); }} />
                                <div className="h-1/2" />
                              </div>
                            );
                          })}

                          {/* Current time line */}
                          {isToday && nowPx >= 0 && nowPx <= HOURS.length * CELL_H && (
                            <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: nowPx }}>
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-[#ba1a1a] -ms-1 flex-shrink-0" />
                                <div className="flex-1 h-px bg-[#ba1a1a]" />
                              </div>
                            </div>
                          )}

                          {/* Appointment blocks */}
                          {dayAppts.map(apt => {
                            const startDate = parseLocal(apt.scheduledAt);
                            const h = startDate.getHours(), m = startDate.getMinutes();
                            const endDate = apt.scheduledEnd ? parseLocal(apt.scheduledEnd) : new Date(startDate.getTime() + 30 * 60000);
                            const durationMin = (endDate.getTime() - startDate.getTime()) / 60000;
                            const topPx = ((h - HOURS_START) + m / 60) * CELL_H;
                            const heightPx = Math.max((durationMin / 60) * CELL_H, 24);
                            const info = overlapMap.get(apt.id) ?? { col: 0, totalCols: 1 };
                            const widthPct = 100 / info.totalCols;
                            const leftPct = info.col * widthPct;

                            return (
                              <ApptChip
                                key={apt.id}
                                apt={apt}
                                onClick={() => setSelectedAppt(apt)}
                                height={heightPx}
                                parseLocalFn={parseLocal}
                                style={{
                                  top: topPx,
                                  height: heightPx,
                                  left: `calc(${leftPct}% + 2px)`,
                                  width: `calc(${widthPct}% - 4px)`,
                                }}
                              />
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
      </div>

      {/* ── QUICK BOOK MODAL ──────────────────────────────────────── */}
      {quickBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setQuickBook(null)}>
          <div className="bg-white rounded-2xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.18)] p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#1a1c1e]">{a.quickBook}</h3>
                <p className="text-xs text-[#74777f]">
                  {quickBook.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {" · "}{String(quickBook.hour).padStart(2,"0")}:{String(quickBook.minute).padStart(2,"0")}
                </p>
              </div>
              <button onClick={() => setQuickBook(null)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[20px] text-[#74777f]">close</span>
              </button>
            </div>

            {qbError && <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] rounded-lg px-3 py-2 mb-3">{qbError}</p>}

            <div className="space-y-3">
              {/* Patient search */}
              <div className="relative">
                <label className="text-xs font-semibold text-[#43474e] block mb-1">{a.patientLabel} *</label>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-[#74777f]">search</span>
                  <input
                    type="text"
                    value={qbSelectedPatient ? `${qbSelectedPatient.firstName} ${qbSelectedPatient.lastName}` : qbPatientSearch}
                    onChange={e => { setQbPatientSearch(e.target.value); setQbSelectedPatient(null); setQbDropdownOpen(true); }}
                    onFocus={() => setQbDropdownOpen(true)}
                    placeholder={a.selectPatient}
                    className="w-full border border-[#c4c6cf] rounded-lg ps-9 pe-3 py-2 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
                  />
                </div>
                {qbDropdownOpen && !qbSelectedPatient && qbPatientSearch.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e3e2e6] rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                    {qbPatients.length === 0 ? (
                      <p className="text-xs text-[#74777f] px-3 py-3">{a.noPatients}</p>
                    ) : qbPatients.map(p => (
                      <button key={p.id}
                        onClick={() => { setQbSelectedPatient(p); setQbPatientSearch(""); setQbDropdownOpen(false); }}
                        className="w-full text-start px-3 py-2 text-sm hover:bg-[#f4f3f7] transition-colors">
                        <span className="font-semibold text-[#1a1c1e]">{p.firstName} {p.lastName}</span>
                        <span className="text-xs text-[#74777f] ms-2">{p.mrn}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Doctor */}
              <div>
                <label className="text-xs font-semibold text-[#43474e] block mb-1">{a.doctor} *</label>
                <select value={qbDoctor} onChange={e => setQbDoctor(e.target.value)}
                  className="w-full border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
                  <option value="">{a.selectDoctor}</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.user?.name}
                      {" — "}{d.departmentName || d.specialization}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-[#43474e] block mb-1">{a.apptType}</label>
                <select value={qbType} onChange={e => setQbType(e.target.value)}
                  className="w-full border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20">
                  {Object.keys(TYPE_COLORS).map(k => <option key={k} value={k}>{k.replace("_"," ")}</option>)}
                </select>
              </div>

              {/* Room + Notes row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[#43474e] block mb-1">{t.common.room}</label>
                  <input value={qbRoom} onChange={e => setQbRoom(e.target.value)} placeholder="e.g. Room 3"
                    className="w-full border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#43474e] block mb-1">{t.common.notes}</label>
                  <input value={qbNotes} onChange={e => setQbNotes(e.target.value)} placeholder="..."
                    className="w-full border border-[#c4c6cf] rounded-lg px-3 py-2 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleQuickBook} disabled={qbSaving}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#002045] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                  {qbSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">event_available</span>}
                  {qbSaving ? a.saving : a.bookSlot}
                </button>
                <Link href="/appointments/new"
                  className="flex items-center justify-center px-3 py-2.5 border border-[#c4c6cf] bg-white rounded-lg text-sm text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── APPOINTMENT DETAIL PANEL ──────────────────────────────── */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedAppt(null)}>
          <div className="bg-white rounded-2xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="appt-detail-title">
            {/* Color bar by type */}
            <div className="h-1.5" style={{ backgroundColor: (TYPE_COLORS[selectedAppt.type] ?? TYPE_COLORS.CONSULTATION).barHex }} />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: (TYPE_COLORS[selectedAppt.type] ?? TYPE_COLORS.CONSULTATION).barHex }}>
                    {selectedAppt.patientName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <h3 id="appt-detail-title" className="font-bold text-[#1a1c1e] leading-tight">{selectedAppt.patientName}</h3>
                    <p className="text-xs text-[#74777f]">{selectedAppt.mrn && `MRN: ${selectedAppt.mrn} · `}{selectedAppt.type.replace("_"," ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {selectedAppt.isUrgent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#991b1b]">URGENT</span>
                  )}
                  <button onClick={() => setSelectedAppt(null)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors ms-1">
                    <span className="material-symbols-outlined text-[20px] text-[#74777f]">close</span>
                  </button>
                </div>
              </div>

              {/* Status badge + change */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_STYLES[selectedAppt.status]?.bg} ${STATUS_STYLES[selectedAppt.status]?.text}`}>
                  {STATUS_STYLES[selectedAppt.status]?.label}
                </span>
                {selectedAppt.branchName && (
                  <span className="text-[10px] text-[#1960a3] bg-[#eff6ff] px-2 py-1 rounded-full flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">location_on</span>
                    {selectedAppt.branchName}
                  </span>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-[#f4f3f7] rounded-xl mb-4">
                <InfoRow icon="calendar_today" label={t.common.date}
                  value={parseLocal(selectedAppt.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} />
                <InfoRow icon="schedule" label={t.common.time}
                  value={parseLocal(selectedAppt.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                    + (selectedAppt.scheduledEnd ? ` – ${parseLocal(selectedAppt.scheduledEnd).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}` : "")} />
                <InfoRow icon="stethoscope" label={a.doctor} value={selectedAppt.doctorName ?? "—"} />
                <InfoRow icon="science" label={a.specialization} value={selectedAppt.specialization || "—"} />
                {selectedAppt.room && <InfoRow icon="meeting_room" label={t.common.room} value={selectedAppt.room} />}
                {selectedAppt.checkedInAt && <InfoRow icon="login" label={a.checkIn} value={parseLocal(selectedAppt.checkedInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} />}
              </div>

              {selectedAppt.reason && (
                <div className="p-3 bg-[#eff6ff] rounded-xl mb-4">
                  <p className="text-[10px] font-bold text-[#1960a3] uppercase tracking-wider mb-1">{t.common.reason}</p>
                  <p className="text-sm text-[#1a1c1e]">{selectedAppt.reason}</p>
                </div>
              )}

              {/* Quick status actions */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedAppt.status === "SCHEDULED" && (
                  <button onClick={() => updateStatus(selectedAppt.id, "CHECKED_IN")}
                    className="flex items-center gap-1.5 bg-[#1960a3] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-[14px]">login</span>{a.checkIn}
                  </button>
                )}
                {selectedAppt.status === "CHECKED_IN" && (
                  <button onClick={() => updateStatus(selectedAppt.id, "IN_CONSULTATION")}
                    className="flex items-center gap-1.5 bg-[#7c3aed] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-[14px]">stethoscope</span>{a.startConsultation}
                  </button>
                )}
                {(selectedAppt.status === "IN_CONSULTATION" || selectedAppt.status === "CHECKED_IN") && (
                  <button onClick={() => updateStatus(selectedAppt.id, "COMPLETED")}
                    className="flex items-center gap-1.5 bg-[#0d9488] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-[14px]">task_alt</span>{a.markCompleted}
                  </button>
                )}
                {!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(selectedAppt.status) && (
                  <button onClick={() => updateStatus(selectedAppt.id, "NO_SHOW")}
                    className="flex items-center gap-1.5 border border-[#ba1a1a] text-[#ba1a1a] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#fee2e2] transition-colors">
                    <span className="material-symbols-outlined text-[14px]">person_off</span>{a.markNoShow}
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { setSelectedAppt(null); router.push(`/appointments/${selectedAppt.id}`); }}
                  className="flex flex-col items-center gap-1 bg-[#002045] text-white py-2.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  {a.viewDetail}
                </button>
                <Link href={`/emr/${selectedAppt.patientId}`}
                  className="flex flex-col items-center gap-1 border border-[#c4c6cf] py-2.5 rounded-xl text-xs font-semibold text-[#1a1c1e] hover:bg-[#f4f3f7] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                  {a.openEMR}
                </Link>
                <button onClick={() => { setSelectedAppt(null); setQuickConsult({ appointmentId: selectedAppt.id, patientName: selectedAppt.patientName, doctorName: selectedAppt.doctorName ?? "" }); }}
                  className="flex flex-col items-center gap-1 border border-[#c4c6cf] py-2.5 rounded-xl text-xs font-semibold text-[#1a1c1e] hover:bg-[#ccfbf1] hover:border-[#0d9488] hover:text-[#0d9488] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                  {a.quickConsult}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Consultation Modal ────────────────────────────── */}
      {quickConsult && (
        <QuickConsultationModal
          appointmentId={quickConsult.appointmentId}
          patientName={quickConsult.patientName}
          doctorName={quickConsult.doctorName}
          onClose={() => setQuickConsult(null)}
          onSuccess={fetchAppointments}
        />
      )}
    </div>
  );
}

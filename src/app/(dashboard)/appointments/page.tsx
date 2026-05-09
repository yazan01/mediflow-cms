"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Appointment } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { QuickConsultationModal } from "@/components/QuickConsultationModal";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { apiFetch } from "@/lib/hooks/useDataFetch";

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

// ── Framer Motion variants ─────────────────────────────────────────────────────

const modalAnim = {
  hidden:  { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, scale: 0.95, y: 4, transition: { duration: 0.15, ease: "easeIn" as const } },
};

const backdropAnim = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

const rowAnim = {
  hidden:  { opacity: 0, y: 8 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04, ease: "easeOut" as const } }),
};

// ── Type color map (kept as semantic colors — unchanged by theme) ──────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; barHex: string; dotCls: string }> = {
  CONSULTATION: { bg: "bg-[#eff6ff]",  text: "text-[#1d4ed8]", barHex: "#1960a3", dotCls: "bg-[#1960a3]" },
  FOLLOW_UP:    { bg: "bg-[#f0fdf4]",  text: "text-[#166534]", barHex: "#16a34a", dotCls: "bg-[#16a34a]" },
  PROCEDURE:    { bg: "bg-[#faf5ff]",  text: "text-[#6b21a8]", barHex: "#7c3aed", dotCls: "bg-[#7c3aed]" },
  LAB_VISIT:    { bg: "bg-[#fffbeb]",  text: "text-[#92400e]", barHex: "#d97706", dotCls: "bg-[#d97706]" },
  IMAGING:      { bg: "bg-[#eef2ff]",  text: "text-[#3730a3]", barHex: "#4f46e5", dotCls: "bg-[#4f46e5]" },
  EMERGENCY:    { bg: "bg-[#fef2f2]",  text: "text-[#991b1b]", barHex: "#ba1a1a", dotCls: "bg-[#ba1a1a]" },
  DENTAL:       { bg: "bg-[#fdf2f8]",  text: "text-[#9d174d]", barHex: "#db2777", dotCls: "bg-[#db2777]" },
  CHECKUP:      { bg: "bg-[#ecfdf5]",  text: "text-[#065f46]", barHex: "#0d9488", dotCls: "bg-[#0d9488]" },
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
    <div className="p-3 border-b border-[var(--border)]">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          className="p-1 hover:bg-[var(--surface2)] rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <span className="material-symbols-outlined text-[14px] text-[var(--txt2)]">chevron_left</span>
        </button>
        <span className="text-[11px] font-bold text-[var(--txt1)]">{monthLabel}</span>
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          className="p-1 hover:bg-[var(--surface2)] rounded-lg transition-colors"
          aria-label="Next month"
        >
          <span className="material-symbols-outlined text-[14px] text-[var(--txt2)]">chevron_right</span>
        </button>
      </div>
      <div className="grid grid-cols-7">
        {DAYS_SHORT.map((d, i) => (
          <div key={i} className="text-[9px] font-bold text-center text-[var(--txt3)] uppercase py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = day === today.getDate() && viewMonth.getMonth() === today.getMonth() && viewMonth.getFullYear() === today.getFullYear();
          const isSelected = day === value.getDate() && viewMonth.getMonth() === value.getMonth() && viewMonth.getFullYear() === value.getFullYear();
          const hasAppt = apptDays.has(day);
          return (
            <button key={i} onClick={() => onChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day))}
              className={`relative w-7 h-7 mx-auto flex items-center justify-center text-[11px] font-semibold rounded-full transition-all ${
                isSelected ? "bg-[var(--brand)] text-white" :
                isToday    ? "bg-[var(--blue-bg)] text-[var(--blue)] font-bold" :
                             "text-[var(--txt1)] hover:bg-[var(--surface2)]"
              }`}>
              {day}
              {hasAppt && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--blue)]" />
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
      <span className={`absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT[apt.status] ?? "bg-[#94a3b8]"}`} />
      <p className={`text-[11px] font-bold truncate leading-tight ${tc.text} pe-2`}>
        {apt.patientName}
      </p>
      {height > 36 && (
        <p className="text-[9px] text-[var(--txt2)] truncate">
          {timeStr}{apt.doctorName ? ` · ${apt.doctorName.split(" ").slice(-1)[0]}` : ""}
        </p>
      )}
      {height > 52 && apt.room && (
        <p className="text-[9px] text-[var(--txt2)] truncate">{apt.room}</p>
      )}
    </div>
  );
}

// ── InfoRow helper ─────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="material-symbols-outlined text-[15px] text-[var(--txt3)] mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] text-[var(--txt3)] font-bold uppercase tracking-wider">{label}</p>
        <p className="text-xs font-semibold text-[var(--txt1)] truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Skeleton list rows ─────────────────────────────────────────────────────────

function SkeletonListRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td className="table-cell">
            <div className="space-y-1.5">
              <div className="skeleton h-3 w-12" />
              <div className="skeleton h-2.5 w-16" />
            </div>
          </td>
          <td className="table-cell">
            <div className="space-y-1.5">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-2.5 w-16" />
            </div>
          </td>
          <td className="table-cell"><div className="skeleton h-3 w-24" /></td>
          <td className="table-cell"><div className="skeleton h-5 w-20 rounded-full" /></td>
          <td className="table-cell"><div className="skeleton h-3 w-14" /></td>
          <td className="table-cell"><div className="skeleton h-5 w-20 rounded-full" /></td>
          <td className="table-cell">
            <div className="flex gap-1">
              <div className="skeleton h-7 w-7 rounded-lg" />
              <div className="skeleton h-7 w-7 rounded-lg" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 3500); return () => clearTimeout(id); }, [onClose]);
  return (
    <div className={`fixed bottom-6 end-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${type === "success" ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--err-bg)] text-[var(--err)]"}`}>
      <span className="material-symbols-outlined text-[18px]">{type === "success" ? "check_circle" : "error"}</span>
      {message}
      <button onClick={onClose} aria-label="Close" className="ms-1 opacity-70 hover:opacity-100"><span className="material-symbols-outlined text-[16px]">close</span></button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const CELL_H = 72;
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

  const [quickBook, setQuickBook]             = useState<{ date: Date; hour: number; minute: number } | null>(null);
  const [qbTime, setQbTime]                   = useState("08:00");
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

  const [createPatientModal, setCreatePatientModal] = useState(false);
  const [cpForm, setCpForm] = useState({ firstName: "", lastName: "", phone: "", dob: "", gender: "MALE" });
  const [cpSaving, setCpSaving] = useState(false);
  const [cpError, setCpError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const debouncedSearch = useDebounce(qbPatientSearch, 300);

  // ── Pre-fill QuickBook from URL params (e.g. from patient profile) ──────────

  useEffect(() => {
    const patientId = searchParams.get("patientId");
    const action = searchParams.get("action");
    if (!patientId || action !== "book") return;

    fetch(`/api/patients/${patientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(patient => {
        if (!patient) return;
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes() < 30 ? 30 : 0;
        const bookH = m === 0 ? (h + 1) % 24 : h;
        const bookDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bookH);

        setQuickBook({ date: bookDate, hour: bookH, minute: m });
        setQbTime(`${String(bookH).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        setQbDoctor("");
        setQbType("CONSULTATION");
        setQbRoom(""); setQbNotes(""); setQbError("");
        setQbSelectedPatient({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName, mrn: patient.mrn });
        setQbPatientSearch(`${patient.firstName} ${patient.lastName}`);
      })
      .catch(() => {});
  }, [searchParams]);

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

  function getMonthCells(): (Date | null)[] {
    const yr = currentDate.getFullYear(), mo = currentDate.getMonth();
    const firstDay = new Date(yr, mo, 1).getDay();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: firstDay }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(yr, mo, d));
    return cells;
  }

  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

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

  useEffect(() => {
    const url = filterBranch !== "ALL" ? `/api/doctors?branch_id=${filterBranch}` : "/api/doctors";
    fetch(url).then(r => r.ok ? r.json() : []).then(setDoctors).catch(() => {});
  }, [filterBranch]);

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

  useEffect(() => {
    if (!calendarRef.current || (view !== "week" && view !== "day")) return;
    const workStartPx = (workingStartH() - HOURS_START) * CELL_H;
    const target = Math.min(nowPx - 120, workStartPx);
    calendarRef.current.scrollTop = Math.max(0, target);
  }, [view, loading]);

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
    setQbTime(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    setQbDoctor(filterDoctor !== "ALL" ? filterDoctor : "");
    setQbType("CONSULTATION");
    setQbRoom(""); setQbNotes("");
    setQbSelectedPatient(null); setQbPatientSearch(""); setQbError("");
  }

  async function handleCreatePatient() {
    if (!cpForm.firstName || !cpForm.lastName || !cpForm.phone || !cpForm.dob) {
      setCpError(t.appointments.patientRequiredFields);
      return;
    }
    setCpSaving(true); setCpError("");
    try {
      const patient = await apiFetch<{ id: string; firstName: string; lastName: string; mrn: string }>("/api/patients", {
        method: "POST",
        body: JSON.stringify({ firstName: cpForm.firstName, lastName: cpForm.lastName, phone: cpForm.phone, dateOfBirth: cpForm.dob, gender: cpForm.gender }),
      }).catch(async (e) => { setCpError(e?.message || t.appointments.createPatientFailed); return null; });
      if (!patient) return;
      setQbSelectedPatient({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName, mrn: patient.mrn });
      setCreatePatientModal(false);
      setCpForm({ firstName: "", lastName: "", phone: "", dob: "", gender: "MALE" });
    } catch { setCpError(t.common.networkError); }
    finally { setCpSaving(false); }
  }

  async function handleQuickBook() {
    if (!quickBook || !qbSelectedPatient || !qbDoctor) { setQbError(a.requiredFields); return; }
    setQbSaving(true); setQbError("");
    try {
      const [h, m] = qbTime.split(":").map(Number);
      const d = new Date(quickBook.date);
      d.setHours(isNaN(h) ? quickBook.hour : h, isNaN(m) ? quickBook.minute : m, 0, 0);
      const end = new Date(d.getTime() + workingCfg.slotDuration * 60000);
      const body = {
        patientId: qbSelectedPatient.id, doctorId: qbDoctor,
        scheduledAt: localDateTimeStr(d), scheduledEnd: localDateTimeStr(end),
        type: qbType, room: qbRoom || undefined, notes: qbNotes || undefined,
        branchId: filterBranch !== "ALL" ? filterBranch : undefined,
      };
      await apiFetch("/api/appointments", {
        method: "POST", body: JSON.stringify(body),
      });
      setQuickBook(null);
      fetchAppointments();
    } catch { setQbError(a.networkError); }
    finally { setQbSaving(false); }
  }

  async function updateStatus(apptId: string, status: string) {
    try {
      await apiFetch(`/api/appointments/${apptId}`, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      fetchAppointments();
      setSelectedAppt(prev => prev ? { ...prev, status: status as Appointment["status"] } : null);
      const label = STATUS_STYLES[status]?.label ?? status;
      setToast({ message: `${a.statusUpdated} ${label}`, type: "success" });
    } catch {
      setToast({ message: t.common.unexpectedError, type: "error" });
    }
  }

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
      <aside className="w-56 border-e border-[var(--border)] bg-[var(--surface)] flex-shrink-0 flex flex-col overflow-y-auto hidden md:flex">
        <MiniCalendar
          value={currentDate}
          onChange={d => { setCurrentDate(d); if (view === "month") setView("day"); }}
          appointments={appointments}
          parseLocalFn={parseLocal}
        />

        <div className="p-3 space-y-3 flex-1">
          <p className="text-[10px] font-bold text-[var(--txt3)] uppercase tracking-wider">Filters</p>

          {branches.length > 0 && (
            <div>
              <label className="form-label">{a.branch}</label>
              <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="select-field text-xs py-2">
                <option value="ALL">{a.allBranches}</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="form-label">{a.doctor}</label>
            <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} className="select-field text-xs py-2">
              <option value="ALL">{a.allDoctors}</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name || d.user?.name}
                  {d.departmentName ? ` — ${d.departmentName}` : d.specialization ? ` — ${d.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t.common.status}</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field text-xs py-2">
              <option value="ALL">{a.allStatuses}</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Type legend */}
          <div>
            <p className="text-[10px] font-bold text-[var(--txt3)] uppercase tracking-wider mb-2">Type Legend</p>
            <div className="space-y-1.5">
              {Object.entries(TYPE_COLORS).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.barHex }} />
                  <span className="text-[10px] text-[var(--txt2)] capitalize">{type.replace("_", " ").toLowerCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {filterBranch !== "ALL" && (
            <div className="bg-[var(--surface2)] rounded-lg p-2.5">
              <p className="text-[10px] font-bold text-[var(--txt3)] uppercase tracking-wider mb-1.5">{a.workingHoursNote}</p>
              <p className="text-[11px] text-[var(--txt2)]">{workingCfg.startTime} – {workingCfg.endTime}</p>
              <p className="text-[10px] text-[var(--txt3)] mt-0.5">{workingCfg.slotDuration} {a.minutesSuffix} slots</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN AREA ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top bar ── */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--border)] bg-[var(--bg)] flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-[var(--txt1)]">{a.title}</h1>
              <p className="text-xs text-[var(--txt2)]">{stats.total} {a.title.toLowerCase()}</p>
            </div>
            <Link
              href="/appointments/new"
              className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {a.newAppointment}
            </Link>
          </div>

          {fetchError && <div className="mb-2"><ErrorBanner error={fetchError} onRetry={fetchAppointments} /></div>}

          {/* Stats + nav */}
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: a.total,          value: stats.total,     color: "text-[var(--txt1)]" },
              { label: a.scheduled,      value: stats.scheduled, color: "text-[var(--txt2)]" },
              { label: a.checkedIn,      value: stats.checkedIn, color: "text-[var(--blue)]" },
              { label: a.inConsultation, value: stats.inConsult, color: "text-[#7c3aed]" },
              { label: a.urgent,         value: stats.urgent,    color: "text-[var(--err)]" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-[var(--txt3)] whitespace-nowrap">{s.label}</p>
              </div>
            ))}

            <div className="ms-auto flex items-center gap-2">
              {/* Navigation */}
              <div className="flex items-center gap-1 bg-[var(--surface2)] rounded-xl p-1">
                <button onClick={prevPeriod} aria-label="Previous" className="p-1.5 hover:bg-[var(--surface)] rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-[var(--txt2)]">chevron_left</span>
                </button>
                <button onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-xs font-bold text-[var(--blue)] hover:bg-[var(--surface)] rounded-lg transition-colors">
                  {a.today}
                </button>
                <span className="text-sm font-semibold text-[var(--txt1)] px-2 whitespace-nowrap">
                  {view === "day"
                    ? currentDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
                    : monthLabel}
                </span>
                <button onClick={nextPeriod} aria-label="Next" className="p-1.5 hover:bg-[var(--surface)] rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-[var(--txt2)]">chevron_right</span>
                </button>
              </div>

              {/* View toggle */}
              <div className="flex bg-[var(--surface2)] rounded-xl p-1">
                {(["month", "week", "day", "list"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                      view === v
                        ? "bg-[var(--surface)] text-[var(--blue)] shadow-[var(--sh-xs)]"
                        : "text-[var(--txt2)] hover:text-[var(--txt1)]"
                    }`}>
                    {v === "month" ? a.monthView : v === "week" ? a.weekView : v === "day" ? a.dayView : a.listView}
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
            <div className="h-full overflow-y-auto bg-[var(--bg)]">
              <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
                {DAYS.map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-[var(--txt3)] uppercase tracking-wider py-2 border-e border-[var(--border)] last:border-e-0">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {getMonthCells().map((date, i) => {
                  if (!date) return <div key={i} className="min-h-[120px] border-e border-b border-[var(--border)] bg-[var(--surface2)]" />;
                  const isToday = date.toDateString() === today.toDateString();
                  const dateKey = localDateStr(date);
                  const dayAppts = appointments.filter(ap => localDateStr(parseLocal(ap.scheduledAt)) === dateKey);
                  const visible = dayAppts.slice(0, 3);
                  const extra = dayAppts.length - visible.length;
                  return (
                    <div key={i}
                      className={`min-h-[120px] border-e border-b border-[var(--border)] p-1.5 last:border-e-0 cursor-pointer group transition-colors ${
                        isToday ? "bg-[var(--blue-bg)]/30" : "bg-[var(--surface)] hover:bg-[var(--surface2)]"
                      }`}
                      onClick={() => { setCurrentDate(date); setView("day"); }}
                    >
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold mb-1 ${
                        isToday ? "bg-[var(--brand)] text-white" : "text-[var(--txt1)]"
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
                          <div className="text-[10px] text-[var(--blue)] font-semibold px-1 cursor-pointer hover:underline">
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
              {!loading && appointments.length === 0 ? (
                <div className="empty-state py-20">
                  <div className="empty-state-icon">
                    <span className="material-symbols-outlined text-3xl text-[var(--txt3)]">event_busy</span>
                  </div>
                  <p className="empty-state-title">{a.noAppointments}</p>
                  <Link href="/appointments/new" className="text-sm text-[var(--blue)] font-semibold hover:underline">{a.bookFirst}</Link>
                </div>
              ) : (
                <div className="table-wrapper">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {[a.time, a.patient, a.doctor, a.type, t.common.room, t.common.status, t.common.actions].map(h => (
                            <th key={h} className="table-header">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <SkeletonListRows />
                        ) : (
                          appointments
                            .slice()
                            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                            .map((apt, idx) => {
                              const st = STATUS_STYLES[apt.status] ?? STATUS_STYLES.SCHEDULED;
                              const tc = TYPE_COLORS[apt.type] ?? TYPE_COLORS.CONSULTATION;
                              const dt = parseLocal(apt.scheduledAt);
                              return (
                                <motion.tr
                                  key={apt.id}
                                  custom={idx}
                                  variants={rowAnim}
                                  initial="hidden"
                                  animate="visible"
                                  className="table-row cursor-pointer group"
                                  onClick={() => setSelectedAppt(apt)}
                                >
                                  <td className="table-cell">
                                    <p className="text-sm font-bold text-[var(--txt1)]">
                                      {dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                    </p>
                                    <p className="text-[10px] text-[var(--txt3)]">
                                      {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </p>
                                  </td>
                                  <td className="table-cell">
                                    <p className="text-sm font-semibold text-[var(--txt1)] group-hover:text-[var(--blue)] transition-colors">{apt.patientName}</p>
                                    {apt.mrn && <p className="text-[10px] text-[var(--txt3)]">{apt.mrn}</p>}
                                  </td>
                                  <td className="table-cell text-sm text-[var(--txt2)]">{apt.doctorName ?? "—"}</td>
                                  <td className="table-cell">
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>
                                      {apt.type.replace("_"," ")}
                                    </span>
                                  </td>
                                  <td className="table-cell text-xs text-[var(--txt3)]">{apt.room ?? "—"}</td>
                                  <td className="table-cell">
                                    <span className={`badge text-xs ${st.bg} ${st.text}`}>{st.label}</span>
                                  </td>
                                  <td className="table-cell">
                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                      <button aria-label={a.openEMR} title={a.openEMR}
                                        onClick={() => router.push(`/emr/${apt.patientId}`)}
                                        className="btn-icon">
                                        <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                                      </button>
                                      <button aria-label={a.quickConsult} title={a.quickConsult}
                                        onClick={() => setQuickConsult({ appointmentId: apt.id, patientName: apt.patientName, doctorName: apt.doctorName ?? "" })}
                                        className="btn-icon">
                                        <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                                      </button>
                                    </div>
                                  </td>
                                </motion.tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── WEEK / DAY VIEW ── */}
          {(view === "week" || view === "day") && (
            <div ref={calendarRef} className="flex-1 overflow-auto h-full bg-[var(--bg)]">
              <div className={`flex ${view === "day" ? "min-w-[500px]" : "min-w-[900px]"}`}>

                {/* Time column */}
                <div className="w-14 border-e border-[var(--border)] bg-[var(--surface)] sticky start-0 z-10 flex-shrink-0">
                  <div className="sticky top-0 h-14 border-b border-[var(--border)] bg-[var(--surface)] z-20" />
                  {HOURS.map(h => (
                    <div key={h}
                      className={`flex items-start justify-end pe-2 pt-1 text-[9px] font-semibold border-b border-[var(--border)] relative ${
                        h >= workingStartH() && h < workingEndH() ? "text-[var(--txt2)]" : "text-[var(--txt4)]"
                      }`}
                      style={{ height: CELL_H }}>
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
                      <div key={dateKey} className="border-e border-[var(--border)] last:border-e-0">
                        {/* Day header */}
                        <div className={`h-14 flex flex-col items-center justify-center border-b border-[var(--border)] sticky top-0 z-10 ${
                          isToday ? "bg-[var(--blue-bg)]" : "bg-[var(--surface)]"
                        }`}>
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${isToday ? "text-[var(--blue)]" : "text-[var(--txt3)]"}`}>
                            {DAYS[date.getDay()]}
                          </span>
                          <span className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                            isToday ? "bg-[var(--brand)] text-white" : "text-[var(--txt1)]"
                          }`}>{date.getDate()}</span>
                          {!isWorking && filterBranch !== "ALL" && (
                            <span className="text-[9px] text-[var(--err)] font-bold">{a.nonWorkingDay}</span>
                          )}
                        </div>

                        {/* Hour grid + events */}
                        <div className="relative">
                          {HOURS.map(h => {
                            const isWorkingHour = h >= workingStartH() && h < workingEndH() && isWorking;
                            return (
                              <div
                                key={h}
                                className={`border-b border-[var(--border)] transition-colors cursor-pointer ${
                                  isWorkingHour ? "hover:bg-[var(--blue-bg)]/30 bg-[var(--surface)]" : "bg-[var(--surface2)]"
                                }`}
                                style={{ height: CELL_H }}
                                onClick={() => isWorkingHour && openQuickBook(date, h)}
                              >
                                <div className="h-1/2 border-b border-dashed border-[var(--border)]"
                                  onClick={e => { e.stopPropagation(); isWorkingHour && openQuickBook(date, h, 30); }} />
                                <div className="h-1/2" />
                              </div>
                            );
                          })}

                          {/* Current time line */}
                          {isToday && nowPx >= 0 && nowPx <= HOURS.length * CELL_H && (
                            <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: nowPx }}>
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-[var(--err)] -ms-1 flex-shrink-0" />
                                <div className="flex-1 h-px bg-[var(--err)]" />
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
                                  top: topPx, height: heightPx,
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
      <AnimatePresence>
        {quickBook && (
          <motion.div
            className="modal-overlay"
            variants={backdropAnim} initial="hidden" animate="visible" exit="exit"
            onClick={() => setQuickBook(null)}
          >
            <motion.div
              className="modal-panel max-w-sm mx-4"
              variants={modalAnim}
              onClick={e => e.stopPropagation()}
              role="dialog" aria-labelledby="qb-title"
            >
              <div className="modal-header">
                <div>
                  <h3 id="qb-title" className="text-base font-bold text-[var(--txt1)]">{a.quickBook}</h3>
                  <p className="text-xs text-[var(--txt2)]">
                    {quickBook.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                </div>
                <button onClick={() => setQuickBook(null)} aria-label={t.common.close} className="btn-icon ms-2">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="modal-body">
                {qbError && (
                  <div className="alert alert-error mb-3">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {qbError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="form-label">{a.timeLabel} *</label>
                    <input type="time" value={qbTime} onChange={e => setQbTime(e.target.value)} className="input-field" />
                  </div>

                  <div className="relative">
                    <label className="form-label">{a.patientLabel} *</label>
                    <div className="input-group">
                      <span className="material-symbols-outlined text-[16px] text-[var(--txt3)]">search</span>
                      <input
                        type="text"
                        value={qbSelectedPatient ? `${qbSelectedPatient.firstName} ${qbSelectedPatient.lastName}` : qbPatientSearch}
                        onChange={e => { setQbPatientSearch(e.target.value); setQbSelectedPatient(null); setQbDropdownOpen(true); }}
                        onFocus={() => setQbDropdownOpen(true)}
                        placeholder={a.selectPatient}
                        className="flex-1 bg-transparent outline-none text-sm text-[var(--txt1)] placeholder:text-[var(--txt3)]"
                      />
                    </div>
                    <AnimatePresence>
                      {qbDropdownOpen && !qbSelectedPatient && qbPatientSearch.length >= 2 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="popup-panel absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto"
                        >
                          {qbPatients.length === 0 ? (
                            <div>
                              <p className="text-xs text-[var(--txt3)] px-3 py-2">{a.noPatients}</p>
                              <button
                                onClick={() => { setQbDropdownOpen(false); setCreatePatientModal(true); }}
                                className="menu-item w-full text-start border-t border-[var(--border)] text-[var(--blue)]">
                                <span className="material-symbols-outlined text-[14px]">person_add</span>
                                {a.createPatient}
                              </button>
                            </div>
                          ) : (
                            <>
                              {qbPatients.map(p => (
                                <button key={p.id}
                                  onClick={() => { setQbSelectedPatient(p); setQbPatientSearch(""); setQbDropdownOpen(false); }}
                                  className="menu-item w-full text-start">
                                  <span className="font-semibold text-[var(--txt1)]">{p.firstName} {p.lastName}</span>
                                  <span className="text-xs text-[var(--txt3)] ms-2">{p.mrn}</span>
                                </button>
                              ))}
                              <button
                                onClick={() => { setQbDropdownOpen(false); setCreatePatientModal(true); }}
                                className="menu-item w-full text-start border-t border-[var(--border)] text-[var(--blue)]">
                                <span className="material-symbols-outlined text-[14px]">person_add</span>
                                {a.createPatient}
                              </button>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="form-label">{a.doctor} *</label>
                    <select value={qbDoctor} onChange={e => setQbDoctor(e.target.value)} className="select-field">
                      <option value="">{a.selectDoctor}</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name || d.user?.name}{" — "}{d.departmentName || d.specialization}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">{a.apptType}</label>
                    <select value={qbType} onChange={e => setQbType(e.target.value)} className="select-field">
                      {Object.keys(TYPE_COLORS).map(k => <option key={k} value={k}>{k.replace("_"," ")}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label">{t.common.room}</label>
                      <input value={qbRoom} onChange={e => setQbRoom(e.target.value)} placeholder="e.g. Room 3" className="input-field" />
                    </div>
                    <div>
                      <label className="form-label">{t.common.notes}</label>
                      <input value={qbNotes} onChange={e => setQbNotes(e.target.value)} placeholder="..." className="input-field" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button onClick={() => setQuickBook(null)} className="btn-secondary flex-1 justify-center">
                  {t.common.cancel}
                </button>
                <button onClick={handleQuickBook} disabled={qbSaving} className="btn-primary flex-1 justify-center gap-2">
                  {qbSaving
                    ? <span className="spinner spinner-sm" />
                    : <span className="material-symbols-outlined text-[18px]">event_available</span>}
                  {qbSaving ? a.saving : a.bookSlot}
                </button>
                <Link href="/appointments/new"
                  className="btn-ghost flex items-center justify-center px-3 py-2">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── APPOINTMENT DETAIL PANEL ──────────────────────────────── */}
      <AnimatePresence>
        {selectedAppt && (
          <motion.div
            className="modal-overlay"
            variants={backdropAnim} initial="hidden" animate="visible" exit="exit"
            onClick={() => setSelectedAppt(null)}
          >
            <motion.div
              className="modal-panel max-w-md mx-4 overflow-hidden"
              variants={modalAnim}
              onClick={e => e.stopPropagation()}
              role="dialog" aria-labelledby="appt-detail-title"
            >
              {/* Color bar by type */}
              <div className="h-1.5" style={{ backgroundColor: (TYPE_COLORS[selectedAppt.type] ?? TYPE_COLORS.CONSULTATION).barHex }} />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="avatar avatar-lg text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: (TYPE_COLORS[selectedAppt.type] ?? TYPE_COLORS.CONSULTATION).barHex }}>
                      {selectedAppt.patientName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <h3 id="appt-detail-title" className="font-bold text-[var(--txt1)] leading-tight">{selectedAppt.patientName}</h3>
                      <p className="text-xs text-[var(--txt2)]">{selectedAppt.mrn && `MRN: ${selectedAppt.mrn} · `}{selectedAppt.type.replace("_"," ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedAppt.isUrgent && (
                      <span className="badge text-[10px] bg-[var(--err-bg)] text-[var(--err)]">URGENT</span>
                    )}
                    <button onClick={() => setSelectedAppt(null)} aria-label={t.common.close} className="btn-icon ms-1">
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>
                </div>

                {/* Status + branch */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`badge ${STATUS_STYLES[selectedAppt.status]?.bg} ${STATUS_STYLES[selectedAppt.status]?.text}`}>
                    {STATUS_STYLES[selectedAppt.status]?.label}
                  </span>
                  {selectedAppt.branchName && (
                    <span className="badge bg-[var(--blue-bg)] text-[var(--blue)] flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px]">location_on</span>
                      {selectedAppt.branchName}
                    </span>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-[var(--surface2)] rounded-xl mb-4">
                  <InfoRow icon="calendar_today" label={t.common.date}
                    value={parseLocal(selectedAppt.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} />
                  <InfoRow icon="schedule" label={t.common.time}
                    value={parseLocal(selectedAppt.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                      + (selectedAppt.scheduledEnd ? ` – ${parseLocal(selectedAppt.scheduledEnd).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}` : "")} />
                  <InfoRow icon="stethoscope" label={a.doctor} value={selectedAppt.doctorName ?? "—"} />
                  <InfoRow icon="science" label={a.specialization} value={selectedAppt.specialization || "—"} />
                  {selectedAppt.room && <InfoRow icon="meeting_room" label={t.common.room} value={selectedAppt.room} />}
                  {selectedAppt.checkedInAt && (
                    <InfoRow icon="login" label={a.checkIn}
                      value={parseLocal(selectedAppt.checkedInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} />
                  )}
                </div>

                {selectedAppt.reason && (
                  <div className="p-3 bg-[var(--blue-bg)] rounded-xl mb-4">
                    <p className="text-[10px] font-bold text-[var(--blue)] uppercase tracking-wider mb-1">{t.common.reason}</p>
                    <p className="text-sm text-[var(--txt1)]">{selectedAppt.reason}</p>
                  </div>
                )}

                {/* Quick status actions */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedAppt.status === "SCHEDULED" && (
                    <button onClick={() => updateStatus(selectedAppt.id, "CHECKED_IN")}
                      className="flex items-center gap-1.5 bg-[var(--blue)] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
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
                      className="flex items-center gap-1.5 bg-[var(--ok)] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                      <span className="material-symbols-outlined text-[14px]">task_alt</span>{a.markCompleted}
                    </button>
                  )}
                  {!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(selectedAppt.status) && (
                    <button onClick={() => updateStatus(selectedAppt.id, "NO_SHOW")}
                      className="flex items-center gap-1.5 border border-[var(--err)] text-[var(--err)] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--err-bg)] transition-colors">
                      <span className="material-symbols-outlined text-[14px]">person_off</span>{a.markNoShow}
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { setSelectedAppt(null); router.push(`/appointments/${selectedAppt.id}`); }}
                    className="btn-primary flex-col gap-1 py-2.5 rounded-xl text-xs">
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    {a.viewDetail}
                  </button>
                  <Link href={`/emr/${selectedAppt.patientId}`}
                    className="btn-secondary flex-col gap-1 py-2.5 rounded-xl text-xs justify-center">
                    <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                    {a.openEMR}
                  </Link>
                  <button
                    onClick={() => { setSelectedAppt(null); setQuickConsult({ appointmentId: selectedAppt.id, patientName: selectedAppt.patientName, doctorName: selectedAppt.doctorName ?? "" }); }}
                    className="btn-secondary flex-col gap-1 py-2.5 rounded-xl text-xs hover:border-[var(--ok)] hover:text-[var(--ok)] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                    {a.quickConsult}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ── Create Patient Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {createPatientModal && (
          <motion.div
            className="modal-overlay z-[60]"
            variants={backdropAnim} initial="hidden" animate="visible" exit="exit"
            onClick={() => setCreatePatientModal(false)}
          >
            <motion.div
              className="modal-panel max-w-sm mx-4"
              variants={modalAnim}
              onClick={e => e.stopPropagation()}
              role="dialog" aria-labelledby="cp-title"
            >
              <div className="modal-header">
                <h3 id="cp-title" className="text-base font-bold text-[var(--txt1)]">{a.createPatient}</h3>
                <button onClick={() => setCreatePatientModal(false)} aria-label={t.common.close} className="btn-icon">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="modal-body">
                {cpError && (
                  <div className="alert alert-error mb-3">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {cpError}
                  </div>
                )}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label">{t.patients.firstName} *</label>
                      <input value={cpForm.firstName} onChange={e => setCpForm(f => ({ ...f, firstName: e.target.value }))} className="input-field" />
                    </div>
                    <div>
                      <label className="form-label">{t.patients.lastName} *</label>
                      <input value={cpForm.lastName} onChange={e => setCpForm(f => ({ ...f, lastName: e.target.value }))} className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">{t.common.phone} *</label>
                    <input type="tel" value={cpForm.phone} onChange={e => setCpForm(f => ({ ...f, phone: e.target.value }))} className="input-field" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label">{t.patients.dob} *</label>
                      <input type="date" value={cpForm.dob} onChange={e => setCpForm(f => ({ ...f, dob: e.target.value }))} className="input-field" />
                    </div>
                    <div>
                      <label className="form-label">{t.patients.gender}</label>
                      <select value={cpForm.gender} onChange={e => setCpForm(f => ({ ...f, gender: e.target.value }))} className="select-field">
                        <option value="MALE">{t.patients.male}</option>
                        <option value="FEMALE">{t.patients.female}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button onClick={() => setCreatePatientModal(false)} className="btn-secondary flex-1 justify-center">
                  {t.common.cancel}
                </button>
                <button onClick={handleCreatePatient} disabled={cpSaving} className="btn-primary flex-1 justify-center gap-2">
                  {cpSaving ? <span className="spinner spinner-sm" /> : null}
                  {cpSaving ? t.common.saving : (t.common.create || "Create")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

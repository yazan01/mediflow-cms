"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSSE } from "@/lib/hooks/useSSE";
import type { DashboardStats, Appointment } from "@/types";

interface SSEDashboardPayload {
  totalPatients: number;
  todayAppointments: number;
  lowStockAlerts: number;
  timestamp: string;
}

interface RevenuePoint { month: string; revenue: number; expenses: number }
interface DeptPoint    { department: string; count: number; pct: number }

interface Props {
  stats: DashboardStats | null;
  appointments: Appointment[];
  activities: unknown[];
}

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ── Micro Sparkline ── */
function Sparkline({
  data, w = 220, h = 40,
  stroke = "var(--teal)", fill = "rgba(5,150,105,0.10)",
}: {
  data: number[]; w?: number; h?: number; stroke?: string; fill?: string;
}) {
  if (data.length < 2) return null;
  const min  = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts  = data.map((v, i) => [
    (i / (data.length - 1)) * (w - 4) + 2,
    h - 4 - ((v - min) / span) * (h - 8),
  ]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length-1][0]},${h} L${pts[0][0]},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="overflow-visible">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Donut ── */
function DonutChart({ segments, size = 140, thickness = 18 }: {
  segments: { value: number; color: string }[];
  size?: number; thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const len  = (s.value / total) * c;
        const dArr = `${len} ${c - len}`;
        const dOff = -off;
        off += len;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color}
            strokeWidth={thickness - 2} strokeDasharray={dArr} strokeDashoffset={dOff}
            strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
        );
      })}
    </svg>
  );
}

const STATUS_CLASSES: Record<string, string> = {
  SCHEDULED:        "status-muted",
  CHECKED_IN:       "status-info",
  IN_CONSULTATION:  "bg-[var(--violet-soft)] text-[var(--violet)]",
  COMPLETED:        "status-ok",
  URGENT:           "bg-[var(--err)] text-white",
  NO_SHOW:          "status-err",
  CANCELLED:        "status-muted",
};

const container = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const cardItem = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.38, ease } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.42, ease } },
};

const SPARK = {
  revenue: [42, 48, 51, 49, 56, 62, 58, 67, 64, 71, 68, 75],
  appts:   [8,  9,  7, 10, 12, 11, 13, 12, 14, 13, 12, 15],
  patients:[3,  4,  2,  5,  6,  4,  7,  5,  6,  8,  7,  9],
  stock:   [11, 9, 12,  8,  7,  6,  7,  6,  5,  4,  5,  4],
};

const DEPT_COLORS = [
  "var(--brand)", "var(--teal)", "var(--blue)", "var(--violet)", "#e29a3d", "var(--txt4)",
];

export default function DashboardClient({ stats, appointments }: Props) {
  const { t, lang } = useLanguage();
  const d = t.dashboard;

  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [depts,   setDepts]   = useState<DeptPoint[]>([]);
  const [dbOnline, setDbOnline] = useState(stats !== null);

  const { data: sseData, status: sseStatus } = useSSE<SSEDashboardPayload>("/api/events/dashboard", dbOnline);
  const liveStats = sseData ?? null;

  useEffect(() => {
    fetch("/api/dashboard/revenue").then((r) => r.ok ? r.json() : []).then(setRevenue).catch(() => {});
    fetch("/api/dashboard/departments").then((r) => r.ok ? r.json() : []).then(setDepts).catch(() => {});
  }, []);

  useEffect(() => {
    const check = () =>
      fetch("/api/health")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.database === "connected") setDbOnline(true); })
        .catch(() => {});
    check();
    if (dbOnline) return;
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, [dbOnline]);

  const liveAppts    = liveStats?.todayAppointments ?? stats?.totalAppointments;
  const liveLowStock = liveStats?.lowStockAlerts    ?? stats?.lowStockItems;

  const dateStr = new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const kpiCards = [
    {
      label: d.dailyRevenue, icon: "payments",
      iconBg: "var(--teal-soft)", iconColor: "var(--teal)",
      value: stats ? formatCurrency(stats.dailyRevenue) : "—",
      change: stats?.dailyRevenueChange,
      spark: SPARK.revenue, sparkColor: "var(--teal)", sparkFill: "rgba(5,150,105,0.10)",
    },
    {
      label: d.todayAppointments, icon: "event_available",
      iconBg: "var(--blue-bg)", iconColor: "var(--blue)",
      value: liveAppts != null ? String(liveAppts) : "—",
      change: stats?.appointmentsChange,
      spark: SPARK.appts, sparkColor: "var(--blue)", sparkFill: "rgba(23,96,180,0.10)",
    },
    {
      label: d.newPatients, icon: "person_add",
      iconBg: "var(--violet-soft)", iconColor: "var(--violet)",
      value: stats ? String(stats.newPatients) : "—",
      change: stats?.newPatientsChange,
      spark: SPARK.patients, sparkColor: "var(--violet)", sparkFill: "rgba(124,58,237,0.10)",
    },
    {
      label: d.lowStockItems, icon: "medication",
      iconBg: "var(--err-soft)", iconColor: "var(--err)",
      value: liveLowStock != null ? String(liveLowStock) : "—",
      change: null,
      spark: SPARK.stock, sparkColor: "var(--err)", sparkFill: "rgba(220,38,38,0.10)",
    },
  ];

  const totalDepts = depts.reduce((s, d) => s + d.count, 0);

  const systemItems = [
    { label: d.dbLabel,   status: dbOnline ? d.dbConnected    : d.dbPending,            ok: dbOnline },
    { label: d.authLabel, status: d.authConfigured,                                     ok: true     },
    { label: d.apiLabel,  status: d.apiRunning,                                          ok: true     },
    { label: d.smsLabel,  status: stats?.whatsappConfigured ? d.waConfigured : d.smsNotConfigured,
      ok: !!stats?.whatsappConfigured },
  ];

  return (
    <div className="space-y-5">

      {/* ── Welcome banner ─────────────────────────── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <div className="card-brand" style={{ padding: "22px 28px" }}>
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-1.5"
                style={{ color: "rgba(125,211,252,0.85)" }}>
                {dateStr}
              </p>
              <h1 className="text-[22px] font-extrabold tracking-[-0.025em] text-white leading-tight">
                {d.title}
              </h1>
              {liveAppts != null && (
                <p className="text-[13.5px] mt-1.5 font-medium"
                  style={{ color: "rgba(186,220,255,0.8)" }}>
                  {lang === "ar"
                    ? `لديك ${liveAppts} موعدًا اليوم`
                    : `You have ${liveAppts} appointment${liveAppts !== 1 ? "s" : ""} today`}
                </p>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2.5 flex-shrink-0">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 text-xs me-1"
                style={{ color: "rgba(186,220,255,0.75)" }}>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: sseStatus === "connected" ? "#2dd4bf" : "rgba(255,255,255,0.3)",
                    boxShadow: sseStatus === "connected" ? "0 0 0 3px rgba(45,212,191,0.25)" : "none",
                  }}
                  aria-hidden="true"
                />
                {sseStatus === "connected" ? t.dashboard.live : t.dashboard.offline}
              </div>

              <Link
                href="/reports"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(214,227,255,0.9)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bar_chart</span>
                {d.reports}
              </Link>

              <Link
                href="/appointments/new"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150"
                style={{
                  background: "var(--teal)",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(5,150,105,0.4)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                {d.newAppointment}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards ──────────────────────────────── */}
      <motion.section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={container}
      >
        {kpiCards.map((card) => (
          <motion.div
            key={card.label}
            variants={cardItem}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="stat-card"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="icon-box"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 21, fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
                >
                  {card.icon}
                </span>
              </div>

              {card.change != null && (
                <span
                  className="badge"
                  style={{
                    background: card.change >= 0 ? "var(--teal-soft)"  : "var(--err-soft)",
                    color:      card.change >= 0 ? "var(--teal-h)"     : "var(--err)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                    {card.change >= 0 ? "trending_up" : "trending_down"}
                  </span>
                  {Math.abs(card.change)}%
                </span>
              )}
            </div>

            <p className="t-caption font-semibold mb-1">{card.label}</p>
            <p className="tabular font-extrabold tracking-[-0.03em]"
              style={{ fontSize: 28, color: "var(--txt1)", lineHeight: 1 }}>
              {card.value}
            </p>

            <div className="mt-4 overflow-hidden rounded-lg" style={{ height: 40 }}>
              <Sparkline
                data={card.spark} w={280} h={40}
                stroke={card.sparkColor} fill={card.sparkFill}
              />
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* ── Alert banners ──────────────────────────── */}
      {stats && (stats.criticalAlerts > 0 || stats.lowStockItems > 0 || stats.pendingInvoices > 0) && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35, ease }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {stats.criticalAlerts > 0 && (
            <AlertBanner icon="emergency" colorVar="--err" bgVar="--err-soft" borderVar="--err-line"
              label={d.criticalAlerts} value={stats.criticalAlerts} link="/reports" linkLabel={d.reviewNow} />
          )}
          {stats.lowStockItems > 0 && (
            <AlertBanner icon="inventory_2" colorVar="--warn" bgVar="--warn-soft" borderVar="--warn-line"
              label={d.lowStock} value={stats.lowStockItems} link="/pharmacy" linkLabel={d.viewPharmacy} />
          )}
          {stats.pendingInvoices > 0 && (
            <AlertBanner icon="receipt_long" colorVar="--blue" bgVar="--blue-bg" borderVar="--blue-line"
              label={d.pendingInvoices} value={stats.pendingInvoices} link="/billing" linkLabel={d.viewBilling} />
          )}
        </motion.section>
      )}

      {/* ── Revenue chart + Dept load ───────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.42, ease }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Revenue trends */}
        <div className="lg:col-span-2 card p-5 flex flex-col">
          <div className="flex justify-between items-start mb-5">
            <div>
              <p className="t-eyebrow mb-1">{d.revenueSubtitle ?? "Last 30 days"}</p>
              <h3 className="t-h2">{d.revenueTitle}</h3>
            </div>
            <Link
              href="/reports"
              className="flex items-center gap-1 text-xs font-semibold hover:underline"
              style={{ color: "var(--blue)" }}
            >
              {d.fullReport}
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
            </Link>
          </div>

          <div style={{ minHeight: 220, flex: 1 }}>
            {revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--brand)" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity="0"    />
                    </linearGradient>
                    <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--teal)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--teal)" stopOpacity="0"    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--txt3)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--txt3)", fontFamily: "var(--font-mono)" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                      backgroundColor: "var(--surface)",
                      boxShadow: "var(--sh-4)",
                    }}
                    labelStyle={{ color: "var(--txt1)", fontWeight: 600 }}
                    formatter={(v) => formatCurrency(v as number)}
                  />
                  <Area type="monotone" dataKey="revenue"  name={d.dailyRevenue} stroke="var(--brand)" strokeWidth={2.5} fill="url(#gradRev)" dot={false} />
                  <Area type="monotone" dataKey="expenses" name={d.expenses}     stroke="var(--teal)"  strokeWidth={2.5} fill="url(#gradExp)"  dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 rounded-xl"
                style={{ minHeight: 220, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <span className="material-symbols-outlined text-[var(--txt4)]"
                  style={{ fontSize: 40, fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}>
                  monitoring
                </span>
                <p className="text-xs font-medium" style={{ color: "var(--txt3)" }}>{d.loadingRevenue}</p>
              </div>
            )}
          </div>
        </div>

        {/* Department load */}
        <div className="card p-5">
          <div className="flex justify-between items-center mb-5">
            <div>
              <p className="t-eyebrow mb-1">{lang === "ar" ? "التوزيع" : "Distribution"}</p>
              <h3 className="t-h2">{d.deptLoad}</h3>
            </div>
            <Link href="/reports" className="text-xs font-semibold hover:underline" style={{ color: "var(--blue)" }}>
              {d.viewAll}
            </Link>
          </div>

          {depts.length > 0 ? (
            <>
              <div className="flex items-center justify-center mb-5 relative">
                <DonutChart
                  segments={depts.map((dep, i) => ({ value: dep.count, color: DEPT_COLORS[i % DEPT_COLORS.length] }))}
                  size={144} thickness={20}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="t-eyebrow">{lang === "ar" ? "اليوم" : "Today"}</p>
                  <p className="tabular font-extrabold tracking-[-0.02em]"
                    style={{ fontSize: 26, color: "var(--txt1)", lineHeight: 1.1 }}>
                    {totalDepts}
                  </p>
                </div>
              </div>
              <div className="space-y-2.5">
                {depts.map((dept, i) => (
                  <div key={dept.department} className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-[12.5px] font-medium" style={{ color: "var(--txt2)" }}>
                      {dept.department}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface3)" }}>
                        <div className="h-full rounded-full" style={{
                          width: `${dept.pct}%`,
                          background: DEPT_COLORS[i % DEPT_COLORS.length],
                        }} />
                      </div>
                      <span className="tabular text-[11.5px] font-semibold" style={{ color: "var(--txt3)", minWidth: 26 }}>
                        {dept.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state py-10">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 26, color: "var(--txt3)" }}>business</span>
              </div>
              <p className="empty-state-desc" style={{ margin: 0 }}>
                {dbOnline ? d.noAppointments : d.noDataAvailable}
              </p>
            </div>
          )}
        </div>
      </motion.section>

      {/* ── Schedule + Quick actions ─────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26, duration: 0.42, ease }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Today's schedule */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div
            className="flex justify-between items-center px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <p className="t-eyebrow mb-0.5">{lang === "ar" ? "الجدول" : "Schedule"}</p>
              <h3 className="t-h2">{d.todaySchedule}</h3>
            </div>
            <div className="flex items-center gap-2">
              {appointments.length > 0 && (
                <span className="badge"
                  style={{ background: "var(--blue-bg)", color: "var(--blue)" }}>
                  {appointments.length} {d.appointmentsCount}
                </span>
              )}
              <Link
                href="/appointments"
                className="flex items-center gap-1 text-xs font-semibold hover:underline"
                style={{ color: "var(--blue)" }}
              >
                {d.viewCalendar}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
              </Link>
            </div>
          </div>

          <div>
            {appointments.length === 0 ? (
              <div className="empty-state py-14">
                <div className="empty-state-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: 26, color: "var(--txt3)" }}>event_available</span>
                </div>
                <p className="empty-state-title">{d.noAppointments}</p>
                <Link href="/appointments/new" className="text-xs font-semibold hover:underline" style={{ color: "var(--blue)" }}>
                  {d.bookAnAppointment}
                </Link>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {appointments.map((apt, idx) => {
                  const statusCls   = STATUS_CLASSES[apt.status] ?? "status-muted";
                  const statusLabel = (d.statuses as Record<string, string>)[apt.status] ?? apt.status;
                  const isUrgent    = apt.status === "URGENT";
                  const isConsult   = apt.status === "IN_CONSULTATION";
                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.32 + idx * 0.05, duration: 0.28, ease }}
                    >
                      <Link
                        href={`/appointments/${apt.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-100 group relative"
                        style={{
                          background: isConsult
                            ? "color-mix(in srgb, var(--violet-soft) 60%, transparent)"
                            : isUrgent
                              ? "color-mix(in srgb, var(--err-soft) 50%, transparent)"
                              : "transparent",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--hover)"; }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background = isConsult
                            ? "color-mix(in srgb, var(--violet-soft) 60%, transparent)"
                            : isUrgent ? "color-mix(in srgb, var(--err-soft) 50%, transparent)" : "transparent";
                        }}
                      >
                        {/* Status bar */}
                        {(isConsult || isUrgent) && (
                          <span
                            className="absolute start-0 top-3 bottom-3 w-[3px] rounded-e-full"
                            style={{ background: isConsult ? "var(--violet)" : "var(--err)" }}
                          />
                        )}

                        {/* Time block */}
                        <div
                          className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl tabular"
                          style={{
                            width: 46, height: 46,
                            background: isUrgent ? "var(--err-soft)" : "var(--surface2)",
                            color: isUrgent ? "var(--err)" : "var(--txt2)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          <span className="text-[13px] font-bold leading-none">
                            {new Date(apt.scheduledAt).getHours().toString().padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold">
                            {new Date(apt.scheduledAt).getMinutes().toString().padStart(2, "0")}
                          </span>
                          <span className="text-[8px] uppercase" style={{ opacity: 0.6 }}>
                            {new Date(apt.scheduledAt).getHours() >= 12 ? "PM" : "AM"}
                          </span>
                        </div>

                        {/* Patient info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold truncate transition-colors"
                            style={{ color: "var(--txt1)" }}>
                            {apt.patientName}
                          </p>
                          <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--txt3)" }}>
                            {apt.type} · {apt.doctorName}{apt.room && ` · ${apt.room}`}
                          </p>
                        </div>

                        {/* Status badge + arrow */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`badge badge-sm ${statusCls}`}>
                            {statusLabel}
                          </span>
                          <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ fontSize: 18, color: "var(--blue)" }}>
                            chevron_right
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-5">
            <p className="t-eyebrow mb-3">{d.quickLinks}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/patients/new",     icon: "person_add",   label: d.registerPatient, color: "var(--brand)",  bg: "var(--brand-soft)"  },
                { href: "/appointments/new", icon: "event",        label: d.bookAppointment, color: "var(--blue)",   bg: "var(--blue-bg)"     },
                { href: "/billing/new",      icon: "receipt_long", label: d.createInvoice,   color: "var(--teal)",   bg: "var(--teal-soft)"   },
                { href: "/pharmacy",         icon: "pill",         label: d.dispenseMeds,    color: "var(--violet)", bg: "var(--violet-soft)" },
              ].map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex flex-col items-center gap-2.5 p-3.5 rounded-xl text-center group transition-all duration-150"
                  style={{ background: "var(--surface2)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = q.bg;
                    (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "var(--sh-sm)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface2)";
                    (e.currentTarget as HTMLAnchorElement).style.transform = "";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "";
                  }}
                >
                  <span
                    className="material-symbols-outlined transition-transform duration-150 group-hover:scale-110"
                    style={{
                      fontSize: 22, color: q.color,
                      fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
                    }}
                  >
                    {q.icon}
                  </span>
                  <span className="text-[11.5px] font-semibold leading-tight" style={{ color: "var(--txt1)" }}>
                    {q.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* System status */}
          <div className="card p-5">
            <p className="t-eyebrow mb-4">{d.systemStatus}</p>
            <div className="space-y-3.5">
              {systemItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium" style={{ color: "var(--txt1)" }}>{item.label}</span>
                  <span
                    className="flex items-center gap-1.5 text-[11.5px] font-bold flex-shrink-0"
                    style={{ color: item.ok ? "var(--teal)" : "var(--warn)" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        background: item.ok ? "var(--teal)" : "var(--warn)",
                        boxShadow: item.ok
                          ? "0 0 0 3px rgba(5,150,105,0.2)"
                          : "0 0 0 3px rgba(217,119,6,0.2)",
                      }}
                    />
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function AlertBanner({
  icon, colorVar, bgVar, borderVar, label, value, link, linkLabel,
}: {
  icon: string; colorVar: string; bgVar: string; borderVar: string;
  label: string; value: number; link: string; linkLabel: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3.5 rounded-xl"
      style={{
        background: `var(${bgVar})`,
        border: `1px solid color-mix(in srgb, var(${borderVar}) 50%, transparent)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="icon-box icon-box-sm"
          style={{
            background: `color-mix(in srgb, var(${colorVar}) 12%, transparent)`,
            color: `var(${colorVar})`,
          }}
        >
          <span className="material-symbols-outlined"
            style={{ fontSize: 16, fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>
            {icon}
          </span>
        </div>
        <p className="text-[13px] font-semibold" style={{ color: "var(--txt1)" }}>
          {value} {label}
        </p>
      </div>
      <Link
        href={link}
        className="text-xs font-bold hover:underline flex-shrink-0"
        style={{ color: `var(${colorVar})` }}
      >
        {linkLabel}
      </Link>
    </div>
  );
}

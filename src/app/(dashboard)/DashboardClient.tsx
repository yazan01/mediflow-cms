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

// Sparkline SVG component
function Sparkline({
  data, w = 220, h = 36,
  stroke = "var(--teal)", fill = "rgba(13,148,136,0.12)",
}: {
  data: number[]; w?: number; h?: number; stroke?: string; fill?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (w - 2) + 1,
    h - 2 - ((v - min) / span) * (h - 4),
  ]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Donut SVG component
function DonutChart({ segments, size = 140, thickness = 18 }: {
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const dArr = `${len} ${c - len}`;
        const dOff = -off;
        off += len;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
            strokeWidth={thickness} strokeDasharray={dArr} strokeDashoffset={dOff}
            strokeLinecap="butt" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
      })}
    </svg>
  );
}

const STATUS_CLASSES: Record<string, string> = {
  SCHEDULED:        "bg-[var(--surface-3)] text-[var(--t2)]",
  CHECKED_IN:       "bg-[var(--blue-soft)] text-[var(--blue)]",
  IN_CONSULTATION:  "bg-[var(--violet-soft)] text-[var(--violet)]",
  COMPLETED:        "bg-[var(--success-soft)] text-[var(--success)]",
  URGENT:           "bg-[var(--err)] text-white",
  NO_SHOW:          "bg-[var(--err-soft)] text-[var(--err)]",
  CANCELLED:        "bg-[var(--surface-3)] text-[var(--t3)]",
};

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardItem = {
  hidden:  { opacity: 0, y: 18, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

// Demo sparkline data (12-point trend for visual sugar)
const SPARK = {
  revenue: [42, 48, 51, 49, 56, 62, 58, 67, 64, 71, 68, 75],
  appts:   [8, 9, 7, 10, 12, 11, 13, 12, 14, 13, 12, 15],
  patients:[3, 4, 2, 5, 6, 4, 7, 5, 6, 8, 7, 9],
  stock:   [11, 9, 12, 8, 7, 6, 7, 6, 5, 4, 5, 4],
};

const DEPT_COLORS = [
  "var(--brand)", "var(--teal)", "var(--blue)", "var(--violet)", "#e29a3d", "var(--t4)",
];

export default function DashboardClient({ stats, appointments }: Props) {
  const { t, lang } = useLanguage();
  const d = t.dashboard;

  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [depts, setDepts]     = useState<DeptPoint[]>([]);
  const [dbOnline, setDbOnline] = useState(stats !== null);

  const { data: sseData, status: sseStatus } = useSSE<SSEDashboardPayload>("/api/events/dashboard", dbOnline);
  const liveStats = sseData ?? null;

  useEffect(() => {
    fetch("/api/dashboard/revenue")
      .then((r) => r.ok ? r.json() : [])
      .then(setRevenue)
      .catch(() => {});
    fetch("/api/dashboard/departments")
      .then((r) => r.ok ? r.json() : [])
      .then(setDepts)
      .catch(() => {});
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

  const liveAppointments = liveStats?.todayAppointments ?? stats?.totalAppointments;
  const liveLowStock     = liveStats?.lowStockAlerts    ?? stats?.lowStockItems;

  const dateStr = new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const kpiCards = [
    {
      label: d.dailyRevenue, icon: "payments",
      iconBg: "var(--teal-soft)", iconColor: "var(--teal)",
      value: stats ? formatCurrency(stats.dailyRevenue) : "—",
      change: stats?.dailyRevenueChange,
      spark: SPARK.revenue, sparkColor: "var(--teal)",
      sparkFill: "rgba(13,148,136,0.14)",
    },
    {
      label: d.todayAppointments, icon: "event_available",
      iconBg: "var(--blue-soft)", iconColor: "var(--blue)",
      value: liveAppointments != null ? String(liveAppointments) : "—",
      change: stats?.appointmentsChange,
      spark: SPARK.appts, sparkColor: "var(--blue)",
      sparkFill: "rgba(30,111,217,0.12)",
    },
    {
      label: d.newPatients, icon: "person_add",
      iconBg: "var(--violet-soft)", iconColor: "var(--violet)",
      value: stats ? String(stats.newPatients) : "—",
      change: stats?.newPatientsChange,
      spark: SPARK.patients, sparkColor: "var(--violet)",
      sparkFill: "rgba(110,86,207,0.12)",
    },
    {
      label: d.lowStockItems, icon: "medication",
      iconBg: "var(--err-soft)", iconColor: "var(--err)",
      value: liveLowStock != null ? String(liveLowStock) : "—",
      change: null,
      spark: SPARK.stock, sparkColor: "var(--err)",
      sparkFill: "rgba(217,45,32,0.12)",
    },
  ];

  const totalDepts = depts.reduce((s, d) => s + d.count, 0);

  const systemItems = [
    { label: d.dbLabel,   status: dbOnline ? d.dbConnected    : d.dbPending,       ok: dbOnline },
    { label: d.authLabel, status: d.authConfigured,                                  ok: true     },
    { label: d.apiLabel,  status: d.apiRunning,                                      ok: true     },
    { label: d.smsLabel,  status: stats?.whatsappConfigured ? d.waConfigured : d.smsNotConfigured, ok: !!stats?.whatsappConfigured },
  ];

  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <div
          className="card overflow-hidden"
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, var(--brand) 0%, #163d6e 60%, #1a4a85 100%)",
            color: "white",
            border: "0",
            position: "relative",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(800px 200px at 90% 0%, rgba(45,212,191,0.18), transparent), radial-gradient(600px 200px at 0% 100%, rgba(94,140,239,0.16), transparent)",
            pointerEvents: "none",
          }} />
          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase" style={{ opacity: 0.7 }}>
                {dateStr}
              </p>
              <h1 className="text-[22px] font-bold tracking-[-0.02em] mt-1">{d.title}</h1>
              <p className="text-[13.5px] mt-1" style={{ opacity: 0.78 }}>
                {liveAppointments != null
                  ? (lang === "ar"
                    ? `لديك ${liveAppointments} موعدًا اليوم`
                    : `You have ${liveAppointments} appointments today`)
                  : ""}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <div className="hidden md:flex items-center gap-1.5 text-xs me-2" style={{ opacity: 0.75 }}>
                <span className={`w-2 h-2 rounded-full ${sseStatus === "connected" ? "animate-[pulse_2s_infinite]" : ""}`}
                  style={{ background: sseStatus === "connected" ? "#2dd4bf" : "rgba(255,255,255,0.4)" }}
                  aria-hidden="true"
                />
                {sseStatus === "connected" ? t.dashboard.live : t.dashboard.offline}
              </div>
              <Link
                href="/reports"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "white",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">bar_chart</span>
                {d.reports}
              </Link>
              <Link
                href="/appointments/new"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "var(--teal)", color: "white" }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                {d.newAppointment}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
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
            className="card p-5 cursor-default overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                <span className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: `'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
                >
                  {card.icon}
                </span>
              </div>
              {card.change != null && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold tabular"
                  style={{
                    background: card.change >= 0 ? "var(--success-soft)" : "var(--err-soft)",
                    color:      card.change >= 0 ? "var(--success)"      : "var(--err)",
                  }}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {card.change >= 0 ? "trending_up" : "trending_down"}
                  </span>
                  {Math.abs(card.change)}%
                </span>
              )}
            </div>
            <p className="text-[13px] font-medium mb-1" style={{ color: "var(--t3)" }}>{card.label}</p>
            <p className="text-[28px] font-bold tracking-[-0.025em] tabular" style={{ color: "var(--t1)" }}>
              {card.value}
            </p>
            <div className="mt-3">
              <Sparkline data={card.spark} w={220} h={36} stroke={card.sparkColor} fill={card.sparkFill} />
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* Alerts row */}
      {stats && (stats.criticalAlerts > 0 || stats.lowStockItems > 0 || stats.pendingInvoices > 0) && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
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
            <AlertBanner icon="receipt_long" colorVar="--blue" bgVar="--blue-soft" borderVar="--blue-line"
              label={d.pendingInvoices} value={stats.pendingInvoices} link="/billing" linkLabel={d.viewBilling} />
          )}
        </motion.section>
      )}

      {/* Revenue + Dept load */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
      >
        {/* Revenue Trends */}
        <div className="lg:col-span-2 card p-5 flex flex-col">
          <div className="flex justify-between items-start mb-5">
            <div>
              <p className="t-eyebrow">{d.revenueSubtitle ?? "Last 30 days"}</p>
              <h3 className="t-h2 mt-0.5">{d.revenueTitle}</h3>
            </div>
            <Link href="/reports" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: "var(--blue)" }}>
              {d.fullReport}
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </Link>
          </div>
          <div className="flex-1" style={{ minHeight: 220 }}>
            {revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--t3)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--t3)", fontFamily: "var(--font-mono)" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md, 10px)",
                      fontSize: 12,
                      backgroundColor: "var(--surface)",
                      boxShadow: "var(--sh-3)",
                    }}
                    labelStyle={{ color: "var(--t1)" }}
                    formatter={(v) => formatCurrency(v as number)}
                  />
                  <Area type="monotone" dataKey="revenue"  name={d.dailyRevenue} stroke="var(--brand)" strokeWidth={2} fill="url(#gradRev)" dot={false} />
                  <Area type="monotone" dataKey="expenses" name={d.expenses}     stroke="var(--teal)"  strokeWidth={2} fill="url(#gradExp)"  dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 border border-[var(--border)] rounded-[var(--r-lg)] bg-[var(--surface-2)]" style={{ minHeight: 220 }}>
                <span className="material-symbols-outlined text-[var(--t4)] text-4xl">monitoring</span>
                <p className="text-xs text-[var(--t3)] text-center">{d.loadingRevenue}</p>
              </div>
            )}
          </div>
        </div>

        {/* Department Load */}
        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="t-eyebrow">{lang === "ar" ? "التوزيع" : "Distribution"}</p>
              <h3 className="t-h2 mt-0.5">{d.deptLoad}</h3>
            </div>
            <Link href="/reports" className="text-xs font-semibold hover:underline" style={{ color: "var(--blue)" }}>{d.viewAll}</Link>
          </div>

          {depts.length > 0 ? (
            <>
              <div className="flex items-center justify-center mb-4 relative">
                <DonutChart
                  segments={depts.map((dep, i) => ({ value: dep.count, color: DEPT_COLORS[i % DEPT_COLORS.length] }))}
                  size={140}
                  thickness={20}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color: "var(--t3)" }}>
                    {lang === "ar" ? "اليوم" : "Total"}
                  </p>
                  <p className="text-[24px] font-bold tracking-[-0.02em] tabular" style={{ color: "var(--t1)" }}>
                    {totalDepts}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {depts.map((dept, i) => (
                  <div key={dept.department} className="flex items-center gap-2.5 text-[12.5px]">
                    <span
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }}
                    />
                    <span className="flex-1 truncate font-medium" style={{ color: "var(--t2)" }}>{dept.department}</span>
                    <span className="tabular" style={{ color: "var(--t3)" }}>{dept.pct}%</span>
                    <span className="font-semibold tabular" style={{ color: "var(--t1)", minWidth: 28, textAlign: "end" }}>{dept.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <span className="material-symbols-outlined text-[var(--t4)] text-4xl">business</span>
              <p className="text-xs text-[var(--t3)] text-center">
                {dbOnline ? d.noAppointments : d.noDataAvailable}
              </p>
            </div>
          )}
        </div>
      </motion.section>

      {/* Schedule + Quick Actions */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
      >
        {/* Today's schedule */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center">
            <div>
              <p className="t-eyebrow">{lang === "ar" ? "الجدول" : "Schedule"}</p>
              <h3 className="t-h2 mt-0.5">{d.todaySchedule}</h3>
            </div>
            <div className="flex items-center gap-2">
              {appointments.length > 0 && (
                <span
                  className="text-[11.5px] font-bold px-2 py-0.5 rounded-full tabular"
                  style={{ background: "var(--blue-soft)", color: "var(--blue)" }}
                >
                  {appointments.length} {d.appointmentsCount}
                </span>
              )}
              <Link href="/appointments" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: "var(--blue)" }}>
                {d.viewCalendar}
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </Link>
            </div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {appointments.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                  <span className="material-symbols-outlined text-[var(--t3)] text-2xl">event_available</span>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--t3)" }}>{d.noAppointments}</p>
                <Link href="/appointments/new" className="text-xs font-semibold hover:underline" style={{ color: "var(--blue)" }}>
                  {d.bookAnAppointment}
                </Link>
              </div>
            ) : (
              appointments.map((apt, idx) => {
                const statusClass = STATUS_CLASSES[apt.status] ?? STATUS_CLASSES.SCHEDULED;
                const statusLabel = (d.statuses as Record<string, string>)[apt.status] ?? apt.status;
                const isUrgent = apt.status === "URGENT";
                const isConsult = apt.status === "IN_CONSULTATION";
                return (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + idx * 0.05, duration: 0.3 }}
                  >
                    <Link
                      href={`/appointments/${apt.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--hover)] transition-colors group relative"
                      style={isConsult ? { background: "color-mix(in srgb, var(--violet-soft) 50%, transparent)" } : isUrgent ? { background: "color-mix(in srgb, var(--err-soft) 50%, transparent)" } : {}}
                    >
                      {isConsult && (
                        <span
                          className="absolute start-0 top-2 bottom-2 w-[3px]"
                          style={{ background: "var(--violet)", borderRadius: "0 4px 4px 0" }}
                        />
                      )}
                      <div
                        className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl text-center"
                        style={{
                          width: 48, height: 48,
                          background: isUrgent ? "var(--err-soft)" : "var(--surface-2)",
                          color:      isUrgent ? "var(--err)"      : "var(--t2)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        <span className="text-[13px] font-bold leading-none">
                          {new Date(apt.scheduledAt).getHours().toString().padStart(2, "0")}
                        </span>
                        <span className="text-[10px]">
                          {new Date(apt.scheduledAt).getMinutes().toString().padStart(2, "0")}
                        </span>
                        <span className="text-[9px] uppercase" style={{ opacity: 0.7 }}>
                          {new Date(apt.scheduledAt).getHours() >= 12 ? "PM" : "AM"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold truncate group-hover:text-[var(--blue)] transition-colors" style={{ color: "var(--t1)" }}>
                          {apt.patientName}
                        </p>
                        <p className="text-[12px] truncate" style={{ color: "var(--t3)" }}>
                          {apt.type} · {apt.doctorName}{apt.room && ` · ${apt.room}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusClass}`}>
                          {statusLabel}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-[var(--t3)] group-hover:text-[var(--blue)]">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions + System Status */}
        <div className="space-y-4">
          {/* Quick links */}
          <div className="card p-5">
            <p className="t-eyebrow mb-3">{d.quickLinks}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: "/patients/new",     icon: "person_add",   label: d.registerPatient, colorVar: "--brand" },
                { href: "/appointments/new", icon: "event",        label: d.bookAppointment, colorVar: "--blue" },
                { href: "/billing/new",      icon: "receipt_long", label: d.createInvoice,   colorVar: "--teal" },
                { href: "/pharmacy",         icon: "pill",         label: d.dispenseMeds,    colorVar: "--violet" },
              ].map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-[var(--hover)] transition-colors text-center group"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform"
                    style={{ color: `var(${q.colorVar})` }}
                  >
                    {q.icon}
                  </span>
                  <span className="text-xs font-semibold leading-tight" style={{ color: "var(--t1)" }}>{q.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* System status */}
          <div className="card p-5">
            <p className="t-eyebrow mb-3">{d.systemStatus}</p>
            <div className="space-y-3">
              {systemItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "var(--t1)" }}>{item.label}</span>
                  <span
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: item.ok ? "var(--success)" : "var(--warn)" }}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${!item.ok ? "animate-pulse" : ""}`}
                      style={{ background: item.ok ? "var(--success)" : "var(--warn)" }}
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
      className="rounded-xl p-4 flex items-center justify-between"
      style={{
        background: `var(${bgVar})`,
        border: `1px solid color-mix(in srgb, var(${borderVar}) 40%, transparent)`,
      }}
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[22px]" style={{ color: `var(${colorVar})` }}>{icon}</span>
        <p className="text-sm font-semibold" style={{ color: "var(--t1)" }}>{value} {label}</p>
      </div>
      <Link href={link} className="text-xs font-semibold hover:underline" style={{ color: `var(${colorVar})` }}>
        {linkLabel}
      </Link>
    </div>
  );
}

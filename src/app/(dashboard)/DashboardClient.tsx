"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { DashboardStats, Appointment } from "@/types";

interface Props {
  stats: DashboardStats | null;
  appointments: Appointment[];
  activities: unknown[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SCHEDULED:      { label: "Scheduled",       className: "bg-[#e9e7eb] text-[#43474e]" },
  CHECKED_IN:     { label: "Checked In",      className: "bg-[#d3e4ff] text-[#00477f]" },
  IN_CONSULTATION:{ label: "In Consultation", className: "bg-[#d3e4ff] text-[#1960a3]" },
  COMPLETED:      { label: "Completed",       className: "bg-[#ccfbf1] text-[#0d9488]" },
  URGENT:         { label: "Urgent",          className: "bg-[#ba1a1a] text-white" },
  NO_SHOW:        { label: "No Show",         className: "bg-[#ffdad6] text-[#93000a]" },
  CANCELLED:      { label: "Cancelled",       className: "bg-[#e3e2e6] text-[#74777f]" },
};

export default function DashboardClient({ stats, appointments }: Props) {
  const kpiCards = [
    {
      label: "Daily Revenue",
      value: stats ? formatCurrency(stats.dailyRevenue) : "—",
      change: stats?.dailyRevenueChange,
      icon: "payments",
      iconBg: "bg-[#d3e4ff]",
      iconColor: "text-[#1960a3]",
    },
    {
      label: "Today's Appointments",
      value: stats ? String(stats.totalAppointments) : "—",
      change: stats?.appointmentsChange,
      icon: "calendar_today",
      iconBg: "bg-[#d6e3ff]",
      iconColor: "text-[#002045]",
    },
    {
      label: "New Patients",
      value: stats ? String(stats.newPatients) : "—",
      change: stats?.newPatientsChange,
      icon: "person_add",
      iconBg: "bg-[#ffddba]",
      iconColor: "text-[#633f0f]",
    },
    {
      label: "Bed Occupancy",
      value: stats ? `${stats.bedOccupancy}%` : "—",
      change: stats?.bedOccupancyChange,
      icon: "king_bed",
      iconBg: "bg-[#d3e4ff]",
      iconColor: "text-[#1960a3]",
    },
  ];

  const quickLinks = [
    { href: "/patients/new",     icon: "person_add",    label: "Register Patient",  color: "text-[#002045]" },
    { href: "/appointments/new", icon: "event",         label: "Book Appointment",  color: "text-[#1960a3]" },
    { href: "/billing/new",      icon: "receipt_long",  label: "Create Invoice",    color: "text-[#319795]" },
    { href: "/pharmacy",         icon: "medication",    label: "Dispense Meds",     color: "text-[#633f0f]" },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Dashboard</h1>
          <p className="text-sm text-[#74777f] mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">bar_chart</span>
            Reports
          </Link>
          <Link
            href="/appointments/new"
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Appointment
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 ${card.iconBg} rounded-2xl group-hover:scale-110 transition-transform`}>
                <span className={`material-symbols-outlined ${card.iconColor} text-[22px]`}>{card.icon}</span>
              </div>
              {card.change !== undefined && (
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    card.change >= 0 ? "bg-[#ccfbf1]/50 text-[#0d9488]" : "bg-[#ffdad6] text-[#93000a]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {card.change >= 0 ? "trending_up" : "trending_down"}
                  </span>
                  {Math.abs(card.change)}%
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-[#74777f] uppercase tracking-wider mb-1">{card.label}</p>
            <p className="text-3xl font-bold text-[#1a1c1e]">{card.value}</p>
          </div>
        ))}
      </section>

      {/* Alerts row */}
      {stats && (stats.criticalAlerts > 0 || stats.lowStockItems > 0 || stats.pendingInvoices > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.criticalAlerts > 0 && (
            <AlertBanner
              icon="emergency"
              color="text-[#ba1a1a]"
              bg="bg-[#ffdad6]"
              border="border-[#ba1a1a]/20"
              label="Critical Alerts"
              value={stats.criticalAlerts}
              link="/reports"
              linkLabel="Review now"
            />
          )}
          {stats.lowStockItems > 0 && (
            <AlertBanner
              icon="inventory_2"
              color="text-[#d97706]"
              bg="bg-[#fff7ed]"
              border="border-[#d97706]/20"
              label="Low Stock Items"
              value={stats.lowStockItems}
              link="/pharmacy"
              linkLabel="View pharmacy"
            />
          )}
          {stats.pendingInvoices > 0 && (
            <AlertBanner
              icon="receipt_long"
              color="text-[#1960a3]"
              bg="bg-[#eff6ff]"
              border="border-[#1960a3]/20"
              label="Pending Invoices"
              value={stats.pendingInvoices}
              link="/billing"
              linkLabel="View billing"
            />
          )}
        </section>
      )}

      {/* Main content grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[#1a1c1e]">Revenue Trends</h3>
              <p className="text-xs text-[#74777f]">Monthly revenue vs expenses</p>
            </div>
            <Link href="/reports" className="text-xs text-[#1960a3] font-semibold hover:underline flex items-center gap-1">
              Full report
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </Link>
          </div>

          {/* SVG bar chart placeholder — replaced by Recharts in production */}
          <div className="flex-1 h-56 chart-grid rounded-lg relative flex items-end justify-around p-4 gap-3 border border-[#e3e2e6] bg-[#faf9fd]">
            {stats ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-[#74777f]">
                Chart renders with live data from /api/dashboard/revenue
              </p>
            ) : (
              <EmptyState icon="bar_chart" label="Connect your database to see revenue analytics" />
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4">
            <span className="flex items-center gap-2 text-xs text-[#43474e]">
              <span className="w-3 h-3 rounded-full bg-[#1960a3]"></span> Revenue
            </span>
            <span className="flex items-center gap-2 text-xs text-[#43474e]">
              <span className="w-3 h-3 rounded-full bg-[#adc7f7]"></span> Expenses
            </span>
          </div>
        </div>

        {/* Department load */}
        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-[#1a1c1e]">Department Load</h3>
            <Link href="/reports" className="text-xs text-[#1960a3] hover:underline font-semibold">View all</Link>
          </div>

          {stats ? (
            <p className="text-sm text-[#74777f] text-center py-8">
              Loads from /api/dashboard/departments
            </p>
          ) : (
            <EmptyState icon="business" label="Department data will appear after DB setup" />
          )}
        </div>
      </section>

      {/* Schedule & Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's schedule */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-5 border-b border-[#e3e2e6] flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-[#1a1c1e]">Today&apos;s Schedule</h3>
              {appointments.length > 0 && (
                <span className="bg-[#d3e4ff]/40 text-[#1960a3] px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {appointments.length} appointments
                </span>
              )}
            </div>
            <Link
              href="/appointments"
              className="text-xs text-[#1960a3] font-semibold hover:underline flex items-center gap-1"
            >
              View calendar
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </Link>
          </div>

          <div className="divide-y divide-[#e3e2e6]">
            {appointments.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-[#f4f3f7] rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#74777f] text-2xl">calendar_today</span>
                </div>
                <p className="text-sm text-[#74777f] font-medium">No appointments today</p>
                <Link href="/appointments/new" className="text-xs text-[#1960a3] hover:underline font-semibold">
                  + Book an appointment
                </Link>
              </div>
            ) : (
              appointments.map((apt) => {
                const statusCfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.SCHEDULED;
                const isUrgent = apt.status === "URGENT";
                return (
                  <Link
                    key={apt.id}
                    href={`/appointments/${apt.id}`}
                    className={`flex items-center justify-between p-4 hover:bg-[#f4f3f7] transition-colors group ${isUrgent ? "bg-[#fff5f5]" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-14 h-14 flex flex-col items-center justify-center rounded-xl text-center ${
                          isUrgent ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#f4f3f7] text-[#43474e]"
                        }`}
                      >
                        <span className="text-xs font-bold leading-none">{new Date(apt.scheduledAt).getHours().toString().padStart(2, "0")}</span>
                        <span className="text-[10px]">{new Date(apt.scheduledAt).getMinutes().toString().padStart(2, "0")}</span>
                        <span className="text-[9px] uppercase opacity-70">
                          {new Date(apt.scheduledAt).getHours() >= 12 ? "PM" : "AM"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1a1c1e] group-hover:text-[#1960a3] transition-colors">
                          {apt.patientName}
                        </p>
                        <p className="text-xs text-[#74777f]">
                          {apt.type} · {apt.doctorName} {apt.room && `· ${apt.room}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-[#74777f] group-hover:text-[#1960a3]">
                        chevron_right
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Quick actions + activity */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickLinks.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex flex-col items-center gap-2 p-4 bg-[#f4f3f7] rounded-xl hover:bg-[#e9e7eb] transition-colors text-center group"
                >
                  <span className={`material-symbols-outlined text-[24px] ${q.color} group-hover:scale-110 transition-transform`}>
                    {q.icon}
                  </span>
                  <span className="text-xs font-semibold text-[#1a1c1e] leading-tight">{q.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* System status */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider mb-4">System Status</h3>
            <div className="space-y-3">
              {[
                { label: "Database", status: "Pending Setup", ok: false },
                { label: "Authentication", status: "Configured", ok: true },
                { label: "API Server", status: "Running", ok: true },
                { label: "SMS Gateway", status: "Not configured", ok: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-[#1a1c1e]">{item.label}</span>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold ${
                      item.ok ? "text-[#0d9488]" : "text-[#d97706]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${item.ok ? "bg-[#0d9488]" : "bg-[#d97706]"}`}></span>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AlertBanner({
  icon, color, bg, border, label, value, link, linkLabel,
}: {
  icon: string; color: string; bg: string; border: string;
  label: string; value: number; link: string; linkLabel: string;
}) {
  return (
    <div className={`${bg} border ${border} rounded-xl p-4 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined ${color} text-[22px]`}>{icon}</span>
        <div>
          <p className="text-sm font-semibold text-[#1a1c1e]">
            {value} {label}
          </p>
        </div>
      </div>
      <Link href={link} className={`text-xs font-semibold ${color} hover:underline`}>
        {linkLabel}
      </Link>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <span className="material-symbols-outlined text-[#c4c6cf] text-4xl">{icon}</span>
      <p className="text-xs text-[#74777f] text-center max-w-[180px]">{label}</p>
    </div>
  );
}

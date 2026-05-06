import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      todayRevenue,
      yesterdayRevenue,
      todayAppointments,
      yesterdayAppointments,
      newPatientsToday,
      newPatientsYesterday,
      pendingInvoices,
      outOfStockMeds,
      lowStockMeds,
      waitingPatients,
    ] = await Promise.allSettled([
      prisma.payment.aggregate({
        where: { paidAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: yesterday, lt: today } },
        _sum: { amount: true },
      }),
      prisma.appointment.count({
        where: { scheduledAt: { gte: today, lt: tomorrow }, status: { notIn: ["CANCELLED"] } },
      }),
      prisma.appointment.count({
        where: { scheduledAt: { gte: yesterday, lt: today }, status: { notIn: ["CANCELLED"] } },
      }),
      prisma.patient.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.patient.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      prisma.invoice.count({ where: { status: { in: ["PENDING", "OVERDUE"] } } }),
      prisma.medication.count({ where: { isActive: true, stockQuantity: 0 } }),
      prisma.medication.count({
        where: { isActive: true, stockQuantity: { gt: 0 } },
      }),
      prisma.appointment.count({
        where: { scheduledAt: { gte: today, lt: tomorrow }, status: "CHECKED_IN" },
      }),
    ]);

    const getVal = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === "fulfilled" ? r.value : fallback;

    const revToday = getVal(todayRevenue, { _sum: { amount: null } });
    const revYest = getVal(yesterdayRevenue, { _sum: { amount: null } });
    const aptToday = getVal(todayAppointments, 0);
    const aptYest = getVal(yesterdayAppointments, 0);
    const patToday = getVal(newPatientsToday, 0);
    const patYest = getVal(newPatientsYesterday, 0);

    const dailyRevenue = Number(revToday._sum.amount ?? 0);
    const prevRevenue = Number(revYest._sum.amount ?? 0);
    const pct = (curr: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);

    return NextResponse.json({
      dailyRevenue,
      dailyRevenueChange: pct(dailyRevenue, prevRevenue),
      totalAppointments: aptToday,
      appointmentsChange: pct(aptToday, aptYest),
      newPatients: patToday,
      newPatientsChange: pct(patToday, patYest),
      bedOccupancy: 0,
      bedOccupancyChange: 0,
      pendingInvoices: getVal(pendingInvoices, 0),
      criticalAlerts: getVal(outOfStockMeds, 0),
      lowStockItems: getVal(lowStockMeds, 0),
      waitingPatients: getVal(waitingPatients, 0),
    });
  } catch (error) {
    console.error("[GET /api/dashboard/stats]", error);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateRange = (from && to)
      ? { gte: new Date(from), lte: new Date(to) }
      : { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) };

    const [
      revenue,
      appointmentCount,
      newPatients,
      invoiceBreakdown,
      topServices,
    ] = await Promise.allSettled([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: dateRange },
      }),
      prisma.appointment.count({
        where: { scheduledAt: { gte: dateRange.gte, lte: dateRange.lte } },
      }),
      prisma.patient.count({
        where: { createdAt: dateRange },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      prisma.invoiceItem.groupBy({
        by: ["description"],
        _sum: { totalPrice: true },
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      revenue: revenue.status === "fulfilled" ? revenue.value._sum.amount ?? 0 : 0,
      appointments: appointmentCount.status === "fulfilled" ? appointmentCount.value : 0,
      newPatients: newPatients.status === "fulfilled" ? newPatients.value : 0,
      invoiceBreakdown: invoiceBreakdown.status === "fulfilled" ? invoiceBreakdown.value : [],
      topServices: topServices.status === "fulfilled" ? topServices.value : [],
    });
  } catch (error) {
    console.error("[GET /api/reports/overview]", error);
    return NextResponse.json({ error: "Failed to fetch report data" }, { status: 500 });
  }
}

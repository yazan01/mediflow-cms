import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const [patient, consultations, labOrders, radiologyOrders] = await Promise.all([
      prisma.patient.findUnique({
        where: { id },
        select: {
          id: true, mrn: true, firstName: true, lastName: true,
          dateOfBirth: true, gender: true, bloodType: true,
          allergies: true, chronicConditions: true,
          phone: true, email: true, insuranceProvider: true,
        },
      }),
      prisma.consultation.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          vitals: true,
          diagnoses: true,
          prescriptions: { include: { medication: { select: { genericName: true, brandName: true } } } },
          doctor: { include: { user: { select: { name: true } } } },
          appointment: { select: { scheduledAt: true, type: true } },
        },
      }),
      prisma.labOrder.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { results: true },
      }),
      prisma.radiologyOrder.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    return NextResponse.json({ patient, consultations, labOrders, radiologyOrders });
  } catch (error) {
    console.error("[GET /api/emr/[id]]", error);
    return NextResponse.json({ error: "Failed to fetch EMR" }, { status: 500 });
  }
}

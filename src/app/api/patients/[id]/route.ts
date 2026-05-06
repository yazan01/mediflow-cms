import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { scheduledAt: "desc" },
          take: 10,
          include: {
            doctor: { include: { user: { select: { name: true } } } },
          },
        },
        consultations: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { diagnoses: true, vitals: true },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        labOrders: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { results: true },
        },
        documents: { orderBy: { uploadedAt: "desc" } },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json(patient);
  } catch (error) {
    console.error("[GET /api/patients/[id]]", error);
    return NextResponse.json({ error: "Failed to fetch patient" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...body,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : undefined,
      },
    });

    return NextResponse.json(patient);
  } catch (error) {
    console.error("[PATCH /api/patients/[id]]", error);
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.patient.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/patients/[id]]", error);
    return NextResponse.json({ error: "Failed to deactivate patient" }, { status: 500 });
  }
}

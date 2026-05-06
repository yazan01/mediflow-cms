import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "15");
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const modality = searchParams.get("modality");

    const where: Record<string, unknown> = {
      ...(status && status !== "ALL" && { status }),
      ...(modality && modality !== "ALL" && { modality }),
      ...(search && {
        OR: [
          { patient: { firstName: { contains: search, mode: "insensitive" } } },
          { patient: { lastName: { contains: search, mode: "insensitive" } } },
          { patient: { mrn: { contains: search, mode: "insensitive" } } },
          { study: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.radiologyOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          orderedByDoctor: { include: { user: { select: { name: true } } } },
        },
      }),
      prisma.radiologyOrder.count({ where }),
    ]);

    const formatted = data.map((order) => ({
      id: order.id,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`,
      mrn: order.patient.mrn,
      modality: order.modality,
      study: order.study,
      bodyPart: order.bodyPart ?? "",
      priority: order.priority,
      orderedBy: order.orderedByDoctor?.user.name ?? "—",
      scheduledAt: order.scheduledAt,
      status: order.status,
      radiologist: null,
      date: order.createdAt,
    }));

    return NextResponse.json({ data: formatted, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/radiology]", error);
    return NextResponse.json({ error: "Failed to fetch radiology orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, consultationId, doctorId, modality, study, bodyPart, priority, clinicalInfo, scheduledAt } = body;

    if (!patientId || !doctorId || !modality || !study) {
      return NextResponse.json({ error: "Patient, doctor, modality, and study are required" }, { status: 400 });
    }

    const order = await prisma.radiologyOrder.create({
      data: {
        patientId,
        consultationId,
        orderedByDoctorId: doctorId,
        modality,
        study,
        bodyPart,
        priority: priority ?? "ROUTINE",
        clinicalInfo,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("[POST /api/radiology]", error);
    return NextResponse.json({ error: "Failed to create radiology order" }, { status: 500 });
  }
}

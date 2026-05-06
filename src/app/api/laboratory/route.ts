import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "15");
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    const where: Record<string, unknown> = {
      ...(status && status !== "ALL" && { status }),
      ...(priority && priority !== "ALL" && { priority }),
      ...(search && {
        OR: [
          { patient: { firstName: { contains: search, mode: "insensitive" } } },
          { patient: { lastName: { contains: search, mode: "insensitive" } } },
          { patient: { mrn: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.labOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          orderedByDoctor: { include: { user: { select: { name: true } } } },
          results: { select: { id: true, testName: true, value: true, unit: true, isCritical: true } },
        },
      }),
      prisma.labOrder.count({ where }),
    ]);

    const formatted = data.map((order) => ({
      id: order.id,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`,
      mrn: order.patient.mrn,
      tests: order.tests,
      status: order.status,
      priority: order.priority,
      orderedBy: order.orderedByDoctor?.user.name ?? "—",
      date: order.createdAt,
      results: order.results,
      specimenCollected: order.specimenCollected,
      notes: order.notes,
    }));

    return NextResponse.json({ data: formatted, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/laboratory]", error);
    return NextResponse.json({ error: "Failed to fetch lab orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, consultationId, doctorId, tests, priority, notes } = body;

    if (!patientId || !doctorId || !tests?.length) {
      return NextResponse.json({ error: "Patient, doctor, and tests are required" }, { status: 400 });
    }

    const order = await prisma.labOrder.create({
      data: {
        patientId,
        consultationId,
        orderedByDoctorId: doctorId,
        tests,
        priority: priority ?? "ROUTINE",
        notes,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("[POST /api/laboratory]", error);
    return NextResponse.json({ error: "Failed to create lab order" }, { status: 500 });
  }
}

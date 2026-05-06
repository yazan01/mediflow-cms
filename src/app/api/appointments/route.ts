import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50");
    const status = searchParams.get("status");
    const doctorId = searchParams.get("doctorId");
    const date = searchParams.get("date");
    const patientId = searchParams.get("patientId");

    let dateFilter: object | undefined;
    if (date === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { gte: today, lt: tomorrow };
    } else if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      dateFilter = { gte: d, lt: next };
    }

    const where = {
      ...(status && status !== "ALL" && { status: status as never }),
      ...(doctorId && doctorId !== "ALL" && { doctorId }),
      ...(patientId && { patientId }),
      ...(dateFilter && { scheduledAt: dateFilter }),
    };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          doctor: { include: { user: { select: { id: true, name: true } } } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    const data = appointments.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      patientName: `${a.patient.firstName} ${a.patient.lastName}`,
      mrn: a.patient.mrn,
      doctorId: a.doctorId,
      doctorName: a.doctor.user.name,
      specialization: a.doctor.specialization,
      scheduledAt: a.scheduledAt.toISOString(),
      scheduledEnd: a.scheduledEnd?.toISOString(),
      status: a.status,
      type: a.type,
      reason: a.reason,
      room: a.room,
      notes: a.notes,
      isUrgent: a.isUrgent,
      checkedInAt: a.checkedInAt,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("[GET /api/appointments]", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, doctorId, scheduledAt, scheduledEnd, type, reason, room, notes, isUrgent, isWalkIn } = body;

    if (!patientId || !doctorId || !scheduledAt) {
      return NextResponse.json({ error: "Patient, doctor, and scheduled time are required" }, { status: 400 });
    }

    const start = new Date(scheduledAt);
    const end = scheduledEnd ? new Date(scheduledEnd) : new Date(start.getTime() + 30 * 60 * 1000);

    // Double-booking check
    const conflicting = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { notIn: ["CANCELLED", "RESCHEDULED"] },
        AND: [
          { scheduledAt: { lt: end } },
          { OR: [{ scheduledEnd: null }, { scheduledEnd: { gt: start } }] },
        ],
      },
    });

    if (conflicting) {
      return NextResponse.json(
        { error: "This time slot is already booked for this doctor. Please choose another slot." },
        { status: 409 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        scheduledAt: start,
        scheduledEnd: end,
        type: type ?? "CONSULTATION",
        reason,
        room,
        notes,
        isUrgent: isUrgent ?? false,
        isWalkIn: isWalkIn ?? false,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
    });

    await prisma.patient.update({
      where: { id: patientId },
      data: { lastVisit: new Date() },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("[POST /api/appointments]", error);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      appointmentId,
      patientId,
      doctorId,
      chiefComplaint,
      subjective,
      objective,
      assessment,
      plan,
      hpi,
      pmh,
      examination,
      followUpDate,
      vitals,
      diagnoses,
      prescriptions,
    } = body;

    if (!appointmentId || !patientId || !doctorId) {
      return NextResponse.json(
        { error: "appointmentId, patientId, and doctorId are required" },
        { status: 400 }
      );
    }

    const consultation = await prisma.$transaction(async (tx) => {
      const newConsultation = await tx.consultation.create({
        data: {
          appointmentId,
          patientId,
          doctorId,
          chiefComplaint: chiefComplaint ?? null,
          subjective: subjective ?? null,
          objective: objective ?? null,
          assessment: assessment ?? null,
          plan: plan ?? null,
          hpi: hpi ?? null,
          pmh: pmh ?? null,
          examination: examination ?? null,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          ...(vitals && {
            vitals: {
              create: {
                bpSystolic: vitals.bpSystolic ? Number(vitals.bpSystolic) : null,
                bpDiastolic: vitals.bpDiastolic ? Number(vitals.bpDiastolic) : null,
                heartRate: vitals.heartRate ? Number(vitals.heartRate) : null,
                temperature: vitals.temperature ? Number(vitals.temperature) : null,
                weight: vitals.weight ? Number(vitals.weight) : null,
                height: vitals.height ? Number(vitals.height) : null,
                bmi: vitals.bmi ? Number(vitals.bmi) : null,
                spo2: vitals.spo2 ? Number(vitals.spo2) : null,
                bloodGlucose: vitals.bloodGlucose ? Number(vitals.bloodGlucose) : null,
                respiratoryRate: vitals.respiratoryRate ? Number(vitals.respiratoryRate) : null,
              },
            },
          }),
          ...(diagnoses && diagnoses.length > 0 && {
            diagnoses: {
              create: diagnoses.map((d: { icdCode: string; description: string; type: string }) => ({
                icdCode: d.icdCode,
                description: d.description,
                type: d.type,
              })),
            },
          }),
          ...(prescriptions && prescriptions.length > 0 && {
            prescriptions: {
              create: prescriptions.map((rx: {
                medicationName: string;
                dosage: string;
                frequency: string;
                duration: string;
                quantity?: number | string;
                instructions?: string;
              }) => ({
                medicationName: rx.medicationName,
                dosage: rx.dosage,
                frequency: rx.frequency,
                duration: rx.duration,
                quantity: rx.quantity ? Number(rx.quantity) : null,
                instructions: rx.instructions ?? null,
              })),
            },
          }),
        },
        include: {
          vitals: true,
          diagnoses: true,
          prescriptions: true,
          doctor: { include: { user: { select: { name: true } } } },
          appointment: { select: { scheduledAt: true, type: true } },
        },
      });

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: "IN_CONSULTATION" },
      });

      return newConsultation;
    });

    return NextResponse.json(consultation, { status: 201 });
  } catch (error) {
    console.error("[POST /api/consultations]", error);
    return NextResponse.json({ error: "Failed to create consultation" }, { status: 500 });
  }
}

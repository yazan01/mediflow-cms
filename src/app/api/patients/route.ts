import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMRN } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10");
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");

    const where = {
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { mrn: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { nationalId: { contains: search } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && status !== "ALL" && { isActive: status === "ACTIVE" }),
    };

    const [data, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, mrn: true, firstName: true, lastName: true,
          dateOfBirth: true, gender: true, phone: true, email: true,
          bloodType: true, allergies: true, chronicConditions: true,
          insuranceProvider: true, isActive: true, photo: true, lastVisit: true,
          nationality: true, nationalId: true,
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("[GET /api/patients]", error);
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, dateOfBirth, gender, nationality, nationalId,
      phone, email, address, bloodType, allergies, chronicConditions,
      emergencyContactName, emergencyContactPhone,
      insuranceProvider, insurancePolicyNo, insuranceCoverageType, insuranceExpiry,
      notes,
    } = body;

    if (!firstName || !lastName || !dateOfBirth || !gender || !phone) {
      return NextResponse.json({ error: "First name, last name, date of birth, gender, and phone are required" }, { status: 400 });
    }

    if (nationalId) {
      const existing = await prisma.patient.findFirst({ where: { nationalId } });
      if (existing) {
        return NextResponse.json({ error: "A patient with this national ID already exists" }, { status: 409 });
      }
    }

    const patient = await prisma.patient.create({
      data: {
        mrn: generateMRN(),
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        nationality,
        nationalId,
        phone,
        email,
        address,
        bloodType: bloodType || null,
        allergies: allergies ?? [],
        chronicConditions: chronicConditions ?? [],
        emergencyContactName,
        emergencyContactPhone,
        insuranceProvider,
        insurancePolicyNo,
        insuranceCoverageType,
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        notes,
      },
    });

    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    console.error("[POST /api/patients]", error);
    return NextResponse.json({ error: "Failed to register patient" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const specialization = searchParams.get("specialization");

    const where: Record<string, unknown> = {
      user: { isActive: true },
      ...(specialization && { specialization }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { specialization: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const data = await prisma.doctor.findMany({
      where,
      orderBy: { user: { name: "asc" } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/doctors]", error);
    return NextResponse.json({ error: "Failed to fetch doctors" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET ──────────────────────────────────────────────────────────────────────
// Query params:
//   month  – "YYYY-MM"  (defaults to current month when omitted)
//   search – employee name substring (optional)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");
    const search = searchParams.get("search") ?? "";

    // Parse "YYYY-MM" or fall back to current month
    let year: number;
    let month: number; // 1-based

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split("-").map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    // Inclusive date range for the calendar month
    const startDate = new Date(year, month - 1, 1);  // first day 00:00
    const endDate = new Date(year, month, 0);         // last day 00:00 (day 0 of next month)

    // Build the Prisma where clause for attendance records in the date range,
    // optionally filtering by employee name via a relation filter.
    const where = {
      date: { gte: startDate, lte: endDate },
      ...(search
        ? {
            employee: {
              user: { name: { contains: search, mode: "insensitive" as const } },
            },
          }
        : {}),
    };

    const records = await prisma.attendance.findMany({
      where,
      orderBy: [{ employeeId: "asc" }, { date: "asc" }],
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    // Group by employeeId → { employeeName, days: { "YYYY-MM-DD": status } }
    const map = new Map<
      string,
      { employeeName: string; days: Record<string, string> }
    >();

    for (const rec of records) {
      const dateKey = new Date(rec.date).toISOString().slice(0, 10);
      const employeeName = rec.employee.user.name;

      if (!map.has(rec.employeeId)) {
        map.set(rec.employeeId, { employeeName, days: {} });
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      map.get(rec.employeeId)!.days[dateKey] = rec.status;
    }

    const data = Array.from(map.entries()).map(([employeeId, value]) => ({
      employeeId,
      employeeName: value.employeeName,
      days: value.days,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/hr/attendance]", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance records" },
      { status: 500 }
    );
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Body: { employeeId, date, status, checkIn?, checkOut?, notes? }
// Creates or updates the unique (employeeId, date) attendance record.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, date, status, checkIn, checkOut, notes } = body;

    if (!employeeId || !date || !status) {
      return NextResponse.json(
        { error: "employeeId, date, and status are required" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 (e.g. 2025-05-06)" },
        { status: 400 }
      );
    }

    const record = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: parsedDate,
        },
      },
      create: {
        employeeId,
        date: parsedDate,
        status,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        notes: notes ?? null,
        isManual: true,
      },
      update: {
        status,
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        notes: notes ?? undefined,
        isManual: true,
      },
    });

    return NextResponse.json({ data: record }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/hr/attendance]", error);
    return NextResponse.json(
      { error: "Failed to save attendance record" },
      { status: 500 }
    );
  }
}

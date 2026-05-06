import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { ...(status && status !== "ALL" && { status: status as never }) },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { employee: { include: { user: { select: { name: true } } } } },
      }),
      prisma.leaveRequest.count({ where: { ...(status && status !== "ALL" && { status: status as never }) } }),
    ]);

    return NextResponse.json({ data, total });
  } catch (error) {
    console.error("[GET /api/hr/leaves]", error);
    return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, type, startDate, endDate, days, reason } = body;

    if (!employeeId || !type || !startDate || !endDate) {
      return NextResponse.json({ error: "Employee, type, start date, and end date are required" }, { status: 400 });
    }

    const leave = await prisma.leaveRequest.create({
      data: { employeeId, type, startDate: new Date(startDate), endDate: new Date(endDate), days: days ?? 1, reason },
    });

    return NextResponse.json(leave, { status: 201 });
  } catch (error) {
    console.error("[POST /api/hr/leaves]", error);
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 });
  }
}

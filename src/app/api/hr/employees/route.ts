import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const department = searchParams.get("department");

    const where = {
      ...(search && {
        user: {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        },
      }),
      ...(status && status !== "ALL" && { status: status as never }),
      ...(department && department !== "ALL" && { departmentId: department }),
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { empCode: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { name: true, email: true, phone: true, photo: true, isActive: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({ data: employees, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/hr/employees]", error);
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

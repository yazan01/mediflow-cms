import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    const [data, total] = await Promise.all([
      prisma.payroll.findMany({
        where: { month, year },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          employee: {
            include: {
              user: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
      }),
      prisma.payroll.count({ where: { month, year } }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/hr/payroll]", error);
    return NextResponse.json({ error: "Failed to fetch payroll" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, month, year, basicSalary, allowances, deductions, bonus, notes } = body;

    if (!employeeId || !month || !year || basicSalary === undefined) {
      return NextResponse.json({ error: "Employee, month, year, and basic salary are required" }, { status: 400 });
    }

    const gross = Number(basicSalary) + Number(allowances ?? 0) + Number(bonus ?? 0);
    const net = gross - Number(deductions ?? 0);

    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        month,
        year,
        basicSalary: Number(basicSalary),
        allowances: Number(allowances ?? 0),
        deductions: Number(deductions ?? 0),
        bonus: Number(bonus ?? 0),
        grossSalary: gross,
        netSalary: net,
        notes,
        processedById: "system",
      },
    });

    return NextResponse.json(payroll, { status: 201 });
  } catch (error) {
    console.error("[POST /api/hr/payroll]", error);
    return NextResponse.json({ error: "Failed to create payroll record" }, { status: 500 });
  }
}

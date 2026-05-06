import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const category = searchParams.get("category");
    const search = searchParams.get("search") ?? "";

    const where: Record<string, unknown> = {
      ...(category && category !== "ALL" && { category }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          vendor: { select: { id: true, name: true } },
          approvedBy: { select: { name: true } },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/accounting/expenses]", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, description, amount, date, vendorId, paymentMethod, referenceNo, notes } = body;

    if (!category || !description || !amount || !date) {
      return NextResponse.json({ error: "Category, description, amount, and date are required" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        category,
        description,
        amount: parseFloat(amount),
        date: new Date(date),
        vendorId,
        paymentMethod: paymentMethod ?? "CASH",
        referenceNo,
        notes,
        recordedById: "system",
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("[POST /api/accounting/expenses]", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

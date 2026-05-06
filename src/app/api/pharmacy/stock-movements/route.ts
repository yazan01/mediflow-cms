import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const medicationId = searchParams.get("medicationId");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    const where: Record<string, unknown> = {
      ...(medicationId && { medicationId }),
      ...(type && type !== "ALL" && { type }),
    };

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          medication: { select: { id: true, genericName: true, brandName: true } },
          performedBy: { select: { name: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/pharmacy/stock-movements]", error);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { medicationId, type, quantity, reason, referenceId, notes } = body;

    if (!medicationId || !type || !quantity) {
      return NextResponse.json({ error: "Medication, type, and quantity are required" }, { status: 400 });
    }

    const medication = await prisma.medication.findUnique({ where: { id: medicationId } });
    if (!medication) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    }

    const isInbound = ["PURCHASE", "RETURN_FROM_PATIENT", "ADJUSTMENT_IN"].includes(type);
    const newQty = isInbound
      ? medication.stockQuantity + Number(quantity)
      : medication.stockQuantity - Number(quantity);

    if (!isInbound && newQty < 0) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 422 });
    }

    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          medicationId,
          type,
          quantity: Number(quantity),
          previousQty: medication.stockQuantity,
          newQty,
          reason,
          referenceId,
          notes,
          performedById: "system",
        },
      }),
      prisma.medication.update({
        where: { id: medicationId },
        data: { stockQuantity: newQty },
      }),
    ]);

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error("[POST /api/pharmacy/stock-movements]", error);
    return NextResponse.json({ error: "Failed to record stock movement" }, { status: 500 });
  }
}

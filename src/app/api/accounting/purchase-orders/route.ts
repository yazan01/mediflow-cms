import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePONumber } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10");
    const status = searchParams.get("status");

    const where = { ...(status && status !== "ALL" && { status: status as never }) };

    const [data, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          vendor: { select: { id: true, name: true } },
          items: { select: { id: true, itemName: true, quantity: true, receivedQty: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/accounting/purchase-orders]", error);
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId, items, expectedDelivery, notes } = body;

    if (!vendorId || !items?.length) {
      return NextResponse.json({ error: "Vendor and items are required" }, { status: 400 });
    }

    const subtotal = items.reduce((s: number, i: { quantity: number; unitPrice: number }) => s + i.quantity * i.unitPrice, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: generatePONumber(),
        vendorId,
        date: new Date(),
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
        subtotal,
        totalAmount: subtotal,
        notes,
        requestedById: "system",
        items: {
          create: items.map((i: { medicationId?: string; itemName: string; quantity: number; unitPrice: number }) => ({
            medicationId: i.medicationId,
            itemName: i.itemName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
          })),
        },
      },
      include: { vendor: true, items: true },
    });

    return NextResponse.json(po, { status: 201 });
  } catch (error) {
    console.error("[POST /api/accounting/purchase-orders]", error);
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}

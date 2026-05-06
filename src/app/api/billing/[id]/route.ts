import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[GET /api/billing/[id]]", error);
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const invoice = await prisma.invoice.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[PATCH /api/billing/[id]]", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

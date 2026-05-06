import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { amount, method, referenceNo, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const payableAmount = Math.min(amount, Number(invoice.balance));

    const payment = await prisma.payment.create({
      data: {
        invoiceId: id,
        amount: payableAmount,
        method: method ?? "CASH",
        referenceNo,
        notes,
        paidAt: new Date(),
        recordedById: "system",
      },
    });

    const newPaidAmount = Number(invoice.paidAmount) + payableAmount;
    const newBalance = Number(invoice.totalAmount) - newPaidAmount;
    const newStatus = newBalance <= 0 ? "PAID" : newPaidAmount > 0 ? "PARTIAL" : invoice.status;

    await prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("[POST /api/billing/[id]/payments]", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}

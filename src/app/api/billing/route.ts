import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNo } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10");
    const status = searchParams.get("status");
    const search = searchParams.get("search") ?? "";

    const where = {
      ...(status && status !== "ALL" && { status: status as never }),
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: "insensitive" as const } },
          { patient: { firstName: { contains: search, mode: "insensitive" as const } } },
          { patient: { lastName: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          items: true,
          payments: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    const data = invoices.map((inv) => ({
      ...inv,
      patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/billing]", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, appointmentId, items, discountAmount, discountRate, taxRate, notes, insuranceClaim, insuranceProvider, insurancePolicyNo } = body;

    if (!patientId || !items || items.length === 0) {
      return NextResponse.json({ error: "Patient and at least one item are required" }, { status: 400 });
    }

    const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
      sum + item.quantity * item.unitPrice, 0);
    const discount = discountAmount ?? (discountRate ? subtotal * (discountRate / 100) : 0);
    const afterDiscount = subtotal - discount;
    const tax = taxRate ? afterDiscount * (taxRate / 100) : 0;
    const total = afterDiscount + tax;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: generateInvoiceNo(),
        patientId,
        appointmentId,
        subtotal,
        discountAmount: discount,
        discountRate,
        taxAmount: tax,
        taxRate,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        status: "PENDING",
        insuranceClaim: insuranceClaim ?? false,
        insuranceProvider,
        insurancePolicyNo,
        notes,
        items: {
          create: items.map((item: { description: string; category?: string; quantity: number; unitPrice: number; discount?: number; serviceCode?: string }) => ({
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0,
            totalPrice: item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100),
            serviceCode: item.serviceCode,
          })),
        },
      },
      include: {
        items: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("[POST /api/billing]", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

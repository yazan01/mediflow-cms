import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      revenueResult,
      expensesResult,
      receivableResult,
      payableResult,
    ] = await Promise.allSettled([
      // Total revenue: sum of paidAmount on PAID or PARTIAL invoices
      prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: { status: { in: ["PAID", "PARTIAL"] } },
      }),

      // Total expenses: sum of amount on APPROVED expenses
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { status: "APPROVED" },
      }),

      // Accounts receivable: sum of balance on PENDING / PARTIAL / OVERDUE invoices
      prisma.invoice.aggregate({
        _sum: { balance: true },
        where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      }),

      // Accounts payable: sum of totalAmount on APPROVED or PARTIALLY_RECEIVED purchase orders
      prisma.purchaseOrder.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] } },
      }),
    ]);

    const totalRevenue =
      revenueResult.status === "fulfilled"
        ? Number(revenueResult.value._sum.paidAmount ?? 0)
        : 0;

    const totalExpenses =
      expensesResult.status === "fulfilled"
        ? Number(expensesResult.value._sum.amount ?? 0)
        : 0;

    const netProfit = totalRevenue - totalExpenses;

    const accountsReceivable =
      receivableResult.status === "fulfilled"
        ? Number(receivableResult.value._sum.balance ?? 0)
        : 0;

    const accountsPayable =
      payableResult.status === "fulfilled"
        ? Number(payableResult.value._sum.totalAmount ?? 0)
        : 0;

    return NextResponse.json({
      data: {
        totalRevenue,
        totalExpenses,
        netProfit,
        accountsReceivable,
        accountsPayable,
      },
    });
  } catch (error) {
    console.error("[GET /api/accounting/overview]", error);
    return NextResponse.json(
      { error: "Failed to fetch accounting overview" },
      { status: 500 }
    );
  }
}

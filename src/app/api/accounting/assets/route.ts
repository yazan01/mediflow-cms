import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search") ?? "";

    const where: Record<string, unknown> = {
      ...(status && status !== "ALL" && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { assetCode: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          department: { select: { id: true, name: true } },
          maintenanceLogs: { orderBy: { scheduledDate: "desc" }, take: 1 },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/accounting/assets]", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, assetCode, category, departmentId, purchaseDate, purchasePrice, currentValue, location, serialNumber, warrantyExpiry, notes } = body;

    if (!name || !assetCode || !category) {
      return NextResponse.json({ error: "Name, asset code, and category are required" }, { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: {
        name,
        assetCode,
        category,
        departmentId,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        currentValue: currentValue ? parseFloat(currentValue) : null,
        location,
        serialNumber,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        notes,
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("[POST /api/accounting/assets]", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

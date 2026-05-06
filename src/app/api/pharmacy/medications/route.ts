import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const where = {
      isActive: true,
      ...(search && {
        OR: [
          { genericName: { contains: search, mode: "insensitive" as const } },
          { brandName: { contains: search, mode: "insensitive" as const } },
          { barcode: { contains: search } },
          { category: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(category && category !== "ALL" && { category }),
    };

    const [medications, total, totalSku, outOfStock] = await Promise.all([
      prisma.medication.findMany({
        where,
        orderBy: { genericName: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          batches: { orderBy: { expiryDate: "asc" }, take: 1 },
        },
      }),
      prisma.medication.count({ where }),
      prisma.medication.count({ where: { isActive: true } }),
      prisma.medication.count({ where: { isActive: true, stockQuantity: 0 } }),
    ]);

    const data = medications.map((med) => {
      let stockStatus: string;
      if (med.stockQuantity <= 0) stockStatus = "OUT_OF_STOCK";
      else if (med.stockQuantity <= Math.floor(med.minStockLevel * 0.5)) stockStatus = "CRITICAL";
      else if (med.stockQuantity <= med.minStockLevel) stockStatus = "LOW_STOCK";
      else stockStatus = "IN_STOCK";

      const nearestExpiry = med.batches[0]?.expiryDate ?? null;
      return { ...med, stockStatus, nearestExpiry };
    }).filter((m) => !status || status === "ALL" || m.stockStatus === status);

    return NextResponse.json({
      data, total, page, pageSize,
      stats: { totalSku, outOfStock },
    });
  } catch (error) {
    console.error("[GET /api/pharmacy/medications]", error);
    return NextResponse.json({ error: "Failed to fetch medications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { genericName, brandName, category, unit, barcode, minStockLevel, reorderLevel, unitCost, sellingPrice, location, isControlled, requiresPrescription, notes } = body;

    if (!genericName || !category || !unit) {
      return NextResponse.json({ error: "Generic name, category, and unit are required" }, { status: 400 });
    }

    const medication = await prisma.medication.create({
      data: {
        genericName,
        brandName,
        category,
        unit,
        barcode,
        stockQuantity: 0,
        minStockLevel: minStockLevel ?? 0,
        reorderLevel: reorderLevel ?? 0,
        unitCost: unitCost ?? 0,
        sellingPrice: sellingPrice ?? 0,
        location,
        isControlled: isControlled ?? false,
        requiresPrescription: requiresPrescription ?? true,
        notes,
      },
    });

    return NextResponse.json(medication, { status: 201 });
  } catch (error) {
    console.error("[POST /api/pharmacy/medications]", error);
    return NextResponse.json({ error: "Failed to add medication" }, { status: 500 });
  }
}

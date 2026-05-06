import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const search = searchParams.get("search") ?? "";
    const module = searchParams.get("module");

    const where: Record<string, unknown> = {
      ...(module && module !== "ALL" && { module }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { action: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formatted = data.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      userName: log.user?.name ?? "System",
      userEmail: log.user?.email ?? "",
      module: log.module,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      oldValues: log.oldValues,
      newValues: log.newValues,
    }));

    return NextResponse.json({ data: formatted, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/audit]", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}

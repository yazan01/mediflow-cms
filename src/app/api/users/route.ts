import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateEmpCode } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10");
    const search = searchParams.get("search") ?? "";
    const role = searchParams.get("role");

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }),
    };

    const [allData, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { department: { select: { id: true, name: true } } },
        omit: { passwordHash: true, twoFASecret: true },
      }),
      prisma.user.count({ where }),
    ]);

    // Filter by role in JS (JSON field — MySQL doesn't support Prisma array filters)
    const filtered = role && role !== "ALL"
      ? allData.filter((u) => (u.roles as string[]).includes(role))
      : allData;
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/users]", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, roles, password, departmentId } = await req.json();

    if (!name || !email || !password || !roles?.length) {
      return NextResponse.json({ error: "Name, email, password, and at least one role are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        roles,
        passwordHash,
        departmentId,
        isActive: true,
      },
    });
    const user = { ...created, passwordHash: undefined, twoFASecret: undefined };

    // Auto-create Employee record for staff roles
    const staffRoles = ["DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "RADIOLOGIST", "ACCOUNTANT", "HR_OFFICER"];
    if (roles.some((r: string) => staffRoles.includes(r)) && departmentId) {
      await prisma.employee.create({
        data: {
          empCode: generateEmpCode(),
          userId: user.id,
          departmentId,
          jobTitle: roles[0],
          basicSalary: 0,
          hireDate: new Date(),
        },
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("[POST /api/users]", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

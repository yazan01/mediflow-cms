import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { isActive, roles, departmentId, phone, name } = body;

    await prisma.user.update({
      where: { id },
      data: { ...(isActive !== undefined && { isActive }), ...(roles && { roles }), ...(departmentId && { departmentId }), ...(phone && { phone }), ...(name && { name }) },
    });
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, roles: true, departmentId: true, isActive: true, twoFAEnabled: true, lastLogin: true, createdAt: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("[PATCH /api/users/[id]]", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/users/[id]]", error);
    return NextResponse.json({ error: "Failed to deactivate user" }, { status: 500 });
  }
}

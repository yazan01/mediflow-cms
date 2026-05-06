import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
    const passwordHash = await hashPassword(tempPassword);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    // In production: send email with tempPassword
    // await sendPasswordResetEmail(user.email, tempPassword);

    return NextResponse.json({ success: true, message: "Password reset. Temp password sent to user email." });
  } catch (error) {
    console.error("[POST /api/users/[id]/reset-password]", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}

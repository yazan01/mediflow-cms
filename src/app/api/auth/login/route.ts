import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "mediflow-jwt-secret-change-in-production";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is deactivated. Please contact your administrator." }, { status: 403 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account is locked. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      const failedLogins = user.failedLogins + 1;
      const updateData: Record<string, unknown> = { failedLogins };
      if (failedLogins >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        updateData.failedLogins = 0;
      }
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLogin: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        module: "AUTH",
        ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
      },
    });

    if (user.twoFAEnabled) {
      return NextResponse.json({ requires2FA: true, userId: user.id });
    }

    const token = jwt.sign(
      { sub: user.id, name: user.name, email: user.email, roles: user.roles },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, roles: user.roles },
    });

    response.cookies.set("mediflow_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";

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

    // Check account lockout
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

      // Lock after 5 failed attempts for 15 minutes
      if (failedLogins >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        updateData.lockedUntil = lockUntil;
        updateData.failedLogins = 0;
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });

      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Reset failed logins on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLogin: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        module: "AUTH",
        ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
      },
    });

    if (user.twoFAEnabled) {
      // In production: generate and send OTP via SMS
      return NextResponse.json({ requires2FA: true, userId: user.id });
    }

    // Create session token (simplified — use NextAuth in production)
    const token = `session_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
      },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        photo: user.photo,
      },
    });

    response.cookies.set("cms_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

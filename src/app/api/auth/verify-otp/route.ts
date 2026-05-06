import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionToken, otp } = body;

    if (!sessionToken || !otp) {
      return NextResponse.json({ error: "Session token and OTP are required" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    if (!session.user.twoFAEnabled) {
      return NextResponse.json({ success: true });
    }

    // In production, validate TOTP using a library like 'otpauth' or 'speakeasy'
    // For now, accept any 6-digit code in development
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Invalid OTP format" }, { status: 401 });
    }

    // Mark session as 2FA verified
    await prisma.session.update({
      where: { id: session.id },
      data: { twoFAVerified: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/auth/verify-otp]", error);
    return NextResponse.json({ error: "OTP verification failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/verify-otp",
  "/api/auth/2fa/verify",
  "/api/auth/csrf",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/fonts") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("mediflow_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const encoder = new TextEncoder();
    await jose.jwtVerify(token, encoder.encode(secret));

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear the invalid cookie
    response.cookies.delete("mediflow_token");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login).*)",
  ],
};

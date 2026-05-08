import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const PUBLIC_PATHS = [
  "/login",
  "/unauthorized",
  "/api/auth/login",
  "/api/auth/verify-otp",
  "/api/auth/2fa/verify",
  "/api/auth/csrf",
];

// Route prefix → at least one of these roles is required
// Paths not listed here are accessible by all authenticated users
const ROUTE_ROLES: Record<string, string[]> = {
  "/billing":    ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "RECEPTIONIST"],
  "/hr":         ["HR_OFFICER", "SUPER_ADMIN", "CLINIC_MANAGER"],
  "/accounting": ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER"],
  "/users":      ["SUPER_ADMIN", "CLINIC_MANAGER"],
  "/settings":   ["SUPER_ADMIN", "CLINIC_MANAGER"],
  "/audit":      ["SUPER_ADMIN", "CLINIC_MANAGER", "AUDITOR"],
  "/reports":    ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "AUDITOR", "DOCTOR"],
  "/pharmacy":   ["PHARMACIST", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "RECEPTIONIST"],
  "/laboratory": ["LAB_TECHNICIAN", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE"],
  "/radiology":  ["RADIOLOGIST", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without auth
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
    const { payload } = await jose.jwtVerify(token, encoder.encode(secret));

    // Extract roles from JWT payload
    const userRoles: string[] = Array.isArray(payload.roles)
      ? (payload.roles as string[])
      : [];

    // Check route-level RBAC
    for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
      if (pathname.startsWith(routePrefix)) {
        const hasAccess = userRoles.some((r) => allowedRoles.includes(r));
        if (!hasAccess) {
          const deniedUrl = new URL("/unauthorized", request.url);
          deniedUrl.searchParams.set("from", pathname);
          return NextResponse.redirect(deniedUrl);
        }
        break;
      }
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("mediflow_token");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login).*)",
  ],
};

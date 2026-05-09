import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: only meaningful over HTTPS — skip in local dev to avoid breaking HTTP
  ...(!isDev
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-eval is required by Next.js HMR in development only
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      // Fonts are self-hosted via @fontsource + material-symbols npm — no CDN needed
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

// Print pages are intentionally loaded in a same-origin iframe by printDocument()
const printHeaders = securityHeaders
  .filter((h) => h.key !== "X-Frame-Options")
  .map((h) =>
    h.key === "Content-Security-Policy"
      ? { ...h, value: h.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") }
      : h
  );

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Print routes must allow same-origin iframing
      {
        source: "/print/(.*)",
        headers: printHeaders,
      },
      // All other routes keep the strict security headers
      {
        source: "/((?!print).*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

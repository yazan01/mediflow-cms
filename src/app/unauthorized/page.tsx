"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#faf9fd" }}>
      <div className="text-center max-w-md px-6">
        <div
          className="mx-auto mb-6 flex items-center justify-center rounded-full"
          style={{ width: 80, height: 80, background: "#ffdad6" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: "#ba1a1a" }}>
            lock
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1c1e" }}>
          Access Denied
        </h1>
        <p className="mb-1" style={{ color: "#74777f" }}>
          You don&apos;t have permission to access this page.
        </p>
        <p className="text-sm mb-8" style={{ color: "#74777f" }}>
          Contact your administrator if you believe this is a mistake.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push("/")}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Go Back
          </button>
        </div>

        {from && from !== "/" && (
          <p className="mt-6 text-xs" style={{ color: "#74777f" }}>
            Attempted path: <code style={{ color: "#1960a3" }}>{from}</code>
          </p>
        )}
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense>
      <UnauthorizedContent />
    </Suspense>
  );
}

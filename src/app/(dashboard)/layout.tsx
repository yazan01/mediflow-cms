import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as jwt from "jsonwebtoken";
import DashboardShell from "@/components/layout/DashboardShell";
import { TimezoneProvider } from "@/lib/TimezoneContext";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  let user = { name: "User", role: "STAFF", roles: ["STAFF"] as string[] };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("mediflow_token")?.value;
    if (!token) {
      redirect("/login");
    }
    const decoded = jwt.verify(token, JWT_SECRET) as { name?: string; roles?: string[] };
    const roles = decoded.roles ?? ["STAFF"];
    user = {
      name: decoded.name ?? "User",
      role: (roles[0] ?? "STAFF").replace(/_/g, " "),
      roles,
    };
  } catch {
    redirect("/login");
  }

  return (
    <TimezoneProvider>
      <DashboardShell user={user}>{children}</DashboardShell>
    </TimezoneProvider>
  );
}

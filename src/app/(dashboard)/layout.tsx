import { cookies } from "next/headers";
import * as jwt from "jsonwebtoken";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

const JWT_SECRET = process.env.JWT_SECRET ?? "mediflow-jwt-secret-change-in-production";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user = { name: "Admin User", role: "SUPER ADMIN" };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("mediflow_token")?.value;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { name?: string; roles?: string[] };
      user = {
        name: decoded.name ?? "User",
        role: (decoded.roles?.[0] ?? "STAFF").replace(/_/g, " "),
      };
    }
  } catch {
    // Token invalid or missing — show default, login page handles auth
  }

  return (
    <div className="flex h-screen bg-[#faf9fd] overflow-hidden">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

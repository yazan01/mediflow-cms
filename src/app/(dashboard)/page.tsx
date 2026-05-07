import { cookies } from "next/headers";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  let stats = null;
  let appointments = [];
  const activities: never[] = [];

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("mediflow_token")?.value;
    const cookieHeader = token ? `mediflow_token=${token}` : "";

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const headers: HeadersInit = cookieHeader ? { Cookie: cookieHeader } : {};

    const [statsRes, apptRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/dashboard/stats`, { cache: "no-store", headers }),
      fetch(`${baseUrl}/api/appointments?date=today&limit=6`, { cache: "no-store", headers }),
    ]);

    if (statsRes.status === "fulfilled" && statsRes.value.ok) {
      stats = await statsRes.value.json();
    }
    if (apptRes.status === "fulfilled" && apptRes.value.ok) {
      const data = await apptRes.value.json();
      appointments = data.data ?? [];
    }
  } catch {
    // Will show empty state
  }

  return <DashboardClient stats={stats} appointments={appointments} activities={activities} />;
}

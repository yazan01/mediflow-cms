import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  // Server component: fetch real stats from API/DB
  let stats = null;
  let appointments = [];
  const activities: never[] = [];

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const [statsRes, apptRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/dashboard/stats`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/appointments?date=today&limit=6`, { cache: "no-store" }),
    ]);

    if (statsRes.status === "fulfilled" && statsRes.value.ok) {
      stats = await statsRes.value.json();
    }
    if (apptRes.status === "fulfilled" && apptRes.value.ok) {
      const data = await apptRes.value.json();
      appointments = data.data ?? [];
    }
  } catch {
    // Will show empty state; DB not yet configured
  }

  return <DashboardClient stats={stats} appointments={appointments} activities={activities} />;
}

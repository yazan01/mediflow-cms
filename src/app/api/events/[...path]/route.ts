import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("mediflow_token");

  const upstream = await fetch(`${BACKEND_URL}/api/events/${path.join("/")}`, {
    headers: {
      Cookie: token ? `mediflow_token=${token.value}` : "",
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

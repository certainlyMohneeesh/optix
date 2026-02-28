// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: GET /api/ws-token
//  Returns the Upstox WebSocket authorized URL so the frontend can connect
//  without exposing the access_token directly.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUpstoxWsUrl } from "@/lib/upstox";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  // Prefer env var, then http-only cookie (set by OAuth callback)
  const cookieStore = await cookies();
  const accessToken =
    process.env.UPSTOX_ACCESS_TOKEN ||
    cookieStore.get("upstox_access_token")?.value ||
    "";

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const wsUrl = await getUpstoxWsUrl(accessToken);
    return NextResponse.json({ wsUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: GET /api/expiries/upstox?symbol=NIFTY
//  Returns live expiry dates from Upstox /v2/option/contract
//  Falls back to locally computed expiries when not authenticated
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { fetchUpstoxExpiries } from "@/lib/upstox";
import { EXPIRIES } from "@/lib/mock-data";
import { cookies } from "next/headers";
import type { Symbol } from "@/lib/types";

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "NIFTY") as Symbol;

  const cookieStore = await cookies();
  const accessToken =
    process.env.UPSTOX_ACCESS_TOKEN ||
    cookieStore.get("upstox_access_token")?.value ||
    "";

  if (!accessToken) {
    return NextResponse.json({ expiries: EXPIRIES[symbol], source: "computed" });
  }

  try {
    const expiries = await fetchUpstoxExpiries(symbol, accessToken);
    if (!expiries.length) {
      return NextResponse.json({ expiries: EXPIRIES[symbol], source: "computed" });
    }
    return NextResponse.json({ expiries, source: "upstox" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[expiries route]", message);
    return NextResponse.json({ expiries: EXPIRIES[symbol], source: "computed" });
  }
}

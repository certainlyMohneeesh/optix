// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: GET /api/expiries/zerodha?symbol=NIFTY
//  Returns live expiry dates from Kite instruments CSV
//  Falls back to locally computed expiries when not authenticated
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { fetchZerodhaExpiries } from "@/lib/zerodha";
import { EXPIRIES } from "@/lib/mock-data";
import { cookies } from "next/headers";
import type { Symbol } from "@/lib/types";

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "NIFTY") as Symbol;

  const cookieStore = await cookies();
  const apiKey      = process.env.ZERODHA_API_KEY ?? "";
  const envToken    = process.env.ZERODHA_ACCESS_TOKEN ?? "";
  const cookieToken = cookieStore.get("zerodha_access_token")?.value ?? "";
  const accessToken = envToken || cookieToken;

  console.log(`[zerodha expiries] apiKey=${!!apiKey}, token source: ${envToken ? "env" : cookieToken ? "cookie" : "none"}, symbol=${symbol}`);

  if (!apiKey || !accessToken) {
    console.log("[zerodha expiries] no credentials — returning computed expiries");
    return NextResponse.json({ expiries: EXPIRIES[symbol], source: "computed" });
  }

  try {
    const expiries = await fetchZerodhaExpiries(symbol, apiKey, accessToken);
    console.log(`[zerodha expiries] fetched ${expiries.length} expiries for ${symbol}`);
    if (!expiries.length) {
      return NextResponse.json({ expiries: EXPIRIES[symbol], source: "computed" });
    }
    return NextResponse.json({ expiries, source: "zerodha" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[zerodha expiries] error:", message);
    return NextResponse.json({ expiries: EXPIRIES[symbol], source: "computed" });
  }
}

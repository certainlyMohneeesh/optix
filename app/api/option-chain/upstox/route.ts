// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: GET /api/option-chain/upstox
//  Query params: symbol, expiry
//  Uses UPSTOX_ACCESS_TOKEN from env (set by user after OAuth)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { fetchUpstoxChain, fetchUpstoxSpot } from "@/lib/upstox";
import { buildMockChain, SPOT_BASE } from "@/lib/mock-data";
import { cookies } from "next/headers";
import type { Symbol } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol  = (searchParams.get("symbol") ?? "NIFTY") as Symbol;
  const expiry  = searchParams.get("expiry") ?? "";

  // Prefer env var, then http-only cookie (set by OAuth callback)
  const cookieStore = await cookies();
  const envToken    = process.env.UPSTOX_ACCESS_TOKEN || "";
  const cookieToken = cookieStore.get("upstox_access_token")?.value || "";
  const accessToken = envToken || cookieToken;
  console.log(`[upstox route] token source: ${envToken ? "env" : cookieToken ? "cookie" : "none"}, len=${accessToken.length}`);

  // ── Demo mode — no token configured ────────────────────────────────────────
  if (!accessToken) {
    const chain = buildMockChain(symbol);
    const spot  = SPOT_BASE[symbol];
    return NextResponse.json({ chain, spot, source: "mock" });
  }

  try {
    // fetchUpstoxChain now returns { chain, spot } — spot comes from underlying_spot_price
    // in the chain response, which is the most reliable source (no separate API call needed)
    const { chain, spot: chainSpot } = await fetchUpstoxChain(symbol, expiry, accessToken);
    // Fetch spot separately only if chain didn't provide it
    const spot = chainSpot > 0
      ? chainSpot
      : await fetchUpstoxSpot(symbol, accessToken);
    // If API returned empty chain (e.g. expiry not yet listed), fall back to mock
    if (!chain || chain.length === 0) {
      console.warn(`[upstox route] Empty chain for ${symbol} ${expiry} — using mock`);
      return NextResponse.json({ chain: buildMockChain(symbol), spot: spot || SPOT_BASE[symbol], source: "mock" });
    }
    return NextResponse.json({ chain, spot, source: "upstox" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[upstox route]", message);
    // Fallback to mock on error
    const chain = buildMockChain(symbol);
    const spot  = SPOT_BASE[symbol];
    return NextResponse.json(
      { chain, spot, source: "mock", error: message },
      { status: 200 } // still 200 so the frontend renders mock data
    );
  }
}

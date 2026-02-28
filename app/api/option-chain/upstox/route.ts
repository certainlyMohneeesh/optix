// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: GET /api/option-chain/upstox
//  Query params: symbol, expiry
//  Uses UPSTOX_ACCESS_TOKEN from env (set by user after OAuth)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { fetchUpstoxChain, fetchUpstoxSpot } from "@/lib/upstox";
import { buildMockChain, SPOT_BASE } from "@/lib/mock-data";
import type { Symbol } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol  = (searchParams.get("symbol") ?? "NIFTY") as Symbol;
  const expiry  = searchParams.get("expiry") ?? "";

  const accessToken = process.env.UPSTOX_ACCESS_TOKEN ?? "";

  // ── Demo mode — no token configured ────────────────────────────────────────
  if (!accessToken) {
    const chain = buildMockChain(symbol);
    const spot  = SPOT_BASE[symbol];
    return NextResponse.json({ chain, spot, source: "mock" });
  }

  try {
    const [chain, spot] = await Promise.all([
      fetchUpstoxChain(symbol, expiry, accessToken),
      fetchUpstoxSpot(symbol, accessToken),
    ]);
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

// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: GET /api/option-chain/zerodha
//  Query params: symbol, expiry
//  Uses ZERODHA_API_KEY + ZERODHA_ACCESS_TOKEN from env
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { fetchZerodhaChain, fetchZerodhaSpot } from "@/lib/zerodha";
import { buildMockChain, SPOT_BASE } from "@/lib/mock-data";
import type { Symbol } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = (searchParams.get("symbol") ?? "NIFTY") as Symbol;
  const expiry = searchParams.get("expiry") ?? "";

  const apiKey      = process.env.ZERODHA_API_KEY ?? "";
  const accessToken = process.env.ZERODHA_ACCESS_TOKEN ?? "";

  if (!apiKey || !accessToken) {
    const chain = buildMockChain(symbol);
    const spot  = SPOT_BASE[symbol];
    return NextResponse.json({ chain, spot, source: "mock" });
  }

  try {
    const [chain, spot] = await Promise.all([
      fetchZerodhaChain(symbol, expiry, apiKey, accessToken),
      fetchZerodhaSpot(symbol, apiKey, accessToken),
    ]);
    return NextResponse.json({ chain, spot, source: "zerodha" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[zerodha route]", message);
    const chain = buildMockChain(symbol);
    const spot  = SPOT_BASE[symbol];
    return NextResponse.json(
      { chain, spot, source: "mock", error: message },
      { status: 200 }
    );
  }
}

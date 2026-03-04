// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: GET /api/option-chain/zerodha
//  Query params: symbol, expiry
//  Uses ZERODHA_API_KEY + ZERODHA_ACCESS_TOKEN from env
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { fetchZerodhaChain, fetchZerodhaSpot } from "@/lib/zerodha";
import { buildMockChain, SPOT_BASE } from "@/lib/mock-data";
import { cookies } from "next/headers";
import type { Symbol } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = (searchParams.get("symbol") ?? "NIFTY") as Symbol;
  const expiry = searchParams.get("expiry") ?? "";

  // Prefer env var, then http-only cookie (set by Kite OAuth callback)
  const cookieStore  = await cookies();
  const apiKey       = process.env.ZERODHA_API_KEY ?? "";
  const envToken     = process.env.ZERODHA_ACCESS_TOKEN ?? "";
  const cookieToken  = cookieStore.get("zerodha_access_token")?.value ?? "";
  const accessToken  = envToken || cookieToken;
  console.log(`[zerodha route] token source: ${envToken ? "env" : cookieToken ? "cookie" : "none"}, len=${accessToken.length}, symbol=${symbol}, expiry=${expiry}`);

  if (!apiKey || !accessToken) {
    console.log(`[zerodha route] no credentials — returning mock data (apiKey=${!!apiKey}, token=${!!accessToken})`);
    const chain = buildMockChain(symbol);
    const spot  = SPOT_BASE[symbol];
    return NextResponse.json({ chain, spot, source: "mock" });
  }

  try {
    console.log(`[zerodha route] fetching chain from Kite API…`);
    const [chain, spot] = await Promise.all([
      fetchZerodhaChain(symbol, expiry, apiKey, accessToken),
      fetchZerodhaSpot(symbol, apiKey, accessToken),
    ]);
    console.log(`[zerodha route] chain rows=${chain.length}, spot=${spot}`);
    return NextResponse.json({ chain, spot, source: "zerodha" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[zerodha route] error:", message);
    const chain = buildMockChain(symbol);
    const spot  = SPOT_BASE[symbol];
    return NextResponse.json(
      { chain, spot, source: "mock", error: message },
      { status: 200 }
    );
  }
}

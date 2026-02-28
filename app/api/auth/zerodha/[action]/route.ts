// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: Zerodha Kite Connect OAuth  (GET /api/auth/zerodha/[action])
//
//  Flow:
//    1. GET /api/auth/zerodha/login    → redirect to Kite login
//    2. Kite → GET /api/auth/zerodha/callback → exchange request_token → session
//    3. Set access_token cookie → redirect to /
//
//  NOTE: Kite access_token expires at midnight IST every day.
//        You need to re-login daily or set up a cron to refresh.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";

const API_KEY    = process.env.ZERODHA_API_KEY    ?? "";
const API_SECRET = process.env.ZERODHA_API_SECRET ?? "";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;

  // ── Login redirect ──────────────────────────────────────────────────────────
  if (action === "login") {
    if (!API_KEY) {
      return NextResponse.json(
        { error: "ZERODHA_API_KEY not set in env" },
        { status: 500 }
      );
    }
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${API_KEY}`;
    return NextResponse.redirect(loginUrl);
  }

  // ── Callback — exchange request_token for access_token ─────────────────────
  if (action === "callback") {
    const requestToken = req.nextUrl.searchParams.get("request_token");
    if (!requestToken) {
      return NextResponse.json({ error: "No request_token" }, { status: 400 });
    }

    // Compute SHA-256(api_key + request_token + api_secret)
    const checksum = await sha256(`${API_KEY}${requestToken}${API_SECRET}`);

    const sessionRes = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: {
        "X-Kite-Version": "3",
        "Content-Type":   "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        api_key:       API_KEY,
        request_token: requestToken,
        checksum,
      }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const json = await sessionRes.json();
    const access_token: string = json?.data?.access_token;
    if (!access_token) {
      return NextResponse.json({ error: "No access_token in response" }, { status: 500 });
    }

    // Store as cookie and redirect to app
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set("zerodha_access_token", access_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      // Kite tokens expire at midnight IST — set max ~23h
      maxAge:   60 * 60 * 23,
      path:     "/",
    });
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
}

/** SHA-256 hex digest using Web Crypto (available in Edge + Node runtimes) */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(text);
  const hash    = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

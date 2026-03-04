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
      console.error("[zerodha auth] ZERODHA_API_KEY not set in env");
      return NextResponse.json(
        { error: "ZERODHA_API_KEY not set in env" },
        { status: 500 }
      );
    }
    console.log("[zerodha auth] redirecting to Kite Connect login");
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${API_KEY}`;
    return NextResponse.redirect(loginUrl);
  }

  // ── Callback — exchange request_token for access_token ─────────────────────
  if (action === "callback") {
    const requestToken = req.nextUrl.searchParams.get("request_token");
    if (!requestToken) {
      console.error("[zerodha auth] callback missing request_token");
      return NextResponse.json({ error: "No request_token" }, { status: 400 });
    }

    console.log("[zerodha auth] received request_token, computing checksum…");

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
      console.error("[zerodha auth] session exchange failed:", err);
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const json = await sessionRes.json();
    const access_token: string = json?.data?.access_token;
    if (!access_token) {
      console.error("[zerodha auth] no access_token in session response");
      return NextResponse.json({ error: "No access_token in response" }, { status: 500 });
    }

    console.log(`[zerodha auth] access_token obtained (len=${access_token.length}), pushing to ws-server…`);

    // Push fresh token + api_key to ws-server (fire-and-forget, non-blocking)
    // Encode as "api_key:access_token" so the WS server can split them
    const wsPort   = process.env.WS_PORT ?? "8765";
    const wsSecret = process.env.WS_INTERNAL_SECRET ?? "";
    fetch(`http://localhost:${wsPort}/token`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "X-Internal-Secret": wsSecret,
      },
      body: JSON.stringify({ access_token: `${API_KEY}:${access_token}`, broker: "zerodha" }),
    })
      .then((r) => console.log(`[zerodha auth] ws-server token push → ${r.status}`))
      .catch((e) => console.warn("[zerodha auth] ws-server token push failed:", e.message));

    // Store as cookie and redirect to app
    const appOrigin = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
    const res = NextResponse.redirect(new URL("/", appOrigin));
    res.cookies.set("zerodha_access_token", access_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      // Kite tokens expire at midnight IST — set max ~23h
      maxAge:   60 * 60 * 23,
      path:     "/",
    });
    console.log("[zerodha auth] cookie set, redirecting to /");
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

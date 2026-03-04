// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTE: Upstox OAuth callback  (GET /api/auth/upstox/callback)
//  + Login redirect trigger          (GET /api/auth/upstox/login)
//
//  Flow:
//    1. Frontend → GET /api/auth/upstox/login     → redirects to Upstox auth
//    2. Upstox   → GET /api/auth/upstox/callback  → exchanges code → token
//    3. Redirect → / with access_token in cookie
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID     = process.env.UPSTOX_CLIENT_ID     ?? "";
const CLIENT_SECRET = process.env.UPSTOX_CLIENT_SECRET ?? "";
const REDIRECT_URI  = process.env.UPSTOX_REDIRECT_URI  ??
  "http://localhost:3000/api/auth/upstox/callback";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;

  // ── /api/auth/upstox/login — redirect user to Upstox OAuth ─────────────────
  if (action === "login") {
    if (!CLIENT_ID) {
      return NextResponse.json(
        { error: "UPSTOX_CLIENT_ID not set in env" },
        { status: 500 }
      );
    }
    const authUrl =
      `https://api.upstox.com/v2/login/authorization/dialog` +
      `?response_type=code` +
      `&client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    return NextResponse.redirect(authUrl);
  }

  // ── /api/auth/upstox/callback — exchange code for access_token ─────────────
  if (action === "callback") {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "No code in callback" }, { status: 400 });
    }

    const tokenRes = await fetch(
      "https://api.upstox.com/v2/login/authorization/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri:  REDIRECT_URI,
          grant_type:    "authorization_code",
        }),
      }
    );

    if (!tokenRes.ok) {
      let upstoxError = "Token exchange failed";
      let hint = "";
      try {
        const errBody = await tokenRes.json();
        const first = errBody?.errors?.[0] ?? errBody;
        upstoxError = first?.message ?? JSON.stringify(errBody);
        const code = first?.errorCode ?? "";
        if (code === "UDAPI100058") {
          hint =
            "Your Upstox trading segments are deactivated.<br/>" +
            "Open the <strong>Upstox app → Profile → Segments</strong> and reactivate F&amp;O / Equity, then retry.";
        }
      } catch {
        upstoxError = await tokenRes.text().catch(() => "Unknown error");
      }
      const html = `<!DOCTYPE html><html><head><title>Upstox Auth Error</title>
<style>body{font-family:sans-serif;background:#0c0c0e;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:32px;max-width:480px;width:100%}
h2{color:#f87171;margin:0 0 8px}p{margin:8px 0;color:#a1a1aa}code{background:#27272a;padding:2px 6px;border-radius:4px;font-size:13px}
a{color:#60a5fa;text-decoration:none}a:hover{text-decoration:underline}</style></head>
<body><div class="box">
<h2>Upstox Authentication Error</h2>
<p><strong>${upstoxError}</strong></p>
${hint ? `<p style="color:#fbbf24">${hint}</p>` : ""}
<p style="margin-top:20px"><a href="/">← Back to OPTIX</a> &nbsp;|&nbsp; <a href="/api/auth/upstox/login">Try again</a></p>
</div></body></html>`;
      return new NextResponse(html, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const { access_token } = await tokenRes.json();

    // Push fresh token to the ws-server (fire-and-forget, non-blocking)
    const wsPort   = process.env.WS_PORT ?? "8765";
    const wsSecret = process.env.WS_INTERNAL_SECRET ?? "";
    fetch(`http://localhost:${wsPort}/token`, {
      method:  "POST",
      headers: {
        "Content-Type":     "application/json",
        "X-Internal-Secret": wsSecret,
      },
      body: JSON.stringify({ access_token, broker: "upstox" }),
    }).catch((e) => console.warn("[Auth] ws-server token push failed:", e.message));

    // Set in http-only cookie + redirect to app
    // Use NEXTAUTH_URL if set (production), otherwise fall back to req.url origin
    const appOrigin = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
    const res = NextResponse.redirect(new URL("/", appOrigin));
    res.cookies.set("upstox_access_token", access_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 23, // 23 hrs (Upstox tokens last ~24h)
      path:     "/",
    });
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
}

"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ExternalLink, Copy, Check, BookOpen, Zap, BarChart2,
  Settings, TrendingUp, Globe, Database, AlertTriangle,
  ChevronDown, ChevronRight, Info,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-[10.5px] text-green-400 overflow-x-auto font-mono leading-relaxed whitespace-pre">
        {code}
      </pre>
      <button
        className="absolute top-2 right-2 h-6 w-6 p-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded bg-zinc-800 hover:bg-zinc-700"
        onClick={copy}
      >
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-zinc-400" />}
      </button>
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  color = "text-zinc-800",
  badge,
  badgeColor = "bg-zinc-100 text-zinc-500 border-zinc-200",
  href,
  hrefLabel,
}: {
  icon: React.ElementType;
  title: string;
  color?: string;
  badge?: string;
  badgeColor?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <Icon className={`h-4 w-4 ${color}`} />
      <p className={`font-bold text-sm ${color}`}>{title}</p>
      {badge && (
        <Badge variant="outline" className={`text-[9px] ${badgeColor}`}>{badge}</Badge>
      )}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1"
        >
          {hrefLabel ?? href} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function Callout({ type, children }: { type: "tip" | "warn" | "info"; children: React.ReactNode }) {
  const styles = {
    tip:  "bg-green-500/5 border-green-500/30 text-green-700",
    warn: "bg-yellow-500/5 border-yellow-500/30 text-yellow-700",
    info: "bg-cyan-500/5 border-cyan-500/30 text-cyan-700",
  };
  const icons = { tip: "💡", warn: "⚠️", info: "ℹ️" };
  return (
    <div className={`flex gap-2 border rounded-lg px-3 py-2.5 text-xs leading-relaxed ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-zinc-50 hover:bg-zinc-100 text-left transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
        <span className="text-xs font-semibold text-zinc-700">{title}</span>
      </button>
      {open && <div className="px-4 py-3 space-y-3">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Static data
// ─────────────────────────────────────────────────────────────────────────────
const COMPARISON = [
  ["Cost",                  "FREE with Upstox account",          "₹2000/month subscription"],
  ["Option Chain API",      "Dedicated /v2/option/chain",         "Instruments CSV + Quotes (manual merge)"],
  ["Real-time WebSocket",   "Free (v3 binary/protobuf feed)",     "KiteTicker (paid, custom binary)"],
  ["Greeks in API",         "Yes — IV, Δ, Γ, Θ, ν",             "No — calculated by OPTIX via Black-Scholes"],
  ["Token expiry",          "~24 hours",                          "Midnight IST daily — must re-login"],
  ["Rate limits",           "1000 req/min",                       "3 req/sec"],
  ["Redirect URI",          "…/api/auth/upstox/callback",         "…/api/auth/zerodha/callback"],
  ["Docs",                  "developer.upstox.com",               "kite.trade/docs"],
];

const UPSTOX_ENV = `# .env.local  (create in opchain/ directory)
UPSTOX_CLIENT_ID=your_client_id
UPSTOX_CLIENT_SECRET=your_client_secret
UPSTOX_REDIRECT_URI=http://localhost:3000/api/auth/upstox/callback
# Optional: paste a manual token to skip OAuth every time
UPSTOX_ACCESS_TOKEN=`;

const UPSTOX_WS = `# Terminal 1 — WebSocket proxy (from repo root)
cd ws-server
npm install          # only first time
UPSTOX_ACCESS_TOKEN=<token> BROKER=upstox bun run index.ts

# Terminal 2 — Next.js dev server
cd opchain
bun run dev`;

const ZERODHA_ENV = `# .env.local  (create in opchain/ directory)
ZERODHA_API_KEY=kitexxxxxxxxxxx
ZERODHA_API_SECRET=your_api_secret
# Optional: paste a manual token (expires midnight IST every day)
ZERODHA_ACCESS_TOKEN=`;

const ZERODHA_WS = `# Terminal 1 — WebSocket proxy (from repo root)
cd ws-server
npm install          # only first time
ZERODHA_API_KEY=kitexxx ZERODHA_ACCESS_TOKEN=<token> BROKER=zerodha bun run index.ts

# Terminal 2 — Next.js dev server
cd opchain
bun run dev`;

const SUPABASE_ENV = `# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key`;

// ─────────────────────────────────────────────────────────────────────────────
//  Main component (exported as SetupPanel to keep all imports unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function SetupPanel() {
  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="space-y-5 pr-1 pb-4">

        {/* ── 0. What is OPTIX ── */}
        <Card className="bg-white border-zinc-200 p-5 border-l-2 border-l-violet-500">
          <SectionHead icon={BookOpen} title="What is OPTIX?" color="text-violet-600" />
          <p className="text-xs text-zinc-500 leading-relaxed mb-3">
            <strong className="text-zinc-700">OPTIX</strong> is a real-time F&O option chain dashboard for Indian markets. It connects
            directly to <strong className="text-cyan-700">Upstox</strong> or <strong className="text-orange-600">Zerodha Kite Connect</strong> APIs,
            streams live ticks over WebSocket, and visualises the full Nifty / BankNifty / FinNifty / Sensex
            option chain with OI, Greeks, volume, and analytics — all in one screen.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["Live chain", "Bid/Ask, LTP, OI, IV, Greeks per strike"],
              ["OI Chart",   "Call vs Put OI bar chart across strikes"],
              ["Greeks",     "IV, Delta, Gamma, Theta, Vega table"],
              ["Analytics",  "PCR, Max Pain, IV Skew, total OI/volume"],
            ].map(([label, desc]) => (
              <div key={label} className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                <p className="text-[10px] font-bold text-zinc-700 mb-1">{label}</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── 1. Navigation ── */}
        <Card className="bg-white border-zinc-200 p-5">
          <SectionHead icon={Settings} title="Navigation & Controls" color="text-zinc-700" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Header Bar (top)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-zinc-500 w-1/4">Control</th>
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-zinc-500">What it does</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Broker toggle",    "Switch between Upstox and Zerodha. Re-fetches chain, expiries, and rewires the live WS feed immediately."],
                  ["Symbol selector",  "NIFTY · BANKNIFTY · FINNIFTY · SENSEX — changes the underlying and reloads the chain."],
                  ["Expiry selector",  "Live expiry dates from the broker API. Falls back to computed dates when not authenticated."],
                  ["Tabs",            "CHAIN · OI CHART · GREEKS · ANALYTICS · DOCS — switches the main panel view."],
                  ["Live toggle",     "When ON, connects the WebSocket proxy and polls REST every 5 s as a fallback."],
                  ["↺ Refresh",       "Force a manual REST fetch right now, ignoring the 5 s timer."],
                  ["Login button",    "Opens a modal: log in with Upstox or Zerodha via OAuth. Sets an http-only cookie automatically."],
                  ["Connection dot",  "🟢 connected  🟡 reconnecting  🔴 error  ⚫ demo (no token)"],
                  ["Clock",           "Live IST clock, ticks every second."],
                ].map(([ctrl, desc]) => (
                  <tr key={ctrl} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-1.5 font-semibold text-zinc-700 align-top whitespace-nowrap">{ctrl}</td>
                    <td className="px-3 py-1.5 text-zinc-500 leading-relaxed">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── 2. Tab Views ── */}
        <Card className="bg-white border-zinc-200 p-5">
          <SectionHead icon={BarChart2} title="Tab Views Explained" color="text-zinc-700" />
          <div className="space-y-3">
            {[
              {
                tab: "CHAIN", color: "text-cyan-700 bg-cyan-50 border-cyan-200",
                body: "Full option chain table. Each row is one strike. Left = Call side (CE), right = Put side (PE). The ATM row is highlighted in gold.",
                cols: [
                  ["OI",       "Open Interest — outstanding contracts"],
                  ["Chg OI",   "Change in OI since previous close"],
                  ["Volume",   "Contracts traded today"],
                  ["IV",       "Implied Volatility (annualised %)"],
                  ["Delta",    "Price sensitivity per ₹1 move in spot"],
                  ["Bid/Ask",  "Best bid and offer prices"],
                  ["LTP",      "Last Traded Price"],
                  ["LTP×Vol",  "LTP × Volume in ₹Cr — proxy for premium turnover"],
                ],
              },
              {
                tab: "OI CHART", color: "text-indigo-700 bg-indigo-50 border-indigo-200",
                body: "Bar chart overlaying Call OI (red) and Put OI (green) per strike. Tallest bars mark strong support/resistance. ATM is marked with a dashed vertical line.",
                cols: [],
              },
              {
                tab: "GREEKS", color: "text-purple-700 bg-purple-50 border-purple-200",
                body: "Sortable table of IV, Delta, Gamma, Theta, Vega for every strike on both sides.",
                cols: [
                  ["IV Skew", "Call IV − Put IV. Positive = call premium, negative = put premium."],
                  ["Delta",   "0 to ±1. ATM ≈ ±0.5. Deep ITM ≈ ±1. Far OTM ≈ 0."],
                  ["Gamma",   "Rate of Delta change. Highest at ATM — pin risk on expiry day."],
                  ["Theta",   "Daily time decay in ₹. Negative for buyers, positive for sellers."],
                  ["Vega",    "P&L per 1% move in IV. Long options = positive Vega."],
                ],
              },
              {
                tab: "ANALYTICS", color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                body: "Key market structure metrics computed from the full chain.",
                cols: [
                  ["PCR",             "Put-Call Ratio (OI). >1 = more puts written = bullish sentiment."],
                  ["Max Pain",        "Strike where option writers lose least — often acts as expiry magnet."],
                  ["IV Skew",         "Difference between ATM Call IV and ATM Put IV."],
                  ["Total OI/Volume", "Aggregate open interest and volume across all strikes."],
                ],
              },
            ].map(({ tab, color, body, cols }) => (
              <div key={tab} className={`border rounded-lg p-3 ${color}`}>
                <p className="text-[10px] font-bold mb-1.5">{tab}</p>
                <p className="text-[11px] leading-relaxed mb-2 opacity-80">{body}</p>
                {cols.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {cols.map(([k, v]) => (
                      <p key={k} className="text-[10px] opacity-80">
                        <strong>{k}</strong> — {v}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* ── 3. Upstox Setup ── */}
        <Card className="bg-white border-zinc-200 p-5 border-l-2 border-l-cyan-500">
          <SectionHead
            icon={TrendingUp}
            title="Upstox Setup (FREE — Recommended)"
            color="text-cyan-700"
            badge="FREE WITH ACCOUNT"
            badgeColor="bg-cyan-500/10 text-cyan-700 border-cyan-500/30"
            href="https://developer.upstox.com"
            hrefLabel="developer.upstox.com"
          />
          <p className="text-xs text-zinc-500 leading-relaxed mb-4">
            The Upstox API is <strong className="text-zinc-600">completely free</strong> for account holders.
            Dedicated <code className="bg-zinc-100 px-1 rounded">/v2/option/chain</code> endpoint with Greeks,
            a v3 protobuf WebSocket feed, tokens last ~24 hours.
          </p>
          <div className="space-y-3">
            <Accordion title="Step 1 — Create a Developer App on Upstox">
              <ol className="text-[11px] text-zinc-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Go to <strong>developer.upstox.com</strong> → sign in with your Upstox trading account.</li>
                <li>Click <strong>My Apps → Add New App</strong>.</li>
                <li>Set <strong>Redirect URI</strong> to:<br />
                  <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-cyan-700 text-[10px]">http://localhost:3000/api/auth/upstox/callback</code>
                </li>
                <li>Save. Copy your <strong>Client ID</strong> and <strong>Client Secret</strong>.</li>
              </ol>
            </Accordion>
            <Accordion title="Step 2 — Add credentials to opchain/.env.local">
              <CodeBlock code={UPSTOX_ENV} />
            </Accordion>
            <Accordion title="Step 3 — Login via OAuth to get the access token">
              <ol className="text-[11px] text-zinc-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Start the dev server: <code className="bg-zinc-100 px-1 rounded">bun run dev</code> inside <code className="bg-zinc-100 px-1 rounded">opchain/</code>.</li>
                <li>Click <strong>Login</strong> in the header → choose <strong>Upstox</strong>.</li>
                <li>Complete Upstox login. Token is stored as an http-only cookie automatically.</li>
                <li>The connection dot turns green and live data starts loading.</li>
              </ol>
              <Callout type="tip">
                Alternatively visit <code>http://localhost:3000/api/auth/upstox/login</code> directly in the browser.
              </Callout>
            </Accordion>
            <Accordion title="Step 4 — Start the WebSocket proxy for sub-second live ticks">
              <CodeBlock code={UPSTOX_WS} />
              <Callout type="info">
                After OAuth the app automatically pushes the fresh token to the running WS server — no restart needed.
              </Callout>
            </Accordion>
          </div>
        </Card>

        {/* ── 4. Zerodha Setup ── */}
        <Card className="bg-white border-zinc-200 p-5 border-l-2 border-l-orange-500">
          <SectionHead
            icon={Globe}
            title="Zerodha Kite Connect Setup"
            color="text-orange-600"
            badge="₹2000/MONTH"
            badgeColor="bg-orange-500/10 text-orange-600 border-orange-500/30"
            href="https://kite.trade/docs"
            hrefLabel="kite.trade/docs"
          />
          <p className="text-xs text-zinc-500 leading-relaxed mb-3">
            Kite Connect is a <strong className="text-zinc-600">paid API</strong> (₹2000/month). Tokens expire at
            midnight IST every night. Greeks are not provided — OPTIX computes them via Black-Scholes.
          </p>
          <Callout type="warn">
            Tokens expire at <strong>midnight IST every day</strong>. Log in again every morning before market open.
          </Callout>
          <div className="space-y-3 mt-4">
            <Accordion title="Step 1 — Create a Kite Connect App">
              <ol className="text-[11px] text-zinc-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Go to <strong>kite.zerodha.com/apps</strong> → <strong>Create New App</strong> → type: <strong>Connect</strong>.</li>
                <li>Set <strong>Redirect URL</strong> to:<br />
                  <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-orange-600 text-[10px]">http://localhost:3000/api/auth/zerodha/callback</code>
                </li>
                <li>Copy your <strong>API Key</strong> and <strong>API Secret</strong>.</li>
              </ol>
            </Accordion>
            <Accordion title="Step 2 — Add credentials to opchain/.env.local">
              <CodeBlock code={ZERODHA_ENV} />
            </Accordion>
            <Accordion title="Step 3 — Daily login to regenerate the access token">
              <ol className="text-[11px] text-zinc-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Switch broker to <strong>Zerodha</strong> in the header.</li>
                <li>Click <strong>Login</strong> → choose <strong>Kite Connect</strong>.</li>
                <li>Complete Kite login. Cookie is set automatically.</li>
                <li><strong>Repeat every morning</strong> — token is invalid after midnight IST.</li>
              </ol>
            </Accordion>
            <Accordion title="Step 4 — Start the WebSocket proxy for live ticks">
              <CodeBlock code={ZERODHA_WS} />
              <Callout type="info">
                After OAuth login the app pushes <code>api_key:access_token</code> to the WS server — the KiteTicker reconnects immediately.
              </Callout>
            </Accordion>
          </div>
        </Card>

        {/* ── 5. Live mode ── */}
        <Card className="bg-white border-zinc-200 p-5">
          <SectionHead icon={Zap} title="Live Mode & WebSocket Feed" color="text-yellow-600" />
          <p className="text-xs text-zinc-500 leading-relaxed mb-3">
            OPTIX uses a <strong className="text-zinc-700">two-layer feed</strong>:
          </p>
          <div className="space-y-2 mb-4">
            {[
              ["Layer 1 — WebSocket proxy", "The WS server (port 8765) connects to the broker feed and streams normalised tick JSON to the browser in near real-time. This is the primary sub-second path. The connection dot reflects its state."],
              ["Layer 2 — REST poll", "When live mode is on, the frontend also calls /api/option-chain every 5 s as a fallback. This keeps full chain data (strikes, OI, IV) in sync even if the WS feed misses packets."],
            ].map(([label, desc]) => (
              <div key={label} className="flex gap-3 bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                <span className="text-[10px] font-bold text-zinc-700 whitespace-nowrap mt-0.5 shrink-0">{label}</span>
                <span className="text-[11px] text-zinc-500 leading-relaxed">{desc}</span>
              </div>
            ))}
          </div>
          <Callout type="tip">
            The WS proxy (<code>bun run index.ts</code> inside <code>ws-server/</code>) must be running in a separate terminal for live ticks. The Next.js app alone only gives the 5 s REST poll.
          </Callout>
        </Card>

        {/* ── 6. Supabase ── */}
        <Card className="bg-white border-zinc-200 p-5 border-l-2 border-l-emerald-500">
          <SectionHead
            icon={Database}
            title="Supabase — Historical Snapshots (Optional)"
            color="text-emerald-600"
            badge="FREE TIER AVAILABLE"
            badgeColor="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
            href="https://supabase.com"
            hrefLabel="supabase.com"
          />
          <p className="text-xs text-zinc-500 leading-relaxed mb-4">
            Without Supabase the app still works fully for live data. With it, every REST refresh persists a
            chain snapshot in PostgreSQL so you can query historical PCR, Max Pain, and OI data.
          </p>
          <div className="space-y-3">
            <Accordion title="Step 1 — Create project and run schema">
              <ol className="text-[11px] text-zinc-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Create a new project at <strong>supabase.com</strong>.</li>
                <li>Open <strong>SQL Editor</strong> → paste the entire contents of <code className="bg-zinc-100 px-1 rounded">supabase/schema.sql</code> → Run.</li>
                <li>Copy <strong>Project URL</strong> and <strong>Anon Key</strong> from Project Settings → API.</li>
              </ol>
            </Accordion>
            <Accordion title="Step 2 — Add to .env.local">
              <CodeBlock code={SUPABASE_ENV} />
            </Accordion>
          </div>
        </Card>

        {/* ── 7. Broker comparison ── */}
        <Card className="bg-white border-zinc-200 p-5">
          <SectionHead icon={Info} title="Broker API Comparison" color="text-zinc-700" />
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-zinc-500 w-1/4">Feature</th>
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-cyan-600">Upstox (Free)</th>
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-orange-600">Zerodha Kite</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([f, u, z]) => (
                  <tr key={f} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-1.5 text-zinc-500 font-semibold whitespace-nowrap">{f}</td>
                    <td className="px-3 py-1.5 text-cyan-700 leading-relaxed">{u}</td>
                    <td className="px-3 py-1.5 text-orange-600 leading-relaxed">{z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Separator className="my-4 bg-zinc-200" />
          <Callout type="tip">
            Use <strong className="text-cyan-700">Upstox</strong> — it&apos;s free, has a dedicated option chain endpoint
            with Greeks, and tokens don&apos;t expire daily. Use Zerodha only if you already pay for Kite Connect.
          </Callout>
        </Card>

        {/* ── 8. Troubleshooting ── */}
        <Card className="bg-white border-zinc-200 p-5">
          <SectionHead icon={AlertTriangle} title="Troubleshooting" color="text-red-600" />
          <div className="space-y-2">
            {[
              ["Connection dot stays grey (demo mode)",
               "No access token found. Log in via the header Login button, or paste UPSTOX_ACCESS_TOKEN / ZERODHA_ACCESS_TOKEN in .env.local and restart bun run dev."],
              ["Connection dot is green but chain shows stale data",
               "The REST poll is updating but live ticks aren't flowing. Make sure the WS proxy (ws-server/) is running and the broker env vars match the selected broker."],
              ["Chain shows demo / mock data",
               "The API route fell back to mock. Open the browser DevTools → Network → filter by option-chain. Look for source:mock and read the error field in the response."],
              ["Zerodha: 'Invalid API key or access token'",
               "The access token expired at midnight IST. Log in again via Login → Kite Connect."],
              ["Upstox: 401 / chain returns mock after login",
               "OAuth token may have expired (~24h). Re-login via Login → Upstox."],
              ["Expiry dropdown shows computed dates, not live",
               "No valid credentials yet OR the /api/expiries/[broker] call failed silently. Check the Next.js terminal for [zerodha expiries] or [upstox expiries] log lines."],
              ["WS server port 8765 in use",
               "The server auto-increments to 8766 if 8765 is taken. Set NEXT_PUBLIC_WS_SERVER_URL=ws://localhost:8766 in .env.local and restart the dev server."],
              ["ws-server/ bun run fails",
               "Run npm install inside ws-server/ first — the ws package is a separate Node dependency not included in opchain/node_modules."],
              ["Zero live ticks when using Zerodha",
               "Check that the WS proxy received the tokenMap from the frontend. Look for 'Zerodha tokenMap stored: N tokens' in the ws-server terminal. If N=0, the chain REST fetch may have failed or returned an empty chain."],
            ].map(([q, a]) => (
              <Accordion key={q} title={q}>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{a}</p>
              </Accordion>
            ))}
          </div>
        </Card>

      </div>
    </ScrollArea>
  );
}

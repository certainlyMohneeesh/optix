"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Copy, Check } from "lucide-react";

// ── Code block component ──────────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-[10.5px] text-cyan-800 overflow-x-auto font-mono leading-relaxed whitespace-pre">
        {code}
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        {copied ? <Check className="h-3 w-3 text-green-700" /> : <Copy className="h-3 w-3 text-zinc-500" />}
      </Button>
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────
const COMPARISON = [
  ["Cost",                "FREE with account",              "₹2000/month"],
  ["Option Chain API",     "Direct /v2/option/chain",        "Instruments + Quote (manual merge)"],
  ["Real-time WebSocket",  "Free (v3 protobuf binary)",      "KiteTicker (paid)"],
  ["Token expiry",         "Long-lived (~24h)",              "Daily midnight IST — must re-login"],
  ["Greeks in API",        "Yes — IV, Δ, Γ, Θ, ν",         "No — must calculate yourself"],
  ["Rate limits",          "1000 req/min",                   "3 req/sec"],
  ["Binary feed",          "Protobuf (v3)",                  "Custom binary / JSON"],
  ["Docs",                 "developer.upstox.com",           "kite.trade/docs"],
];

const UPSTOX_SETUP_CODE = `
# ─── 1. Create Upstox Developer App ───────────────────────────────────────
# Go to: https://developer.upstox.com → My Apps → Add New App
# Set redirect URI: http://localhost:3000/api/auth/upstox/callback

# ─── 2. Add to .env.local ─────────────────────────────────────────────────
UPSTOX_CLIENT_ID=your_client_id_here
UPSTOX_CLIENT_SECRET=your_client_secret_here
UPSTOX_REDIRECT_URI=http://localhost:3000/api/auth/upstox/callback

# ─── 3. Login via OAuth (run app first) ───────────────────────────────────
# Visit: http://localhost:3000/api/auth/upstox/login
# → Redirects to Upstox login → back to app with token set in cookie

# ─── 4. (Alternative) Paste token directly in .env.local ──────────────────
UPSTOX_ACCESS_TOKEN=your_manual_access_token

# ─── 5. Start the WebSocket proxy ─────────────────────────────────────────
cd ws-server
UPSTOX_ACCESS_TOKEN=your_token BROKER=upstox bun run index.ts

# ─── 6. Restart Next.js ───────────────────────────────────────────────────
bun run dev
`.trim();

const ZERODHA_SETUP_CODE = `
# ─── 1. Create Kite Connect App ───────────────────────────────────────────
# Go to: https://kite.zerodha.com/apps → Create New App
# Set redirect URL: http://localhost:3000/api/auth/zerodha/callback
# Note your api_key and api_secret

# ─── 2. Add to .env.local ─────────────────────────────────────────────────
ZERODHA_API_KEY=kitexxxxxxxxxxx
ZERODHA_API_SECRET=your_api_secret

# ─── 3. Daily login (tokens expire at midnight IST every day!) ────────────
# Visit: http://localhost:3000/api/auth/zerodha/login
# → Redirects to Kite login → back to app with cookie set

# ─── 4. (Alternative) Paste token directly ────────────────────────────────
ZERODHA_ACCESS_TOKEN=your_access_token_here

# ─── 5. Start WebSocket proxy ─────────────────────────────────────────────
cd ws-server
ZERODHA_API_KEY=kitexxx ZERODHA_ACCESS_TOKEN=your_token BROKER=zerodha bun run index.ts

# NOTE: Subscribe to instrument tokens via the frontend → sent to WS server
`.trim();

const SUPABASE_CODE = `
# ─── 1. Create Supabase project ───────────────────────────────────────────
# Go to: https://supabase.com → New Project

# ─── 2. Run this SQL in Supabase SQL Editor ───────────────────────────────
# (File: supabase/schema.sql — copy contents to SQL Editor)

# ─── 3. Add to .env.local ─────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# ─── 4. Supabase will now:
#   • Store chain snapshots every refresh (when live data is active)
#   • Broadcast real-time changes via Supabase Realtime
#   • Allow querying historical PCR / Max Pain data
`.trim();

export function SetupPanel() {
  const [upstoxToken,  setUpstoxToken]  = useState("");
  const [zerodhaToken, setZerodhaToken] = useState("");
  const [zerodhaKey,   setZerodhaKey]   = useState("");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // In a real app, POST to /api/save-credentials (server-side storage in cookies/DB)
    // For demo: just show feedback
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);

    // Reload page to pick up tokens
    window.location.reload();
  };

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="space-y-6 pr-2">

        {/* Quick credential entry */}
        <Card className="bg-white border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <p className="font-bold text-zinc-800">Quick Token Setup</p>
            <Badge variant="outline" className="text-[9px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              Stored locally in .env.local
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Add these to your <code className="bg-zinc-200 px-1 rounded">.env.local</code> file
            and restart the dev server. See the setup guides below.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">
                Upstox Access Token
              </Label>
              <Input
                type="password"
                placeholder="Paste Upstox access token..."
                value={upstoxToken}
                onChange={(e) => setUpstoxToken(e.target.value)}
                className="bg-zinc-50 border-zinc-300 text-zinc-400 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">
                Zerodha API Key
              </Label>
              <Input
                placeholder="kitexxxxxxxxxxx"
                value={zerodhaKey}
                onChange={(e) => setZerodhaKey(e.target.value)}
                className="bg-zinc-50 border-zinc-300 text-zinc-400 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">
                Zerodha Access Token
              </Label>
              <Input
                type="password"
                placeholder="Paste Zerodha access token..."
                value={zerodhaToken}
                onChange={(e) => setZerodhaToken(e.target.value)}
                className="bg-zinc-50 border-zinc-300 text-zinc-400 font-mono text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs w-full"
              >
                {saving ? "Saving..." : saved ? "✓ Saved — Reloading" : "Save & Reload"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Upstox setup */}
        <Card className="bg-white border-zinc-200 p-5 border-l-2 border-l-cyan-500">
          <div className="flex items-center gap-3 mb-4">
            <p className="font-bold text-cyan-700 text-sm">▲ UPSTOX FREE API</p>
            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 border-cyan-500/30 text-[9px]">FREE WITH ACCOUNT</Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 text-[9px]">RECOMMENDED</Badge>
            <a
              href="https://developer.upstox.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-zinc-500 hover:text-cyan-700 flex items-center gap-1"
            >
              developer.upstox.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Upstox provides a <strong className="text-zinc-400">dedicated /option/chain endpoint</strong> that
            returns full option data with Greeks (IV, Δ, Γ, Θ, ν) for free. Tokens last ~24h and don't
            require daily re-login.
          </p>
          <CodeBlock code={UPSTOX_SETUP_CODE} />
        </Card>

        {/* Zerodha setup */}
        <Card className="bg-white border-zinc-200 p-5 border-l-2 border-l-orange-500">
          <div className="flex items-center gap-3 mb-4">
            <p className="font-bold text-orange-600 text-sm">⬡ ZERODHA KITE CONNECT</p>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[9px]">₹2000/MONTH</Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-[9px]">DAILY RE-LOGIN REQUIRED</Badge>
            <a
              href="https://kite.trade/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-zinc-500 hover:text-orange-600 flex items-center gap-1"
            >
              kite.trade/docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Kite Connect requires a paid subscription (₹2000/month). Access tokens expire at midnight IST
            every day and must be regenerated via Kite login. Greeks are not provided by the API.
          </p>
          <CodeBlock code={ZERODHA_SETUP_CODE} />
        </Card>

        {/* Supabase setup */}
        <Card className="bg-white border-zinc-200 p-5 border-l-2 border-l-emerald-500">
          <div className="flex items-center gap-3 mb-4">
            <p className="font-bold text-emerald-400 text-sm">🗄 SUPABASE (POSTGRESQL)</p>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">FREE TIER AVAILABLE</Badge>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Supabase stores option chain snapshots in PostgreSQL and broadcasts real-time updates.
            Historical PCR / Max Pain data can be queried for backtesting.
          </p>
          <CodeBlock code={SUPABASE_CODE} />
        </Card>

        {/* Comparison table */}
        <Card className="bg-white border-zinc-200 p-5">
          <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-4 uppercase">
            Broker API Comparison
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-zinc-500">Feature</th>
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-cyan-600">Upstox (Free)</th>
                  <th className="px-3 py-2 text-left text-[9px] font-bold text-orange-600">Zerodha Kite</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([f, u, z]) => (
                  <tr key={f} className="border-b border-zinc-200 hover:bg-zinc-200/20">
                    <td className="px-3 py-1.5 text-zinc-500 font-semibold">{f}</td>
                    <td className="px-3 py-1.5 text-cyan-700">{u}</td>
                    <td className="px-3 py-1.5 text-orange-600">{z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Separator className="my-4 bg-zinc-200" />
          <p className="text-[11px] text-yellow-600">
            💡 <strong>Verdict:</strong>{" "}
            <span className="text-zinc-400">
              Use <span className="text-cyan-700">Upstox</span> — it&apos;s free, has a dedicated option chain endpoint
              with Greeks, and tokens don&apos;t expire daily. Switch to Zerodha only if you&apos;re already paying
              for Kite Connect.
            </span>
          </p>
        </Card>
      </div>
    </ScrollArea>
  );
}

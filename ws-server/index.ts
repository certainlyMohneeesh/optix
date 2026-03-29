#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────────────────────
//  STANDALONE WEBSOCKET PROXY SERVER
//  Run with: bun run ws-server/index.ts
//  PORT: 8765 (configurable via WS_PORT env)
//
//  This server:
//   1. Connects to Upstox v3 Market Data Feed  OR  Zerodha KiteTicker
//   2. Decodes ticks
//   3. Broadcasts normalised JSON to all connected frontend clients
//
//  Internal HTTP API:
//    GET  /health    → status check
//    POST /token     → inject fresh access token (called by Next.js OAuth route)
//
//  Frontend connects to: ws://localhost:8765
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocket, WebSocketServer } from "ws";
import * as http from "http";

const PORT = Number(process.env.WS_PORT ?? 8765);

// ── Logging helpers ───────────────────────────────────────────────────────────
function log(scope: string, msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${scope}] ${msg}`);
}
function warn(scope: string, msg: string) {
  const ts = new Date().toISOString();
  console.warn(`[${ts}] [${scope}] ⚠  ${msg}`);
}
function err(scope: string, msg: string) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${scope}] ✖  ${msg}`);
}

// ── Credentials (injected via env or POST /token at runtime) ──────────────────
let UPSTOX_ACCESS_TOKEN  = process.env.UPSTOX_ACCESS_TOKEN ?? "";
let ZERODHA_API_KEY      = process.env.ZERODHA_API_KEY ?? "";
let ZERODHA_ACCESS_TOKEN = process.env.ZERODHA_ACCESS_TOKEN ?? "";
const BROKER               = (process.env.BROKER ?? "upstox") as "upstox" | "zerodha";
const WS_INTERNAL_SECRET   = process.env.WS_INTERNAL_SECRET ?? "";

log("WS Proxy", `Starting — broker=${BROKER}, port=${PORT}`);
if (!WS_INTERNAL_SECRET) warn("WS Proxy", "WS_INTERNAL_SECRET not set — /token endpoint is unprotected");

// ── HTTP Server (health-check + internal token push) ─────────────────────────
const httpServer = http.createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status:   "ok",
      broker:   BROKER,
      uptime:   process.uptime(),
      upstox:   { hasToken: !!UPSTOX_ACCESS_TOKEN },
      zerodha:  { hasApiKey: !!ZERODHA_API_KEY, hasToken: !!ZERODHA_ACCESS_TOKEN },
      clients:  clients.size,
    }));
    return;
  }

  // POST /token — Next.js OAuth callback pushes a fresh access token here
  if (req.url === "/token" && req.method === "POST") {
    const secret = req.headers["x-internal-secret"] ?? "";
    if (WS_INTERNAL_SECRET && secret !== WS_INTERNAL_SECRET) {
      warn("HTTP /token", "Rejected — invalid X-Internal-Secret");
      res.writeHead(403);
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { access_token, broker } = JSON.parse(body);
        if (!access_token) throw new Error("access_token missing in request body");

        if (broker === "zerodha") {
          // Encoded as "api_key:access_token"
          const colonIdx = access_token.indexOf(":");
          if (colonIdx === -1) {
            // Plain access_token — api_key already in env
            ZERODHA_ACCESS_TOKEN = access_token;
          } else {
            ZERODHA_API_KEY      = access_token.slice(0, colonIdx);
            ZERODHA_ACCESS_TOKEN = access_token.slice(colonIdx + 1);
          }
          log("HTTP /token", `Zerodha token updated (len=${ZERODHA_ACCESS_TOKEN.length}, apiKey=${ZERODHA_API_KEY.slice(0, 4)}…) — reconnecting`);
          reconnectZerodha();
        } else {
          UPSTOX_ACCESS_TOKEN = access_token;
          log("HTTP /token", `Upstox token updated (len=${UPSTOX_ACCESS_TOKEN.length}) — reconnecting`);
          if (upstoxWs) { upstoxWs.terminate(); upstoxWs = null; }
          connectUpstox();
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        err("HTTP /token", String(e));
        res.writeHead(400);
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

// ── WebSocket Server (clients = Next.js frontend) ────────────────────────────
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set<WebSocket>();

// Token map pushed by the frontend when it subscribes for Zerodha:
//   key = Zerodha instrument_token (number), value = instrument_key ("NFO:XXX")
let clientTokenMap: Record<number, string> = {};

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress ?? "unknown";
  log("WS", `Client connected from ${ip}. Total: ${clients.size + 1}`);
  clients.add(ws);

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // Client sends { type:"subscribe", broker:"upstox"|"zerodha", instruments:[...], tokenMap:{...} }
      if (data.type === "subscribe") {
        const broker: string = data.broker ?? "upstox";

        if (broker === "zerodha") {
          // Store the token map for normalizing outgoing ticks
          if (data.tokenMap && typeof data.tokenMap === "object") {
            // Keys arrive as strings from JSON — convert to numbers
            const newMap: Record<number, string> = {};
            for (const [k, v] of Object.entries(data.tokenMap)) {
              newMap[Number(k)] = v as string;
            }
            clientTokenMap = newMap;
            const tokenCount = Object.keys(newMap).length;
            log("WS", `Zerodha tokenMap stored: ${tokenCount} tokens`);
            if (tokenCount > 0) {
              subscribeZerodhaTokens(Object.keys(newMap).map(Number), "full");
            }
          } else {
            log("WS", `Zerodha subscribe without tokenMap — not subscribing to any tokens`);
          }
        } else if (Array.isArray(data.instruments)) {
          // Upstox (or any other broker using instrument_key strings)
          log("WS", `Upstox subscribe: ${data.instruments.length} instruments`);
          subscribeUpstoxInstruments(data.instruments);
        }
      }
    } catch { /* ignore non-JSON */ }
  });

  ws.on("close", (code, reason) => {
    clients.delete(ws);
    log("WS", `Client disconnected (code=${code}, reason=${reason.toString() || "none"}). Total: ${clients.size}`);
  });

  ws.on("error", (e) => {
    err("WS client", e.message);
  });
});

function broadcast(payload: object) {
  const json = JSON.stringify(payload);
  let sent = 0;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
      sent++;
    }
  }
  return sent;
}

// ── UPSTOX WebSocket Feed ─────────────────────────────────────────────────────
let upstoxWs: WebSocket | null = null;
let pendingInstruments: string[] = [];
let upstoxReconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function connectUpstox() {
  if (upstoxReconnectTimer) { clearTimeout(upstoxReconnectTimer); upstoxReconnectTimer = null; }

  if (!UPSTOX_ACCESS_TOKEN) {
    warn("Upstox WS", "No access token — broadcasting auth_required. Log in via the app to activate live feed.");
    broadcast({ type: "status", status: "auth_required", broker: "upstox" });
    return;
  }

  log("Upstox WS", "Requesting authorised WS URL…");

  try {
    const authRes = await fetch(
      "https://api.upstox.com/v3/feed/market-data-feed/authorize",
      { headers: { Authorization: `Bearer ${UPSTOX_ACCESS_TOKEN}` } }
    );

    if (authRes.status === 401) {
      warn("Upstox WS", "Token expired (401) — clearing token, broadcasting auth_required");
      UPSTOX_ACCESS_TOKEN = "";
      broadcast({ type: "status", status: "auth_required", broker: "upstox" });
      return;
    }
    if (!authRes.ok) throw new Error(`Auth endpoint returned ${authRes.status} ${authRes.statusText}`);

    const { data } = await authRes.json();
    const wsUrl: string = data.authorizedRedirectUri;
    log("Upstox WS", `Connecting to authorised feed URL…`);

    upstoxWs = new WebSocket(wsUrl, {
      headers: {
        "Origin":     "https://upstox.com",
        "User-Agent": "Mozilla/5.0 (compatible; optix-market-feed/1.0)",
      },
    });
    upstoxWs.binaryType = "arraybuffer";

    upstoxWs.on("open", () => {
      log("Upstox WS", "Connected ✓");
      broadcast({ type: "status", status: "connected", broker: "upstox" });
      if (pendingInstruments.length > 0) {
        subscribeUpstoxInstruments(pendingInstruments);
      }
    });

    upstoxWs.on("message", (data: ArrayBuffer | Buffer) => {
      try {
        const text = Buffer.isBuffer(data)
          ? data.toString("utf8")
          : Buffer.from(data as ArrayBuffer).toString("utf8");
        const feed = JSON.parse(text);
        const ticks = normaliseUpstoxFeed(feed);
        if (ticks.length > 0) {
          broadcast({ type: "ticks", broker: "upstox", ticks });
        }
      } catch {
        // Binary protobuf frame — signal heartbeat so client knows data is flowing
        broadcast({ type: "heartbeat", broker: "upstox", ts: Date.now() });
      }
    });

    upstoxWs.on("error", (e) => {
      err("Upstox WS", e.message);
      broadcast({ type: "status", status: "error", broker: "upstox", message: e.message });
    });

    upstoxWs.on("close", (code, reason) => {
      log("Upstox WS", `Closed (code=${code}, reason=${reason.toString() || "none"}) — reconnecting in 5s`);
      broadcast({ type: "status", status: "reconnecting", broker: "upstox" });
      upstoxWs = null;
      upstoxReconnectTimer = setTimeout(connectUpstox, 5_000);
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    err("Upstox WS", `Connection error: ${msg}`);
    broadcast({ type: "status", status: "error", broker: "upstox", message: msg });
    upstoxReconnectTimer = setTimeout(connectUpstox, 10_000);
  }
}

function subscribeUpstoxInstruments(instruments: string[]) {
  pendingInstruments = instruments;
  if (!upstoxWs || upstoxWs.readyState !== WebSocket.OPEN) {
    log("Upstox WS", `Stored ${instruments.length} instruments — will subscribe on connect`);
    return;
  }
  const msg = JSON.stringify({
    guid:   "optix-feed",
    method: "sub",
    data:   { mode: "full", instrumentKeys: instruments },
  });
  upstoxWs.send(msg);
  log("Upstox WS", `Subscribed to ${instruments.length} instruments`);
}

/** Normalise Upstox JSON feed response */
function normaliseUpstoxFeed(feed: Record<string, unknown>): object[] {
  const feeds = (feed as { feeds?: Record<string, unknown> }).feeds ?? {};
  const ticks: object[] = [];
  for (const [key, val] of Object.entries(feeds)) {
    const mkt  = (val as { ff?: { marketFF?: Record<string, unknown> } }).ff?.marketFF ?? {};
    const ltpc = (mkt as { ltpc?: { ltp?: number; cp?: number } }).ltpc ?? {};
    const oi   = (mkt as { oi?: number }).oi ?? 0;
    const vol  = (mkt as { volume?: number }).volume ?? 0;
    ticks.push({
      instrument_key: key,
      ltp:    ltpc.ltp  ?? 0,
      cp:     ltpc.cp   ?? 0,
      oi,
      volume: vol,
    });
  }
  return ticks;
}

// ── Zerodha KiteTicker ────────────────────────────────────────────────────────
let zerodhaWs: WebSocket | null = null;
let zerodhaReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let zerodhaTokens: number[] = []; // subscribed instrument tokens

function reconnectZerodha() {
  if (zerodhaWs) {
    zerodhaWs.removeAllListeners();
    zerodhaWs.terminate();
    zerodhaWs = null;
  }
  if (zerodhaReconnectTimer) { clearTimeout(zerodhaReconnectTimer); zerodhaReconnectTimer = null; }
  connectZerodha();
}

async function connectZerodha() {
  if (zerodhaReconnectTimer) { clearTimeout(zerodhaReconnectTimer); zerodhaReconnectTimer = null; }

  if (!ZERODHA_API_KEY || !ZERODHA_ACCESS_TOKEN) {
    warn("Zerodha WS", "No credentials — broadcasting auth_required. Log in via the app.");
    broadcast({ type: "status", status: "auth_required", broker: "zerodha" });
    return;
  }

  const wsUrl = `wss://ws.kite.trade?api_key=${ZERODHA_API_KEY}&access_token=${ZERODHA_ACCESS_TOKEN}`;
  log("Zerodha WS", `Connecting to wss://ws.kite.trade (apiKey=${ZERODHA_API_KEY.slice(0, 4)}…)`);

  zerodhaWs = new WebSocket(wsUrl);
  zerodhaWs.binaryType = "arraybuffer";

  zerodhaWs.on("open", () => {
    log("Zerodha WS", "Connected ✓");
    broadcast({ type: "status", status: "connected", broker: "zerodha" });
    // Re-subscribe if we had tokens from before
    if (zerodhaTokens.length > 0) {
      subscribeZerodhaTokens(zerodhaTokens, "full");
    }
  });

  zerodhaWs.on("message", (data: ArrayBuffer | Buffer) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    // KiteTicker sends text mode heartbeat as plain "{}""
    if (buf.length < 2) return;
    // Check if it looks like text (JSON)
    if (buf[0] === 0x7b) { // "{"
      try {
        const msg = JSON.parse(buf.toString("utf8"));
        // Kite sends { type: "message", data: "..." } for text mode
        if (msg.type === "message" || msg.type === "error") {
          log("Zerodha WS", `Text message: ${JSON.stringify(msg)}`);
        }
      } catch { /* ignore */ }
      return;
    }
    const ticks = parseZerodhaBinaryTicks(buf);
    if (ticks.length > 0) {
      // Normalize: translate instrument_token → instrument_key using clientTokenMap
      const normalized = (ticks as Array<Record<string, unknown>>).map((t) => {
        const token = t.instrument_token as number;
        const key   = clientTokenMap[token];
        return key
          ? { ...t, instrument_key: key }
          : t; // keep raw token so client can still try client-side fallback
      });
      if (normalized.some((t) => t.instrument_key)) {
        const resolvedCount = normalized.filter((t) => t.instrument_key).length;
        log("Zerodha WS", `Broadcasting ${resolvedCount}/${normalized.length} resolved ticks`);
      }
      broadcast({ type: "ticks", broker: "zerodha", ticks: normalized });
    }
  });

  zerodhaWs.on("error", (e) => {
    err("Zerodha WS", e.message);
    broadcast({ type: "status", status: "error", broker: "zerodha", message: e.message });
  });

  zerodhaWs.on("close", (code, reason) => {
    log("Zerodha WS", `Closed (code=${code}, reason=${reason.toString() || "none"}) — reconnecting in 5s`);
    broadcast({ type: "status", status: "reconnecting", broker: "zerodha" });
    zerodhaWs = null;
    // If token was bad (code 1008 or 403-level) don't reconnect immediately
    const isAuthError = code === 1008 || code === 4001 || code === 4002;
    if (isAuthError) {
      warn("Zerodha WS", `Auth error (code=${code}) — clearing token, waiting for new login`);
      ZERODHA_ACCESS_TOKEN = "";
      broadcast({ type: "status", status: "auth_required", broker: "zerodha" });
      return;
    }
    zerodhaReconnectTimer = setTimeout(connectZerodha, 5_000);
  });
}

/** Subscribe to instrument tokens on Zerodha KiteTicker */
function subscribeZerodhaTokens(tokens: number[], mode: "ltp" | "quote" | "full" = "full") {
  zerodhaTokens = tokens;
  if (!zerodhaWs || zerodhaWs.readyState !== WebSocket.OPEN) {
    log("Zerodha WS", `Stored ${tokens.length} tokens — will subscribe on connect`);
    return;
  }
  // KiteTicker subscribe message format (binary mode)
  // Set mode: message type 11=subscribe, 12=unsubscribe
  // For mode setting: message type 15=setMode
  const subMsg = JSON.stringify({ a: "subscribe", v: tokens });
  zerodhaWs.send(subMsg);
  log("Zerodha WS", `Subscribed to ${tokens.length} tokens`);

  const modeKey = { ltp: "ltp", quote: "quote", full: "full" }[mode];
  const modeMsg = JSON.stringify({ a: "mode", v: [modeKey, tokens] });
  zerodhaWs.send(modeMsg);
  log("Zerodha WS", `Set mode=${modeKey} for ${tokens.length} tokens`);
}

/** Parse Zerodha binary tick packets
 *  Format: [2-byte num_packets] then for each: [2-byte pkt_len][pkt_len bytes]
 *  Packet bytes (for full mode, pktLen>=184):
 *    0-3:   instrument_token (uint32 BE)
 *    4-7:   last_traded_price / 100 (uint32 BE)
 *    8-11:  last_traded_qty (uint32 BE)
 *    12-15: average_traded_price / 100 (uint32 BE)
 *    16-19: volume (uint32 BE)
 *    20-23: buy_qty (uint32 BE)
 *    24-27: sell_qty (uint32 BE)
 *    28-31: open / 100 (uint32 BE)
 *    32-35: high / 100 (uint32 BE)
 *    36-39: low / 100 (uint32 BE)
 *    40-43: close / 100 (uint32 BE)
 *    44-47: last_traded_timestamp (uint32 BE)
 *    48-51: oi (uint32 BE)
 *    52-55: oi_day_high (uint32 BE)
 *    56-59: oi_day_low (uint32 BE)
 *    60-63: exchange_timestamp (uint32 BE)
 *    64-…: depth data (5 buy+5 sell × 12 bytes each)
 */
function parseZerodhaBinaryTicks(buf: Buffer): object[] {
  if (buf.length < 2) return [];

  const numPackets = buf.readUInt16BE(0);
  if (numPackets === 0) return [];

  const ticks: object[] = [];
  let offset = 2; // skip the first 2-byte count

  for (let i = 0; i < numPackets; i++) {
    if (offset + 2 > buf.length) break;
    const pktLen = buf.readUInt16BE(offset);
    offset += 2;
    if (pktLen < 8 || offset + pktLen > buf.length) {
      offset += pktLen;
      continue;
    }

    const pkt              = buf.slice(offset, offset + pktLen);
    offset                += pktLen;

    const instrument_token = pkt.readUInt32BE(0);
    const last_price       = pkt.readUInt32BE(4) / 100;
    const volume           = pktLen >= 20 ? pkt.readUInt32BE(16) : 0;
    const oi               = pktLen >= 52 ? pkt.readUInt32BE(48) : 0;
    const oi_day_high      = pktLen >= 56 ? pkt.readUInt32BE(52) / 100 : 0;
    const oi_day_low       = pktLen >= 60 ? pkt.readUInt32BE(56) / 100 : 0;
    const open             = pktLen >= 32 ? pkt.readUInt32BE(28) / 100 : 0;
    const high             = pktLen >= 36 ? pkt.readUInt32BE(32) / 100 : 0;
    const low              = pktLen >= 40 ? pkt.readUInt32BE(36) / 100 : 0;
    const close            = pktLen >= 44 ? pkt.readUInt32BE(40) / 100 : 0;

    ticks.push({
      instrument_token,
      ltp:        last_price,
      volume,
      oi,
      oi_day_high,
      oi_day_low,
      ohlc: { open, high, low, close },
    });
  }

  return ticks;
}

// ── Start ─────────────────────────────────────────────────────────────────────
function startServer(port: number) {
  httpServer.listen(port, () => {
    log("WS Proxy", `HTTP health:  http://localhost:${port}/health`);
    log("WS Proxy", `WebSocket:    ws://localhost:${port}`);
    log("WS Proxy", `Broker mode:  ${BROKER}`);
    log("WS Proxy", `Upstox token: ${UPSTOX_ACCESS_TOKEN ? `set (len=${UPSTOX_ACCESS_TOKEN.length})` : "not set"}`);
    log("WS Proxy", `Zerodha cred: apiKey=${ZERODHA_API_KEY ? "set" : "not set"}, token=${ZERODHA_ACCESS_TOKEN ? "set" : "not set"}`);

    if (BROKER === "zerodha") {
      connectZerodha();
    } else {
      connectUpstox();
    }
  });

  httpServer.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EADDRINUSE") {
      warn("WS Proxy", `Port ${port} in use — trying ${port + 1}…`);
      httpServer.removeAllListeners("error");
      httpServer.close();
      startServer(port + 1);
    } else {
      throw e;
    }
  });
}

startServer(PORT);


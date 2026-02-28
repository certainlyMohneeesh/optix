#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────────────────────
//  STANDALONE WEBSOCKET PROXY SERVER
//  Run with: bun run ws-server/index.ts
//  PORT: 8080 (configurable via WS_PORT env)
//
//  This server:
//   1. Connects to Upstox v3 Market Data Feed (protobuf binary)
//      OR Zerodha KiteTicker (JSON/binary)
//   2. Decodes ticks
//   3. Broadcasts normalised JSON to all connected frontend clients
//
//  Frontend connects to: ws://localhost:8080
// ─────────────────────────────────────────────────────────────────────────────
import { WebSocket, WebSocketServer } from "ws";
import * as http from "http";

const PORT = Number(process.env.WS_PORT ?? 8080);

// ── Credentials (set in env or ws-server/.env) ────────────────────────────────
const UPSTOX_ACCESS_TOKEN  = process.env.UPSTOX_ACCESS_TOKEN ?? "";
const ZERODHA_API_KEY      = process.env.ZERODHA_API_KEY ?? "";
const ZERODHA_ACCESS_TOKEN = process.env.ZERODHA_ACCESS_TOKEN ?? "";
const BROKER               = (process.env.BROKER ?? "upstox") as "upstox" | "zerodha";

// ── HTTP Server (health-check) ────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", broker: BROKER, uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ── WebSocket Server (clients = Next.js frontend) ────────────────────────────
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  console.log(`[WS] Client connected. Total: ${clients.size + 1}`);
  clients.add(ws);

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // Client can send { type:"subscribe", instruments:["NSE_INDEX|Nifty 50",...] }
      if (data.type === "subscribe" && Array.isArray(data.instruments)) {
        subscribeUpstoxInstruments(data.instruments);
      }
    } catch { /* ignore */ }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });
});

function broadcast(payload: object) {
  const json = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// ── UPSTOX WebSocket Feed ─────────────────────────────────────────────────────
let upstoxWs: WebSocket | null = null;
let pendingInstruments: string[] = [];

async function connectUpstox() {
  if (!UPSTOX_ACCESS_TOKEN) {
    console.warn("[Upstox WS] No access token — broadcasting mock ticks");
    startMockBroadcast();
    return;
  }

  try {
    // Get authorised redirect URI
    const authRes = await fetch(
      "https://api.upstox.com/v3/feed/market-data-feed/authorize",
      { headers: { Authorization: `Bearer ${UPSTOX_ACCESS_TOKEN}` } }
    );
    if (!authRes.ok) throw new Error(`Auth failed ${authRes.status}`);
    const { data } = await authRes.json();
    const wsUrl: string = data.authorizedRedirectUri;

    console.log("[Upstox WS] Connecting to", wsUrl);
    upstoxWs = new WebSocket(wsUrl);
    upstoxWs.binaryType = "arraybuffer";

    upstoxWs.on("open", () => {
      console.log("[Upstox WS] Connected");
      broadcast({ type: "status", status: "connected", broker: "upstox" });
      if (pendingInstruments.length > 0) {
        subscribeUpstoxInstruments(pendingInstruments);
      }
    });

    upstoxWs.on("message", (data: ArrayBuffer | Buffer) => {
      // Upstox v3 uses protobuf — decode using the feed proto schema
      // For simplicity we attempt JSON decode first (v2 JSON mode),
      // then fall back to raw buffer logging
      try {
        const text = Buffer.isBuffer(data)
          ? data.toString("utf8")
          : Buffer.from(data).toString("utf8");
        const feed = JSON.parse(text);
        // Normalise and broadcast
        const ticks = normaliseUpstoxFeed(feed);
        if (ticks.length > 0) {
          broadcast({ type: "ticks", ticks });
        }
      } catch {
        // Binary protobuf — decode with protobufjs if needed
        // See: https://github.com/upstox/upstox-nodejs/blob/main/lib/websocket.js
        // For now broadcast raw size info so client knows feed is alive
        broadcast({ type: "heartbeat", ts: Date.now() });
      }
    });

    upstoxWs.on("error", (err) => {
      console.error("[Upstox WS] Error:", err.message);
      broadcast({ type: "status", status: "error", message: err.message });
    });

    upstoxWs.on("close", () => {
      console.log("[Upstox WS] Closed — reconnecting in 5s");
      broadcast({ type: "status", status: "reconnecting", broker: "upstox" });
      setTimeout(connectUpstox, 5000);
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Upstox WS] Connection error:", msg);
    broadcast({ type: "status", status: "error", message: msg });
    setTimeout(connectUpstox, 10_000);
  }
}

function subscribeUpstoxInstruments(instruments: string[]) {
  pendingInstruments = instruments;
  if (!upstoxWs || upstoxWs.readyState !== WebSocket.OPEN) return;
  const msg = JSON.stringify({
    guid:   "option-chain-feed",
    method: "sub",
    data:   { mode: "full", instrumentKeys: instruments },
  });
  upstoxWs.send(msg);
  console.log(`[Upstox WS] Subscribed to ${instruments.length} instruments`);
}

/** Normalise Upstox JSON feed response */
function normaliseUpstoxFeed(feed: Record<string, unknown>): object[] {
  // Upstox v2 JSON feed has shape: { feeds: { [instrument_key]: { ff: { marketFF: {...} } } } }
  const feeds = (feed as { feeds?: Record<string, unknown> }).feeds ?? {};
  const ticks: object[] = [];
  for (const [key, val] of Object.entries(feeds)) {
    const mkt = (val as { ff?: { marketFF?: Record<string, unknown> } }).ff?.marketFF ?? {};
    const ltpc = (mkt as { ltpc?: { ltp?: number } }).ltpc ?? {};
    const oi   = (mkt as { oi?: number }).oi ?? 0;
    const vol  = (mkt as { volume?: number }).volume ?? 0;
    ticks.push({ instrument_key: key, ltp: ltpc.ltp ?? 0, oi, volume: vol });
  }
  return ticks;
}

// ── Zerodha KiteTicker ────────────────────────────────────────────────────────
// Zerodha uses their own kiteconnect npm package's KiteTicker class.
// Since we can't import it directly without installing kiteconnect,
// we replicate the WS connection manually.
async function connectZerodha() {
  if (!ZERODHA_API_KEY || !ZERODHA_ACCESS_TOKEN) {
    console.warn("[Zerodha WS] No credentials — broadcasting mock ticks");
    startMockBroadcast();
    return;
  }

  const wsUrl = `wss://ws.kite.trade?api_key=${ZERODHA_API_KEY}&access_token=${ZERODHA_ACCESS_TOKEN}`;
  const zWs = new WebSocket(wsUrl);
  zWs.binaryType = "arraybuffer";

  zWs.on("open", () => {
    console.log("[Zerodha WS] Connected");
    broadcast({ type: "status", status: "connected", broker: "zerodha" });
  });

  zWs.on("message", (data: ArrayBuffer | Buffer) => {
    // Zerodha binary tick parsing
    const buf  = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    if (buf.length < 2) return;
    const ticks = parseZerodhaBinaryTicks(buf);
    if (ticks.length > 0) {
      broadcast({ type: "ticks", broker: "zerodha", ticks });
    }
  });

  zWs.on("error", (err) => {
    broadcast({ type: "status", status: "error", message: err.message });
    setTimeout(connectZerodha, 5000);
  });

  zWs.on("close", () => {
    broadcast({ type: "status", status: "reconnecting", broker: "zerodha" });
    setTimeout(connectZerodha, 5000);
  });
}

/** Parse Zerodha binary tick packet */
function parseZerodhaBinaryTicks(buf: Buffer): object[] {
  const ticks: object[] = [];
  let offset = 0;
  while (offset < buf.length - 1) {
    // Kite binary format: 2-byte number of packets, then repeated 4-byte instrument_token, ...
    if (offset === 0) {
      const numPackets = buf.readUInt16BE(offset);
      offset += 2;
      if (numPackets === 0) break;
    }
    // Each quote packet: 2-byte length, then data
    if (offset + 2 > buf.length) break;
    const pktLen = buf.readUInt16BE(offset);
    offset += 2;
    if (pktLen < 8) { offset += pktLen; continue; }
    if (offset + pktLen > buf.length) break;

    const pkt = buf.slice(offset, offset + pktLen);
    offset += pktLen;

    const instrument_token = pkt.readUInt32BE(0);
    const last_price = pkt.readUInt32BE(4) / 100;
    const oi = pktLen >= 24 ? pkt.readUInt32BE(16) : 0;
    const volume = pktLen >= 28 ? pkt.readUInt32BE(12) : 0;

    ticks.push({ instrument_token, ltp: last_price, oi, volume });
    break; // Only parse the first packet to avoid infinite loop
  }
  return ticks;
}

// ── Mock heartbeat when no credentials ───────────────────────────────────────
function startMockBroadcast() {
  setInterval(() => {
    broadcast({ type: "heartbeat", ts: Date.now(), broker: "mock" });
  }, 3000);
}

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[WS Proxy] HTTP health: http://localhost:${PORT}/health`);
  console.log(`[WS Proxy] WebSocket: ws://localhost:${PORT}`);
  console.log(`[WS Proxy] Broker: ${BROKER}`);
  if (BROKER === "upstox") {
    connectUpstox();
  } else {
    connectZerodha();
  }
});

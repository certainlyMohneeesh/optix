# Kite Connect Setup Guide

> Step-by-step guide to configure Zerodha Kite Connect for OPTIX — covering app creation, OAuth, WebSocket live feed, and daily token management.

---

## Table of Contents

1. [What Kite Connect provides](#1-what-kite-connect-provides)
2. [Create a Kite Connect app](#2-create-a-kite-connect-app)
3. [Set environment variables](#3-set-environment-variables)
4. [OAuth flow — how login works](#4-oauth-flow---how-login-works)
5. [REST API — option chain data](#5-rest-api---option-chain-data)
6. [WebSocket live feed (KiteTicker)](#6-websocket-live-feed-kiteticker)
7. [Token push to WS server](#7-token-push-to-ws-server)
8. [Daily token refresh](#8-daily-token-refresh)
9. [Running the WS server in Zerodha mode](#9-running-the-ws-server-in-zerodha-mode)
10. [Troubleshooting](#10-troubleshooting)
11. [Kite Connect API reference](#11-kite-connect-api-reference)

---

## 1. What Kite Connect Provides

| Feature | API |
|---|---|
| Option chain (quotes) | `GET /quote?i=NFO:NIFTY…` |
| Instruments list (CSV) | `GET /instruments/NFO` |
| Expiry dates | Parsed from instruments CSV |
| Spot price (index LTP) | `GET /quote/ltp?i=NSE:NIFTY 50` |
| Live ticks (WebSocket) | `wss://ws.kite.trade` (binary protocol) |
| OAuth token | `POST /session/token` (exchange `request_token`) |

**Note:** Kite Connect does **not** provide Black-Scholes Greeks (IV, Delta, Gamma, Theta, Vega) directly. OPTIX computes these client-side from the LTP and spot price.

---

## 2. Create a Kite Connect App

### 2a. Sign up and log in

1. Go to [developers.kite.trade](https://developers.kite.trade)
2. Log in with your Zerodha credentials

### 2b. Create a new app

1. Click **Create new app**
2. Fill in:
   - **App name**: `OPTIX` (or any name)
   - **App type**: `Connect` (not `Publisher`)
   - **Redirect URL**: `http://localhost:3000/api/auth/zerodha/callback` ← for local dev
   - **Description**: Option chain dashboard

3. Click **Create**
4. Note down:
   - **API Key** → `ZERODHA_API_KEY`
   - **API Secret** → `ZERODHA_API_SECRET`

> ⚠️ **Kite Connect costs ₹2000/month** per app. There is no free tier for live data. Paper-trading accounts do **not** have access — you need a real Zerodha trading account with F&O segment activated.

### 2c. Activate F&O segment (if not done)

If you get `403` errors when fetching NFO instruments or quotes, activate the F&O segment:
1. Log in to [kite.zerodha.com](https://kite.zerodha.com)
2. Go to **Profile → Account → Segments**
3. Enable **Futures & Options (NFO)**

---

## 3. Set Environment Variables

Add to your `.env.local` (or `.env` for the WS server):

```env
# ─── Zerodha Kite Connect ──────────────────────────────────────────────────────
ZERODHA_API_KEY=your_api_key_here
ZERODHA_API_SECRET=your_api_secret_here

# Leave blank — token is injected dynamically after OAuth login
ZERODHA_ACCESS_TOKEN=

# ─── WS server broker mode (set to zerodha to start in Zerodha mode) ──────────
# If blank, defaults to "upstox". You can switch brokers via the UI without restarting.
BROKER=upstox
```

> `ZERODHA_ACCESS_TOKEN` is intentionally left blank in the env file. The token is obtained fresh each day via the OAuth login flow and stored as an http-only cookie + injected into the WS server automatically.

---

## 4. OAuth Flow — How Login Works

```
User clicks "Login → Kite Connect"
  │
  └─► GET /api/auth/zerodha/login
          │
          └─► Redirect to: https://kite.zerodha.com/connect/login?v=3&api_key=YOUR_KEY
                  │
                  └─► User completes 2FA on Kite
                          │
                          └─► Kite redirects to: /api/auth/zerodha/callback?request_token=xxxxx
                                  │
                                  ├─► Server computes SHA-256(api_key + request_token + api_secret)
                                  ├─► POST https://api.kite.trade/session/token → access_token
                                  ├─► Set cookie: zerodha_access_token (http-only, 23h)
                                  ├─► POST http://localhost:8765/token (push access_token to WS server)
                                  └─► Redirect to /
```

### Checksum computation

Kite requires a SHA-256 checksum to prevent replay attacks:

```
checksum = SHA256(api_key + request_token + api_secret)
```

This is computed server-side in `app/api/auth/zerodha/[action]/route.ts` using the Web Crypto API.

---

## 5. REST API — Option Chain Data

### How OPTIX fetches the chain

1. **Instruments CSV** (`GET /instruments/NFO`)
   - Returns a large CSV (~100k rows) with all NFO instruments
   - OPTIX filters by `name = symbol` (e.g. `NIFTY`) and `expiry = YYYY-MM-DD`
   - This is fetched fresh every request (Kite updates daily; no cache headers on our side — add Redis caching in production for speed)

2. **Batch quotes** (`GET /quote?i=NFO:NIFTY24DEC21900CE&i=NFO:…`)
   - Max 500 instruments per request
   - Returns LTP, OI, volume, OHLC, depth

3. **Spot price** (`GET /quote/ltp?i=NSE:NIFTY 50`)

### Index symbols

| OPTIX Symbol | Kite ID |
|---|---|
| `NIFTY` | `NSE:NIFTY 50` |
| `BANKNIFTY` | `NSE:NIFTY BANK` |
| `FINNIFTY` | `NSE:NIFTY FIN SERVICE` |
| `MIDCPNIFTY` | `NSE:NIFTY MIDCAP SELECT` |
| `SENSEX` | `BSE:SENSEX` |

### API base URL and auth header

```
Base URL:  https://api.kite.trade
Header:    X-Kite-Version: 3
           Authorization: token {api_key}:{access_token}
```

---

## 6. WebSocket Live Feed (KiteTicker)

### Connection

```
wss://ws.kite.trade?api_key={api_key}&access_token={access_token}
```

No HTTP upgrade required — the credentials are passed as query params.

### Subscribing to instruments

After connecting, send JSON messages to subscribe to instrument tokens (numeric IDs from the instruments CSV):

```json
{ "a": "subscribe", "v": [256265, 260105, 408065] }
```

Set the data mode (ltp = price only, quote = full snapshot, full = with depth):

```json
{ "a": "mode", "v": ["full", [256265, 260105, 408065]] }
```

### Binary tick format

Kite sends binary packets over the WebSocket. Each message:
- First 2 bytes: number of tick packets in this frame
- For each packet: 2-byte packet length, then N bytes of data

**Packet offsets for `full` mode (184 bytes):**

```
Bytes  0–3   : instrument_token (uint32 BE)
Bytes  4–7   : last_traded_price × 100 (uint32 BE)  → divide by 100
Bytes  8–11  : last_traded_quantity (uint32 BE)
Bytes 12–15  : average_traded_price × 100 (uint32 BE)
Bytes 16–19  : volume (uint32 BE)
Bytes 20–23  : buy_quantity (uint32 BE)
Bytes 24–27  : sell_quantity (uint32 BE)
Bytes 28–31  : open × 100
Bytes 32–35  : high × 100
Bytes 36–39  : low × 100
Bytes 40–43  : close × 100
Bytes 44–47  : last_traded_time (unix epoch, uint32 BE)
Bytes 48–51  : OI (uint32 BE)
Bytes 52–55  : OI day high (uint32 BE)
Bytes 56–59  : OI day low (uint32 BE)
Bytes 60–63  : exchange_timestamp (unix epoch, uint32 BE)
Bytes 64–183 : market depth (5 buy + 5 sell levels × 12 bytes each)
```

**ltp mode** packets are 8 bytes (token + ltp only).
**quote mode** packets are 44 bytes (token + ltp + ohlc + OI, no depth).

OPTIX's WS server (`ws-server/index.ts`) parses all three sizes with the `parseZerodhaBinaryTicks` function.

### Getting instrument tokens

Instrument tokens are numeric IDs from the instruments CSV:

```typescript
// Example from CSV row:
// 260105,1016,NIFTY24DEC19500CE,NIFTY,0.0,2024-12-26,19500.0,0.05,25,CE,NFO-OPT,NFO
// instrument_token = 260105
```

The WS server accepts tokens via an internal subscription mechanism. In a full implementation, the Next.js app would fetch the token list from the instruments CSV and send them to the WS server.

---

## 7. Token Push to WS Server

After the OAuth callback, the Next.js app automatically pushes the fresh token to the WS server:

```typescript
// From app/api/auth/zerodha/[action]/route.ts
fetch(`http://localhost:${wsPort}/token`, {
  method:  "POST",
  headers: {
    "Content-Type":      "application/json",
    "X-Internal-Secret": wsSecret,     // must match WS_INTERNAL_SECRET env
  },
  body: JSON.stringify({
    access_token: `${API_KEY}:${access_token}`,  // "key:token" format
    broker:       "zerodha",
  }),
});
```

The WS server splits `api_key:access_token` on the first colon and updates both credentials, then immediately reconnects to `wss://ws.kite.trade`.

**Logs you should see in the WS server:**

```
[2026-03-05T06:00:00.000Z] [HTTP /token] Zerodha token updated (len=32, apiKey=abcd…) — reconnecting
[2026-03-05T06:00:00.001Z] [Zerodha WS] Connecting to wss://ws.kite.trade (apiKey=abcd…)
[2026-03-05T06:00:00.500Z] [Zerodha WS] Connected ✓
```

---

## 8. Daily Token Refresh

Kite Connect access tokens **expire at midnight IST every day**. There is no refresh token — you must complete the OAuth flow again each morning.

### Option A — Manual login each morning

1. Open your OPTIX dashboard
2. If you see the `LOGIN` badge in the header, click **Login**
3. Select **Kite Connect** in the modal
4. Complete 2FA on Kite — you'll be redirected back automatically

### Option B — Login URL bookmark

Bookmark `https://your-domain.com/api/auth/zerodha/login` for one-click morning login.

### Option C — Cron reminder

```bash
crontab -e
# Remind yourself at 9:00 AM on weekdays
0 9 * * 1-5 echo "Zerodha token expired — login at https://your-domain.com/api/auth/zerodha/login" | mail -s "OPTIX: Zerodha token refresh" your@email.com
```

### Checking token status

```bash
# Health check — shows whether tokens are set
curl http://localhost:8765/health | jq .
# Response:
# {
#   "status": "ok",
#   "broker": "zerodha",
#   "zerodha": { "hasApiKey": true, "hasToken": true },
#   "clients": 1
# }
```

---

## 9. Running the WS Server in Zerodha Mode

### Switch broker at startup

Set `BROKER=zerodha` in the WS server env to auto-connect to Kite on startup:

```env
# ws-server/.env
BROKER=zerodha
ZERODHA_API_KEY=your_api_key
ZERODHA_ACCESS_TOKEN=   # blank — fill in after first OAuth login
WS_PORT=8765
WS_INTERNAL_SECRET=your_64_char_secret
```

```bash
cd ws-server
bun run index.ts
```

### Both brokers at the same time?

The WS server supports one broker at a time (controlled by `BROKER` env). However, switching brokers via the UI in OPTIX automatically triggers a new OAuth flow for the selected broker and the WS server reconnects to the appropriate feed without restarting.

### PM2 (production)

```bash
# Start in Zerodha mode
pm2 start ecosystem.config.js --only optix-ws --env BROKER=zerodha

# Or update env and restart
pm2 setenv optix-ws BROKER zerodha
pm2 restart optix-ws
```

---

## 10. Troubleshooting

### `403 Forbidden` on instruments or quote endpoints

- F&O segment is not activated on your Zerodha account
- API key/secret mismatch
- Access token expired (re-login)

### `Invalid checksum` on session/token

- Your `ZERODHA_API_SECRET` is wrong — double-check from [developers.kite.trade](https://developers.kite.trade)
- The `request_token` is single-use. If you re-used a callback URL it will fail.

### WS server shows `auth_required` after login

- The `/token` push failed — check `WS_INTERNAL_SECRET` matches in both `.env.local` and `ws-server/.env`
- WS server may be down — check `pm2 status optix-ws`

### Empty option chain / no expiries

- Symbol may not have active F&O contracts (e.g. `SENSEX` is BSE-listed — NFO instruments won't have it)
- Selected expiry has already expired — the UI should only show future expiries

### Binary tick parsing producing zeros

- Check that `mode` was set to `full` (or `quote`) for OI — `ltp` mode packets are only 8 bytes
- Instrument tokens must be numeric (from instruments CSV), not the trading symbol

### Inspecting live WS traffic

Open your browser DevTools → Network → WS tab after logging in. You should see:
```json
{"type":"status","status":"connected","broker":"zerodha"}
{"type":"ticks","broker":"zerodha","ticks":[{"instrument_token":260105,"ltp":150.25,...}]}
```

---

## 11. Kite Connect API Reference

| Endpoint | Method | Description |
|---|---|---|
| `https://kite.zerodha.com/connect/login?v=3&api_key=…` | GET | OAuth login redirect |
| `https://api.kite.trade/session/token` | POST | Exchange `request_token` → `access_token` |
| `https://api.kite.trade/instruments/NFO` | GET | All NFO instruments (CSV) |
| `https://api.kite.trade/quote?i=NFO:…` | GET | Full quote (up to 500) |
| `https://api.kite.trade/quote/ltp?i=NSE:…` | GET | Last traded price only |
| `https://api.kite.trade/quote/ohlc?i=NFO:…` | GET | OHLC + LTP |
| `wss://ws.kite.trade?api_key=…&access_token=…` | WS | Binary live tick stream |

**Official docs:** [kite.trade/docs/connect/v3](https://kite.trade/docs/connect/v3/websocket/)

---

*Last updated: March 2026 — OPTIX v1.0*

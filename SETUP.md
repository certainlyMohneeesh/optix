# OPTIX — Option Chain Dashboard: Setup Guide

> Full step-by-step instructions to connect Zerodha Kite Connect and/or Upstox APIs, configure Supabase, and run the live option chain dashboard.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install dependencies](#2-install-dependencies)
3. [Supabase setup (PostgreSQL)](#3-supabase-setup)
4. [Upstox API setup](#4-upstox-api-setup)
5. [Zerodha Kite Connect setup](#5-zerodha-kite-connect-setup)
6. [Environment variables](#6-environment-variables)
7. [WebSocket proxy server](#7-websocket-proxy-server)
8. [Run the app](#8-run-the-app)
9. [Daily token refresh (Zerodha)](#9-daily-token-refresh-zerodha)
10. [Production deployment](#10-production-deployment)
11. [Broker comparison](#11-broker-comparison)

---

## 1. Prerequisites

| Tool | Minimum version |
|------|----------------|
| [Bun](https://bun.sh) | 1.1.x |
| Node.js (fallback) | 18 LTS |
| Git | any |

Install Bun (if not already):
```bash
curl -fsSL https://bun.sh/install | bash
```

---

## 2. Install dependencies

```bash
cd opchain
bun install
```

This installs Next.js, React, shadcn/ui, Supabase, recharts, date-fns, ws, and all dev deps.

---

## 3. Supabase Setup

### 3.1 Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project** — pick a region close to India (e.g. `ap-south-1`).
3. Note your **Project URL** and **Anon public key** from  
   `Project Settings → API`.

### 3.2 Run the schema

1. Go to **SQL Editor** in the Supabase dashboard.
2. Open `supabase/schema.sql` from this repo.
3. Paste the contents and click **Run**.

This creates the `option_chain_snapshots` table with RLS policies already enabled.

### 3.3 (Optional) Enable Realtime

To receive live snapshot updates from other clients:

1. Go to **Database → Replication**.
2. Enable replication on `option_chain_snapshots`.

---

## 4. Upstox API Setup

Upstox is **free** for retail users and offers a modern REST + WebSocket API.

### 4.1 Register your app

1. Visit [https://developer.upstox.com/](https://developer.upstox.com/).
2. Sign in with your Upstox trading account.
3. Click **Create Application**.
4. Fill in:
   - **App Name**: OPTIX (or anything)
   - **Redirect URL**: `http://localhost:3000/api/auth/upstox/callback`
   - **Product**: Market Feeds + Order API
5. Submit — you'll receive a **Client ID** and **Client Secret**.

### 4.2 Obtain an access token

Start the dev server, then navigate to:
```
http://localhost:3000/api/auth/upstox/login
```

You'll be redirected to Upstox's OAuth page — log in and authorise.  
The callback handler exchanges the code for an access token and sets it as a cookie.

**Alternatively**, paste a token manually in `.env.local`:
```env
UPSTOX_ACCESS_TOKEN=your_token_here
```

### 4.3 Token lifetime

Upstox tokens are valid for **one trading day** (expire at midnight IST). Run the login flow each morning.

---

## 5. Zerodha Kite Connect Setup

> **Cost**: ₹2000/month (+GST). You need an active Zerodha account.

### 5.1 Register your app

1. Visit [https://developers.kite.trade/apps](https://developers.kite.trade/apps).
2. Click **Create new app → Connect**.
3. Fill in:
   - **App name**: OPTIX
   - **Redirect URL**: `http://localhost:3000/api/auth/zerodha/callback`
4. Submit — you'll receive an **API Key** and **API Secret**.

### 5.2 Obtain a daily access token

Start the dev server, then:
```
http://localhost:3000/api/auth/zerodha/login
```

Log in via Kite, authorise, and the callback handler will:
1. Receive the `request_token`.
2. Compute SHA-256 checksum of `api_key + request_token + api_secret`.
3. Exchange it for an `access_token`.
4. Store it in a cookie.

### 5.3 Daily automation

Zerodha tokens expire **every midnight**. Automate the flow with a cron job, or  
come back to `/api/auth/zerodha/login` each morning.

---

## 6. Environment variables

Copy the example file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Upstox
UPSTOX_CLIENT_ID=abc123
UPSTOX_CLIENT_SECRET=xxxxx
UPSTOX_REDIRECT_URI=http://localhost:3000/api/auth/upstox/callback
UPSTOX_ACCESS_TOKEN=          # leave blank to use OAuth flow

# Zerodha
ZERODHA_API_KEY=xxxxxxxx
ZERODHA_API_SECRET=xxxxxxxxxx
ZERODHA_ACCESS_TOKEN=         # leave blank to use OAuth flow

# WebSocket
NEXT_PUBLIC_WS_SERVER_URL=ws://localhost:8080
WS_PORT=8080
```

> If **no credentials** are set for a broker, the app automatically falls back to **Demo Mode** with simulated realistic data — you can still explore all UI features without an API key.

---

## 7. WebSocket Proxy Server

The WS server (`ws-server/index.ts`) is a lightweight Bun/Node.js process that:
- Connects to **Upstox v3 Market Feed** (protobuf) or **Zerodha KiteTicker**
- Normalises ticks to simple `{instrument_key, ltp, oi, volume}` JSON objects
- Broadcasts to all connected browser clients via a local WS server

### Start the WS server

```bash
# Option A — using root package.json script (recommended)
bun run ws

# Option B — directly
bun run ws-server/index.ts
```

The server listens on `ws://localhost:8080` by default (configure via `WS_PORT`).

### Environment variables for WS server

The WS server reads from `.env.local` automatically when run via Bun.

---

## 8. Run the App

### Development

Open **two terminals**:

**Terminal 1 — WS server:**
```bash
bun run ws
```

**Terminal 2 — Next.js:**
```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production

```bash
bun run build
bun run start
```

---

## 9. Daily Token Refresh (Zerodha)

Because KiteConnect access tokens expire each night, set up a simple cron:

```bash
# Example: add to crontab (run `crontab -e`)
# Refresh Zerodha token every morning at 08:30 IST (03:00 UTC)
0 3 * * 1-5 curl -s http://localhost:3000/api/auth/zerodha/login
```

Or manually visit `/api/auth/zerodha/login` before market open.

---

## 10. Production Deployment

### Deploy on Vercel

```bash
bunx vercel
```

- Add all environment variables via the Vercel dashboard.
- Change `UPSTOX_REDIRECT_URI` / Kite redirect to your production domain.
- The **WS server** cannot run inside Vercel (serverless) — host it separately:

### WS server on a VPS / Railway

```bash
# On your server
git clone ...
cd opchain/ws-server
bun install
bun run start
```

Set `NEXT_PUBLIC_WS_SERVER_URL=wss://your-ws-server.example.com` in Vercel env vars and re-deploy.

---

## 11. Broker Comparison

| Feature | Upstox | Zerodha Kite Connect |
|---|---|---|
| **Cost** | Free | ₹2000/month |
| **API quality** | REST + WebSocket v3 | REST + WebSocket |
| **OI data** | ✅ Full chain OI | ✅ Full chain OI |
| **Greeks in API** | ✅ Built-in | ❌ Must compute locally |
| **WebSocket feed** | v3 Protobuf (fast) | Binary tick (fast) |
| **Market data latency** | ~100ms | ~100ms |
| **Token expiry** | Daily (midnight) | Daily (midnight) |
| **Instruments** | JSON catalog | CSV download |
| **Recommendation** | Start here | If already Zerodha user |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Demo mode" banner always shows | Set `UPSTOX_ACCESS_TOKEN` or run OAuth login flow |
| WS status shows "disconnected" | Make sure `bun run ws` is running in a separate terminal |
| Supabase snapshots not saving | Check anon key and that RLS policies from schema.sql were applied |
| Zerodha 403 invalid checksum | API secret is wrong or token already expired — re-login |
| Build fails on types | Run `bun install` to ensure all `@types/*` are present |

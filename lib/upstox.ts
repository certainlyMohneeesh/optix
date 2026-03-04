// ─────────────────────────────────────────────────────────────────────────────
//  UPSTOX — REST API + WebSocket helpers + response mappers
//  Base URL : https://api.upstox.com/v2
//  Auth     : OAuth2 Bearer token
// ─────────────────────────────────────────────────────────────────────────────
import type { ChainRow, OptionLeg, UpstoxOptionChainItem, UpstoxTick, Symbol } from "./types";
import { UPSTOX_INSTRUMENTS } from "./mock-data";
import { expiryToAPI } from "./formatters";

const UPSTOX_BASE = "https://api.upstox.com";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Convert YYYY-MM-DD (Upstox API) → DD-Mon-YYYY (display) */
function apiDateToDisplay(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}-${MONTHS_SHORT[Number(m) - 1]}-${y}`;
}

/** Fetch available option expiry dates for a symbol from Upstox API */
export async function fetchUpstoxExpiries(
  symbol: Symbol,
  accessToken: string
): Promise<string[]> {
  const instrumentKey = UPSTOX_INSTRUMENTS[symbol];
  const url = `${UPSTOX_BASE}/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 300 }, // cache 5 min — expiry list changes rarely during the day
  });
  if (!res.ok) throw new Error(`Upstox expiries ${res.status}: ${await res.text()}`);
  const json = await res.json();
  // Response: { data: [ { expiry: "2026-03-06", instrument_key: "...", ... }, ... ] }
  // Extract unique expiry date strings and deduplicate
  const contracts: Array<Record<string, unknown>> = (json.data ?? []) as Array<Record<string, unknown>>;
  if (!contracts.length) return [];
  const uniqueDates = [...new Set(contracts.map((c) => c.expiry as string))].sort();
  return uniqueDates.map(apiDateToDisplay);
}

// ── Map a single option's API payload → OptionLeg ────────────────────────────
const mapLeg = (
  side: UpstoxOptionChainItem["call_options"] | UpstoxOptionChainItem["put_options"]
): OptionLeg => {
  const md = side.market_data;
  const g  = side.option_greeks;
  const ltp = md.ltp;
  const prevOI = md.prev_oi ?? Math.round(md.oi * 0.9);
  const oi_change = md.oi - prevOI;
  return {
    instrument_key: side.instrument_key,
    ltp,
    bid_price: md.bid_price,
    ask_price: md.ask_price,
    oi: md.oi,
    prev_oi: prevOI,
    oi_change,
    oi_change_pct: prevOI > 0 ? +((oi_change / prevOI) * 100).toFixed(2) : 0,
    volume: md.volume,
    ltp_volume: +(ltp * md.volume).toFixed(0),
    iv: g.iv,
    delta: g.delta,
    gamma: g.gamma,
    theta: g.theta,
    vega: g.vega,
    day_high: md.high,
    day_low: md.low,
  };
};

/** Map Upstox /option/chain response → ChainRow[] */
export const mapUpstoxChain = (raw: UpstoxOptionChainItem[]): ChainRow[] =>
  raw.map((item) => ({
    strike: item.strike_price,
    call: mapLeg(item.call_options),
    put:  mapLeg(item.put_options),
  }));

// ── Fetch option chain from Upstox (server-side only) ────────────────────────
export async function fetchUpstoxChain(
  symbol: Symbol,
  expiry: string, // display format: "27-Feb-2026"
  accessToken: string
): Promise<{ chain: ChainRow[]; spot: number }> {
  const instrumentKey = UPSTOX_INSTRUMENTS[symbol];
  const expiryDate    = expiryToAPI(expiry); // → "2026-02-27"
  const url =
    `${UPSTOX_BASE}/v2/option/chain` +
    `?instrument_key=${encodeURIComponent(instrumentKey)}` +
    `&expiry_date=${expiryDate}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 }, // always fresh
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upstox API ${res.status}: ${body}`);
  }
  const json = await res.json();
  const items = (json.data ?? []) as UpstoxOptionChainItem[];
  console.log(`[upstox chain] ${symbol} ${expiryDate} → ${items.length} rows (status: ${json.status})`);
  if (items.length === 0) {
    console.warn(`[upstox chain] Full response:`, JSON.stringify(json).slice(0, 500));
  }
  // Extract underlying spot from the first item (most reliable — avoids a separate API call)
  const spot: number = items[0]?.underlying_spot_price ?? 0;
  return { chain: mapUpstoxChain(items), spot };
}

/** Fetch spot (LTP) for an index via Upstox market-quote/ltp as fallback */
export async function fetchUpstoxSpot(
  symbol: Symbol,
  accessToken: string
): Promise<number> {
  const key = UPSTOX_INSTRUMENTS[symbol];
  const url =
    `${UPSTOX_BASE}/v2/market-quote/ltp` +
    `?instrument_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Upstox spot ${res.status}`);
  const json = await res.json();
  // Upstox returns data keyed by the instrument key with '|' replaced by ':'
  // and spaces preserved, e.g. "NSE_INDEX:Nifty 50"
  const data = json?.data ?? {};
  const keys = Object.keys(data);
  console.log(`[upstox spot] response keys:`, keys, `(looked for: ${key})`);
  // Try both separator styles
  const v =
    data[key] ??
    data[key.replace("|", ":")] ??
    data[key.replace("|", "_")] ??
    data[keys[0]]; // fallback: just take the first key
  return v?.last_price ?? 0;
}

/**
 * Get the WS auth URL from Upstox (v3 market-data-feed/authorize).
 * Call this server-side and pass the URL to the frontend.
 */
export async function getUpstoxWsUrl(accessToken: string): Promise<string> {
  const res = await fetch(
    `${UPSTOX_BASE}/v3/feed/market-data-feed/authorize`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Upstox WS auth ${res.status}`);
  const json = await res.json();
  return json?.data?.authorizedRedirectUri as string;
}

/**
 * Merge live ticks into an existing chain (pure function → returns new array).
 * Each tick carries last_price, oi, volume.
 */
export const applyUpstoxTicks = (
  chain: ChainRow[],
  ticks: UpstoxTick[]
): ChainRow[] => {
  const tickMap = new Map(ticks.map((t) => [t.instrument_key, t]));
  return chain.map((row) => {
    const ct = tickMap.get(row.call.instrument_key);
    const pt = tickMap.get(row.put.instrument_key);
    return {
      ...row,
      call: ct ? applyTick(row.call, ct) : row.call,
      put:  pt ? applyTick(row.put,  pt) : row.put,
    };
  });
};

const applyTick = (leg: OptionLeg, tick: UpstoxTick): OptionLeg => {
  const ltp    = tick.ltp;
  const oi     = tick.oi;
  const volume = tick.volume;
  const oi_change = oi - leg.prev_oi;
  return {
    ...leg,
    ltp,
    bid_price: tick.bid_price ?? leg.bid_price,
    ask_price: tick.ask_price ?? leg.ask_price,
    oi,
    oi_change,
    oi_change_pct: leg.prev_oi > 0 ? +((oi_change / leg.prev_oi) * 100).toFixed(2) : 0,
    volume,
    ltp_volume: +(ltp * volume).toFixed(0),
    iv:    tick.iv    ?? leg.iv,
    delta: tick.delta ?? leg.delta,
    gamma: tick.gamma ?? leg.gamma,
    theta: tick.theta ?? leg.theta,
    vega:  tick.vega  ?? leg.vega,
  };
};

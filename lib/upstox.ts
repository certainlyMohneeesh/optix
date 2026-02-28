// ─────────────────────────────────────────────────────────────────────────────
//  UPSTOX — REST API + WebSocket helpers + response mappers
//  Base URL : https://api.upstox.com/v2
//  Auth     : OAuth2 Bearer token
// ─────────────────────────────────────────────────────────────────────────────
import type { ChainRow, OptionLeg, UpstoxOptionChainItem, UpstoxTick, Symbol } from "./types";
import { UPSTOX_INSTRUMENTS } from "./mock-data";
import { expiryToAPI } from "./formatters";

const UPSTOX_BASE = "https://api.upstox.com";

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
): Promise<ChainRow[]> {
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
  // json.data = UpstoxOptionChainItem[]
  return mapUpstoxChain((json.data ?? []) as UpstoxOptionChainItem[]);
}

/** Fetch spot (LTP) for an index via Upstox market-quote */
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
  // ltp is nested under the instrument key (with | replaced by _)
  const safeKey = key.replace("|", "_");
  return json?.data?.[safeKey]?.last_price ?? 0;
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

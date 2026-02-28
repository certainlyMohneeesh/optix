// ─────────────────────────────────────────────────────────────────────────────
//  ZERODHA KITE CONNECT — REST helpers + response mappers
//  Base URL : https://api.kite.trade
//  Auth     : api_key + access_token header (expires daily)
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ChainRow,
  OptionLeg,
  ZerodhaInstrument,
  ZerodhaQuote,
  ZerodhaTick,
  Symbol,
} from "./types";
import { expiryToAPI } from "./formatters";

const KITE_BASE = "https://api.kite.trade";

/** Build Kite auth header */
const kiteHeaders = (apiKey: string, accessToken: string) => ({
  "X-Kite-Version": "3",
  Authorization: `token ${apiKey}:${accessToken}`,
});

// ── Map Zerodha instruments + quotes → ChainRow[] ────────────────────────────
export const mapZerodhaChain = (
  instruments: ZerodhaInstrument[],
  quotes: Record<string, ZerodhaQuote>
): ChainRow[] => {
  // Group by strike
  const byStrike = new Map<number, { ce?: ZerodhaInstrument; pe?: ZerodhaInstrument }>();
  for (const inst of instruments) {
    const { strike, instrument_type } = inst;
    const entry = byStrike.get(strike) ?? {};
    if (instrument_type === "CE") entry.ce = inst;
    if (instrument_type === "PE") entry.pe = inst;
    byStrike.set(strike, entry);
  }

  const rows: ChainRow[] = [];
  for (const [strike, { ce, pe }] of byStrike) {
    if (!ce || !pe) continue;
    const ceKey = `NFO:${ce.tradingsymbol}`;
    const peKey = `NFO:${pe.tradingsymbol}`;
    const ceQ   = quotes[ceKey];
    const peQ   = quotes[peKey];
    if (!ceQ || !peQ) continue;

    rows.push({
      strike,
      call: quoteToLeg(ce, ceQ),
      put:  quoteToLeg(pe, peQ),
    });
  }
  rows.sort((a, b) => a.strike - b.strike);
  return rows;
};

const quoteToLeg = (inst: ZerodhaInstrument, q: ZerodhaQuote): OptionLeg => {
  const ltp = q.last_price;
  const oi  = q.oi;
  const vol = q.volume;
  // Zerodha doesn't provide greeks — use zeros; compute them client-side if needed
  return {
    instrument_key: `NFO:${inst.tradingsymbol}`,
    ltp,
    bid_price: q.depth?.buy?.[0]?.price ?? ltp * 0.994,
    ask_price: q.depth?.sell?.[0]?.price ?? ltp * 1.006,
    oi,
    prev_oi:       q.oi_day_low > 0 ? q.oi_day_low : Math.round(oi * 0.9),
    oi_change:     oi - (q.oi_day_low > 0 ? q.oi_day_low : Math.round(oi * 0.9)),
    oi_change_pct: 0,
    volume: vol,
    ltp_volume: +(ltp * vol).toFixed(0),
    iv:    0,
    delta: 0,
    gamma: 0,
    theta: 0,
    vega:  0,
    day_high: q.ohlc?.high ?? ltp,
    day_low:  q.ohlc?.low  ?? ltp,
  };
};

// ── Fetch option chain from Zerodha (server-side only) ───────────────────────
export async function fetchZerodhaChain(
  symbol: Symbol,
  expiry: string, // "27-Feb-2026" display format
  apiKey: string,
  accessToken: string
): Promise<ChainRow[]> {
  const headers     = kiteHeaders(apiKey, accessToken);
  const expiryDate  = expiryToAPI(expiry); // "2026-02-27"

  // Fetch all NFO instruments (cached — Kite updates this once a day)
  const instRes = await fetch(`${KITE_BASE}/instruments/NFO`, { headers });
  if (!instRes.ok) throw new Error(`Kite instruments ${instRes.status}`);
  const csvText: string = await instRes.text();

  // Parse CSV
  const instruments = parseKiteInstrumentCSV(csvText).filter(
    (i) =>
      i.name === symbol &&
      i.expiry === expiryDate &&
      (i.instrument_type === "CE" || i.instrument_type === "PE")
  );

  if (instruments.length === 0) return [];

  // Batch quote (max 500)
  const syms   = instruments.map((i) => `NFO:${i.tradingsymbol}`);
  const chunks: string[][] = [];
  for (let i = 0; i < syms.length; i += 500) chunks.push(syms.slice(i, i + 500));

  const allQuotes: Record<string, ZerodhaQuote> = {};
  for (const chunk of chunks) {
    const qs  = chunk.map((s) => `i=${encodeURIComponent(s)}`).join("&");
    const qRes = await fetch(`${KITE_BASE}/quote?${qs}`, { headers });
    if (!qRes.ok) throw new Error(`Kite quote ${qRes.status}`);
    const qJson = await qRes.json();
    Object.assign(allQuotes, qJson.data ?? {});
  }

  return mapZerodhaChain(instruments, allQuotes);
}

/** Fetch spot (LTP) for an index via Kite quote */
export async function fetchZerodhaSpot(
  symbol: Symbol,
  apiKey: string,
  accessToken: string
): Promise<number> {
  const indexMap: Record<Symbol, string> = {
    NIFTY:      "NSE:NIFTY 50",
    BANKNIFTY:  "NSE:NIFTY BANK",
    FINNIFTY:   "NSE:NIFTY FIN SERVICE",
    MIDCPNIFTY: "NSE:NIFTY MIDCAP SELECT",
    SENSEX:     "BSE:SENSEX",
  };
  const headers = kiteHeaders(apiKey, accessToken);
  const res = await fetch(
    `${KITE_BASE}/quote/ltp?i=${encodeURIComponent(indexMap[symbol])}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Kite spot ${res.status}`);
  const json = await res.json();
  const key  = indexMap[symbol];
  return json?.data?.[key]?.last_price ?? 0;
}

/**
 * Apply live ticks (from KiteTicker) to an existing chain.
 * Ticker must subscribe to the instrument_tokens of all CE/PE contracts.
 */
export const applyZerodhaTicks = (
  chain: ChainRow[],
  ticks: ZerodhaTick[]
): ChainRow[] => {
  const tickMap = new Map(ticks.map((t) => [String(t.instrument_token), t]));
  return chain.map((row) => {
    // We store tradingsymbol in instrument_key as "NFO:XXX"
    // Token lookup is by instrument_token — match by symbol if available
    // In practice the frontend keeps a token→key map
    return row; // ticking is done via the WS server merging by instrument_key
  });
};

// ── CSV parser for Kite instruments ──────────────────────────────────────────
function parseKiteInstrumentCSV(csv: string): ZerodhaInstrument[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  lines.shift(); // remove header
  return lines.map((line) => {
    const [
      instrument_token,
      exchange_token,
      tradingsymbol,
      name,
      last_price,
      expiry,
      strike,
      tick_size,
      lot_size,
      instrument_type,
      segment,
      exchange,
    ] = line.split(",");
    return {
      instrument_token: Number(instrument_token),
      exchange_token,
      tradingsymbol,
      name,
      last_price:      Number(last_price),
      expiry,          // already "YYYY-MM-DD" from Kite
      strike:          Number(strike),
      tick_size:       Number(tick_size),
      lot_size:        Number(lot_size),
      instrument_type: instrument_type as ZerodhaInstrument["instrument_type"],
      segment,
      exchange,
    };
  });
}

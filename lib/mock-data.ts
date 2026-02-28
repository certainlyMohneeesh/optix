// ─────────────────────────────────────────────────────────────────────────────
//  MOCK DATA — Mirrors real Upstox / Zerodha response shapes
//  Used when no API credentials are configured (demo mode)
// ─────────────────────────────────────────────────────────────────────────────
import type { ChainRow, OptionLeg, Symbol } from "./types";

export const SYMBOLS: Symbol[] = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX"];

export const SPOT_BASE: Record<Symbol, number> = {
  NIFTY:      22487.5,
  BANKNIFTY:  48312.3,
  FINNIFTY:   23841.6,
  MIDCPNIFTY: 12543.2,
  SENSEX:     73842.5,
};

export const STEPS: Record<Symbol, number> = {
  NIFTY:      50,
  BANKNIFTY:  100,
  FINNIFTY:   50,
  MIDCPNIFTY: 25,
  SENSEX:     100,
};

/** Upstox instrument key format */
export const UPSTOX_INSTRUMENTS: Record<Symbol, string> = {
  NIFTY:      "NSE_INDEX|Nifty 50",
  BANKNIFTY:  "NSE_INDEX|Nifty Bank",
  FINNIFTY:   "NSE_INDEX|Nifty Fin Service",
  MIDCPNIFTY: "NSE_INDEX|Nifty Midcap Select",
  SENSEX:     "BSE_INDEX|SENSEX",
};

export const EXPIRIES: Record<Symbol, string[]> = {
  NIFTY:      ["27-Feb-2026","06-Mar-2026","13-Mar-2026","27-Mar-2026","24-Apr-2026"],
  BANKNIFTY:  ["26-Feb-2026","04-Mar-2026","11-Mar-2026","25-Mar-2026"],
  FINNIFTY:   ["25-Feb-2026","04-Mar-2026","25-Mar-2026"],
  MIDCPNIFTY: ["31-Mar-2026","28-Apr-2026"],
  SENSEX:     ["28-Feb-2026","31-Mar-2026"],
};

// ── Mock single option leg ────────────────────────────────────────────────────
const mockLeg = (spot: number, strike: number, isCall: boolean): OptionLeg => {
  const offset   = (strike - spot) / (spot * 0.005);
  const money    = isCall ? -offset : offset;
  const baseOI   = Math.max(500, Math.round(
    (1 - Math.abs(offset) * 0.15) * (isCall ? 920_000 : 840_000) +
    Math.random() * 60_000
  ));
  const prevOI   = Math.round(baseOI * (0.82 + Math.random() * 0.36));
  const iv       = +(13 + Math.abs(offset) * 1.6 + (money < 0 ? 1.8 : 0) + Math.random() * 1.5).toFixed(2);
  const ltp      = Math.max(
    0.05,
    +(Math.pow(Math.max(0, money * 55 + 110), 0.88) * (1 + Math.random() * 0.08)).toFixed(2)
  );
  const volume   = Math.round(baseOI * 0.14 * (1 + Math.random()));
  const delta    = isCall
    ? +Math.min(0.99, Math.max(0.01, 0.5 - offset * 0.09 + (Math.random() - 0.5) * 0.02)).toFixed(3)
    : +Math.max(-0.99, Math.min(-0.01, -(0.5 + offset * 0.09 + (Math.random() - 0.5) * 0.02))).toFixed(3);
  const gamma    = +(0.0022 / (1 + Math.abs(offset) * 0.55) + Math.random() * 0.0004).toFixed(5);
  const theta    = +(-0.55 - Math.abs(offset) * 0.09 - Math.random() * 0.18).toFixed(3);
  const vega     = +(9.2 - Math.abs(offset) * 0.6 + Math.random()).toFixed(3);

  return {
    instrument_key: `NFO_OPT|${isCall ? "CE" : "PE"}_${strike}`,
    ltp,
    bid_price: +(ltp * 0.994).toFixed(2),
    ask_price: +(ltp * 1.006).toFixed(2),
    oi: baseOI,
    prev_oi: prevOI,
    oi_change: baseOI - prevOI,
    oi_change_pct: +(((baseOI - prevOI) / Math.max(1, prevOI)) * 100).toFixed(2),
    volume,
    ltp_volume: +(ltp * volume).toFixed(0),
    iv,
    delta,
    gamma,
    theta,
    vega,
    day_high: +(ltp * 1.08 + Math.random() * 5).toFixed(2),
    day_low:  +(ltp * 0.88 - Math.random() * 3).toFixed(2),
  };
};

/** Build a full mock chain for `symbol` (23 strikes around ATM) */
export const buildMockChain = (symbol: Symbol): ChainRow[] => {
  const spot = SPOT_BASE[symbol] * (1 + (Math.random() - 0.5) * 0.002);
  const step = STEPS[symbol];
  const atm  = Math.round(spot / step) * step;
  return Array.from({ length: 23 }, (_, i) => {
    const strike = atm + (i - 11) * step;
    return { strike, call: mockLeg(spot, strike, true), put: mockLeg(spot, strike, false) };
  });
};

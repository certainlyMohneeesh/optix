// ─────────────────────────────────────────────────────────────────────────────
//  OPTION CHAIN — CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────
import type { ChainRow, ChainAnalytics } from "./types";

/** Put-Call Ratio by Open Interest */
export const calcPCR = (chain: ChainRow[]): number => {
  const putOI  = chain.reduce((s, r) => s + (r.put?.oi ?? 0), 0);
  const callOI = chain.reduce((s, r) => s + (r.call?.oi ?? 0), 0);
  return callOI > 0 ? +(putOI / callOI).toFixed(3) : 0;
};

/** Max-pain strike — minimises total option writer loss */
export const calcMaxPain = (chain: ChainRow[]): number => {
  let min = Infinity;
  let mpStrike = 0;
  for (const { strike: expiry } of chain) {
    const pain = chain.reduce((sum, { strike, call, put }) => {
      const callPain = strike < expiry ? (expiry - strike) * (call?.oi ?? 0) : 0;
      const putPain  = strike > expiry ? (strike - expiry) * (put?.oi ?? 0)  : 0;
      return sum + callPain + putPain;
    }, 0);
    if (pain < min) { min = pain; mpStrike = expiry; }
  }
  return mpStrike;
};

/**
 * IV Skew — difference between 1-step OTM put IV and 1-step OTM call IV.
 * Positive = put skew (bearish protection premium), negative = call skew.
 */
export const calcIVSkew = (chain: ChainRow[], atm: number, step: number): number => {
  const otmCall = chain.find((r) => r.strike === atm + step);
  const otmPut  = chain.find((r) => r.strike === atm - step);
  if (!otmCall || !otmPut) return 0;
  return +(otmPut.put.iv - otmCall.call.iv).toFixed(2);
};

/** Compute all derived analytics from a chain snapshot */
export const computeAnalytics = (
  chain: ChainRow[],
  spot: number,
  step: number
): ChainAnalytics => {
  const atm = Math.round(spot / step) * step;
  return {
    pcr:              calcPCR(chain),
    maxPain:          calcMaxPain(chain),
    ivSkew:           calcIVSkew(chain, atm, step),
    totalCallOI:      chain.reduce((s, r) => s + (r.call?.oi ?? 0), 0),
    totalPutOI:       chain.reduce((s, r) => s + (r.put?.oi ?? 0), 0),
    totalCallVolume:  chain.reduce((s, r) => s + (r.call?.volume ?? 0), 0),
    totalPutVolume:   chain.reduce((s, r) => s + (r.put?.volume ?? 0), 0),
    maxCallOI:        Math.max(...chain.map((r) => r.call?.oi ?? 0), 1),
    maxPutOI:         Math.max(...chain.map((r) => r.put?.oi ?? 0), 1),
    maxLtpVolume:     Math.max(
      ...chain.flatMap((r) => [r.call?.ltp_volume ?? 0, r.put?.ltp_volume ?? 0]),
      1
    ),
  };
};

/** Filter chain rows by ITM/OTM/ATM */
export const filterChain = (
  chain: ChainRow[],
  spot: number,
  step: number,
  filter: "all" | "itm" | "otm" | "atm"
): ChainRow[] => {
  const atm = Math.round(spot / step) * step;
  if (filter === "atm") return chain.filter((r) => Math.abs(r.strike - atm) <= step * 2);
  if (filter === "itm") return chain.filter((r) => r.strike < spot);
  if (filter === "otm") return chain.filter((r) => r.strike > spot);
  return chain;
};

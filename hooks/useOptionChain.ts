"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  useOptionChain — manages chain data, broker selection, refresh logic
//  and Supabase snapshot persistence
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { buildMockChain, SPOT_BASE, STEPS, EXPIRIES } from "@/lib/mock-data";
import { computeAnalytics } from "@/lib/calculations";
import { saveSnapshot } from "@/lib/supabase";
import type {
  Broker,
  ChainRow,
  ChainAnalytics,
  Symbol,
  ConnectionStatus,
  FilterKey,
  MetricKey,
  ViewTab,
} from "@/lib/types";

export interface UseOptionChainReturn {
  // Data
  chain:     ChainRow[];
  spot:      number;
  analytics: ChainAnalytics;
  // UI state
  broker:    Broker;
  symbol:    Symbol;
  expiry:    string;
  expiries:  string[];   // live list from API, falls back to computed
  tab:       ViewTab;
  metric:    MetricKey;
  filter:    FilterKey;
  liveMode:  boolean;
  connStatus: ConnectionStatus;
  lastTs:    Date;
  tickAnim:  boolean;
  // Actions
  setBroker:    (b: Broker) => void;
  setSymbol:    (s: Symbol) => void;
  setExpiry:    (e: string) => void;
  setTab:       (t: ViewTab) => void;
  setMetric:    (m: MetricKey) => void;
  setFilter:    (f: FilterKey) => void;
  setLiveMode:  (v: boolean) => void;
  refresh:      () => Promise<void>;
  applyTicks:   (ticks: Array<{ instrument_key: string; ltp: number; oi: number; volume: number }>) => void;
  setConnStatus: (s: ConnectionStatus) => void;
}

export function useOptionChain(): UseOptionChainReturn {
  const [broker,     setBrokerRaw]   = useState<Broker>("upstox");
  const [symbol,     setSymbolRaw]   = useState<Symbol>("NIFTY");
  const [expiry,     setExpiryRaw]   = useState<string>(EXPIRIES["NIFTY"][0]);
  const [expiries,   setExpiries]    = useState<string[]>(EXPIRIES["NIFTY"]);
  const [chain,      setChain]       = useState<ChainRow[]>([]);
  const [spot,       setSpot]        = useState<number>(SPOT_BASE["NIFTY"]);
  const [analytics,  setAnalytics]   = useState<ChainAnalytics>({
    pcr: 0, maxPain: 0, ivSkew: 0,
    totalCallOI: 0, totalPutOI: 0, totalCallVolume: 0, totalPutVolume: 0,
    maxCallOI: 1, maxPutOI: 1, maxLtpVolume: 1,
  });
  const [tab,        setTab]         = useState<ViewTab>("chain");
  const [metric,     setMetric]      = useState<MetricKey>("oi");
  const [filter,     setFilter]      = useState<FilterKey>("all");
  const [liveMode,   setLiveMode]    = useState(false);
  const [connStatus, setConnStatus]  = useState<ConnectionStatus>("demo");
  const [lastTs,     setLastTs]      = useState<Date>(new Date());
  const [tickAnim,   setTickAnim]    = useState(false);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks WS connection status so REST refresh doesn't downgrade it
  const wsStatusRef  = useRef<ConnectionStatus>("demo");

  const setConnStatusSafe = useCallback((s: ConnectionStatus) => {
    wsStatusRef.current = s;
    setConnStatus(s);
  }, []);

  // ── Derived update helpers ──────────────────────────────────────────────────
  const updateChain = useCallback(
    (newChain: ChainRow[], newSpot: number) => {
      setChain(newChain);
      setSpot(newSpot);
      setAnalytics(computeAnalytics(newChain, newSpot, STEPS[symbol]));
      setLastTs(new Date());
      setTickAnim(true);
      setTimeout(() => setTickAnim(false), 400);
    },
    [symbol]
  );

  // ── Refresh from API (or mock) ──────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/option-chain/${broker}?symbol=${symbol}&expiry=${encodeURIComponent(expiry)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newChain: ChainRow[] = data.chain ?? buildMockChain(symbol);
      const newSpot: number      = data.spot  ?? SPOT_BASE[symbol];
      const source: string       = data.source ?? "mock";
      // Only set REST-derived status if WS is not actively connected/reconnecting
      const wsLive = wsStatusRef.current === "connected" || wsStatusRef.current === "reconnecting";
      if (!wsLive) {
        setConnStatus(source === "mock" ? "demo" : "connected");
      }
      updateChain(newChain, newSpot);
      // Persist snapshot (non-blocking)
      if (source !== "mock") {
        const step = STEPS[symbol];
        const a    = computeAnalytics(newChain, newSpot, step);
        saveSnapshot({
          broker,
          symbol,
          expiry,
          spot:          newSpot,
          chain_data:    newChain,
          pcr:           a.pcr,
          max_pain:      a.maxPain,
          total_call_oi: a.totalCallOI,
          total_put_oi:  a.totalPutOI,
        }).catch(() => {});
      }
    } catch (e) {
      console.error("[useOptionChain] refresh error:", e);
      const wsLive = wsStatusRef.current === "connected" || wsStatusRef.current === "reconnecting";
      if (!wsLive) setConnStatus("error");
      // Fall back to mock
      const mock = buildMockChain(symbol);
      updateChain(mock, SPOT_BASE[symbol]);
    }
  }, [broker, symbol, expiry, updateChain]);

  // ── Apply live ticks from WebSocket ────────────────────────────────────────
  const applyTicks = useCallback(
    (ticks: Array<{ instrument_key: string; ltp: number; oi: number; volume: number }>) => {
      setChain((prev) => {
        if (!prev.length) return prev;
        const tickMap = new Map(ticks.map((t) => [t.instrument_key, t]));
        const updated = prev.map((row) => {
          const ct = tickMap.get(row.call.instrument_key);
          const pt = tickMap.get(row.put.instrument_key);
          const call = ct
            ? { ...row.call, ltp: ct.ltp, oi: ct.oi, volume: ct.volume, ltp_volume: +(ct.ltp * ct.volume).toFixed(0) }
            : row.call;
          const put = pt
            ? { ...row.put, ltp: pt.ltp, oi: pt.oi, volume: pt.volume, ltp_volume: +(pt.ltp * pt.volume).toFixed(0) }
            : row.put;
          return { ...row, call, put };
        });
        // Recompute analytics
        setAnalytics(computeAnalytics(updated, spot, STEPS[symbol]));
        return updated;
      });
      setTickAnim(true);
      setTimeout(() => setTickAnim(false), 400);
    },
    [spot, symbol]
  );

  // ── Side effects ─────────────────────────────────────────────────────────────
  // Reset expiry when symbol changes
  useEffect(() => {
    const computed = EXPIRIES[symbol];
    setExpiryRaw(computed[0]);
    setSpot(SPOT_BASE[symbol]);
    setExpiries(computed);
    // Fetch live expiries from API (replaces computed list when authenticated)
    fetch(`/api/expiries/upstox?symbol=${symbol}`)
      .then((r) => r.json())
      .then(({ expiries: live }: { expiries: string[] }) => {
        if (live?.length) {
          setExpiries(live);
          setExpiryRaw((prev) => (live.includes(prev) ? prev : live[0]));
        }
      })
      .catch(() => {}); // silently fall back to computed
  }, [symbol]);

  // Initial load + reload on key changes
  useEffect(() => { refresh(); }, [symbol, expiry, broker]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live polling (fallback when WS is not connected)
  useEffect(() => {
    if (liveMode) {
      intervalRef.current = setInterval(refresh, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [liveMode, refresh]);

  const setBroker = useCallback((b: Broker) => { setBrokerRaw(b); wsStatusRef.current = "demo"; setConnStatus("demo"); }, []);
  const setSymbol = useCallback((s: Symbol) => { setSymbolRaw(s); }, []);
  const setExpiry = useCallback((e: string) => { setExpiryRaw(e); }, []);

  return {
    chain, spot, analytics,
    broker, symbol, expiry, expiries, tab, metric, filter, liveMode, connStatus, lastTs, tickAnim,
    setBroker, setSymbol, setExpiry, setTab, setMetric, setFilter, setLiveMode,
    refresh, applyTicks,
    setConnStatus: setConnStatusSafe,
  };
}

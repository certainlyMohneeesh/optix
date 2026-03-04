"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  OPTIX — Option Chain Dashboard
//  Main page — wires all components together
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useMemo } from "react";
import { Header }           from "@/components/layout/Header";
import { StatStrip }        from "@/components/option-chain/StatStrip";
import { OptionChainTable } from "@/components/option-chain/OptionChainTable";
import { OIBarChart }       from "@/components/option-chain/OIBarChart";
import { AnalyticsPanel }   from "@/components/option-chain/AnalyticsPanel";
import { GreeksTable }      from "@/components/option-chain/GreeksTable";
import { SetupPanel }       from "@/components/option-chain/SetupPanel";
import { Skeleton }         from "@/components/ui/skeleton";
import { useOptionChain }   from "@/hooks/useOptionChain";
import { useWebSocket }     from "@/hooks/useWebSocket";
import { UPSTOX_INSTRUMENTS } from "@/lib/mock-data";
import type { Broker, Symbol } from "@/lib/types";

export default function Home() {
  const oc = useOptionChain();

  // ── Collect all instrument keys for WS subscription ─────────────────────
  // useMemo: instrument keys only change when expiry/symbol changes (not on every tick)
  const allInstruments = useMemo(() => {
    const optionKeys = oc.chain.flatMap((row) => [
      row.call.instrument_key,
      row.put.instrument_key,
    ]);
    return [UPSTOX_INSTRUMENTS[oc.symbol], ...optionKeys];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oc.symbol, oc.expiry, oc.chain.length]); // chain.length changes on load, not on ticks

  // ── WebSocket ticks → chain updates ─────────────────────────────────────
  const onTicks = useCallback(
    (ticks: Array<{ instrument_key: string; ltp: number; oi: number; volume: number }>) => {
      oc.applyTicks(ticks);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oc.applyTicks]
  );

  useWebSocket({
    enabled: oc.liveMode,
    instruments: allInstruments,
    onTicks,
    onStatusChange: oc.setConnStatus,
  });

  const isLoading = oc.chain.length === 0;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* ── Header ── */}
      <Header
        broker={oc.broker}
        symbol={oc.symbol}
        expiry={oc.expiry}
        expiries={oc.expiries}
        tab={oc.tab}
        liveMode={oc.liveMode}
        connStatus={oc.connStatus}
        lastTs={oc.lastTs}
        tickAnim={oc.tickAnim}
        onBroker={(b: Broker) => oc.setBroker(b)}
        onSymbol={(s: Symbol) => oc.setSymbol(s)}
        onExpiry={oc.setExpiry}
        onTab={oc.setTab}
        onLive={oc.setLiveMode}
        onRefresh={oc.refresh}
      />

      {/* ── Body ── */}
      <main className="flex-1 px-3 py-3 sm:p-4 space-y-3 sm:space-y-4 max-w-[1800px] mx-auto w-full">

        {/* Demo banner */}
        {oc.connStatus === "demo" && oc.tab !== "setup" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
            <p className="text-xs text-yellow-600">
              <strong>Demo Mode</strong> — Showing simulated data. Go to{" "}
              <button
                className="underline hover:text-yellow-300 font-semibold"
                onClick={() => oc.setTab("setup")}
              >
                SETUP
              </button>{" "}
              to connect real API.
            </p>
            <span className="text-[9px] text-yellow-600 font-mono">
              {oc.broker.toUpperCase()} · {oc.symbol} · {oc.expiry}
            </span>
          </div>
        )}

        {/* ── Stat Strip ── */}
        {isLoading ? (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className={`h-16 bg-zinc-200 ${i === 0 ? "col-span-2 sm:col-span-3 lg:col-span-1" : ""}`} />
            ))}
          </div>
        ) : (
          <StatStrip
            symbol={oc.symbol}
            expiry={oc.expiry}
            spot={oc.spot}
            analytics={oc.analytics}
          />
        )}

        {/* ── Chain tab ── */}
        {oc.tab === "chain" && (
          <>
            {isLoading ? (
              <Skeleton className="h-[500px] bg-zinc-200 rounded-lg" />
            ) : (
              <div className="bg-zinc-50/80 border border-zinc-200 rounded-lg p-2 sm:p-4">
                <OptionChainTable
                  chain={oc.chain}
                  analytics={oc.analytics}
                  symbol={oc.symbol}
                  spot={oc.spot}
                  metric={oc.metric}
                  filter={oc.filter}
                  onMetric={oc.setMetric}
                  onFilter={oc.setFilter}
                />
              </div>
            )}
            {!isLoading && (
              <OIBarChart
                chain={oc.chain}
                symbol={oc.symbol}
                expiry={oc.expiry}
                spot={oc.spot}
                maxPain={oc.analytics.maxPain}
              />
            )}
          </>
        )}

        {/* ── Analytics tab ── */}
        {oc.tab === "analytics" && (
          isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 bg-zinc-200 rounded-lg" />
              ))}
            </div>
          ) : (
            <AnalyticsPanel
              chain={oc.chain}
              analytics={oc.analytics}
              symbol={oc.symbol}
              spot={oc.spot}
            />
          )
        )}

        {/* ── Greeks tab ── */}
        {oc.tab === "greeks" && (
          isLoading ? (
            <Skeleton className="h-[600px] bg-zinc-200 rounded-lg" />
          ) : (
            <GreeksTable
              chain={oc.chain}
              symbol={oc.symbol}
              spot={oc.spot}
            />
          )
        )}

        {/* ── Setup tab ── */}
        {oc.tab === "setup" && <SetupPanel />}

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-200 px-4 py-2 flex justify-between text-[9px] font-mono text-zinc-400">
        <span>
          OPTIX · {oc.broker.toUpperCase()} · {oc.chain.length} strikes · {oc.symbol} {oc.expiry}
        </span>
        <span className={oc.connStatus === "connected" ? "text-green-700" : "text-yellow-700"}>
          ⬤ {oc.connStatus === "demo" ? "SIMULATED DATA" : oc.connStatus.toUpperCase()}
        </span>
      </footer>
    </div>
  );
}

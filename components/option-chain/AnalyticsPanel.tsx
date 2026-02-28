"use client";
import { Card } from "@/components/ui/card";
import { fn, fOI, pcrColor, pcrLabel } from "@/lib/formatters";
import type { ChainRow, ChainAnalytics, Symbol } from "@/lib/types";
import { STEPS } from "@/lib/mock-data";

interface AnalyticsPanelProps {
  chain:     ChainRow[];
  analytics: ChainAnalytics;
  symbol:    Symbol;
  spot:      number;
}

export function AnalyticsPanel({ chain, analytics, symbol, spot }: AnalyticsPanelProps) {
  const step = STEPS[symbol];
  const atm  = Math.round(spot / step) * step;
  const { pcr, maxPain, totalCallOI, totalPutOI, totalCallVolume, totalPutVolume } = analytics;
  const [pcrLbl, pcrDesc, pcrClr] = pcrLabel(pcr);

  // LTP × Volume top strikes
  const topLtpVol = [...chain]
    .sort((a, b) => (b.call.ltp_volume + b.put.ltp_volume) - (a.call.ltp_volume + a.put.ltp_volume))
    .slice(0, 9);
  const maxLtpVolTotal = topLtpVol.reduce((m, r) =>
    Math.max(m, r.call.ltp_volume + r.put.ltp_volume), 1
  );

  // Near-max-pain range  
  const nearMpStrikes = chain.filter((r) => Math.abs(r.strike - maxPain) <= step * 3);
  const maxMpOI = Math.max(...nearMpStrikes.map((r) => Math.max(r.call.oi, r.put.oi)), 1);

  // OI change stats
  const callOIAdded   = chain.reduce((s, r) => s + Math.max(0, r.call.oi_change), 0);
  const callOIShed    = Math.abs(chain.reduce((s, r) => s + Math.min(0, r.call.oi_change), 0));
  const putOIAdded    = chain.reduce((s, r) => s + Math.max(0, r.put.oi_change), 0);
  const putOIShed     = Math.abs(chain.reduce((s, r) => s + Math.min(0, r.put.oi_change), 0));

  // IV skew near ATM
  const nearAtm = chain.filter((r) => Math.abs(r.strike - atm) <= step * 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* PCR Gauge */}
      <Card className="bg-white border-zinc-200 p-4">
        <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-3 uppercase">
          PCR Gauge & Market Bias
        </p>
        <div className="flex gap-4 items-baseline mb-4">
          <span
            className="text-4xl font-bold font-mono leading-none"
            style={{ color: pcrClr }}
          >
            {fn(pcr, 3)}
          </span>
          <div>
            <p className="text-sm font-bold" style={{ color: pcrClr }}>{pcrLbl}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{pcrDesc}</p>
          </div>
        </div>

        {/* Gradient bar */}
        <div className="relative h-2 rounded-full bg-zinc-200 overflow-hidden mb-1">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.min(100, (pcr / 2) * 100)}%`,
              background: "linear-gradient(90deg, #f87171, #fbbf24, #34d399)",
              transition: "width 0.5s ease",
            }}
          />
          {/* Neutral marker at 50% */}
          <div className="absolute top-0 bottom-0 w-px bg-zinc-600" style={{ left: "50%" }} />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-400">
          <span>0 (Bearish)</span><span>1.0 (Neutral)</span><span>2.0 (Bullish)</span>
        </div>

        {/* OI / Volume grid */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[
            { l: "Total Call OI",   v: fOI(totalCallOI),   c: "#f87171" },
            { l: "Total Put OI",    v: fOI(totalPutOI),    c: "#34d399" },
            { l: "Call Volume",     v: fOI(totalCallVolume), c: "#fca5a5" },
            { l: "Put Volume",      v: fOI(totalPutVolume),  c: "#86efac" },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-zinc-50/60 rounded p-2.5">
              <p className="text-[9px] text-zinc-500">{l}</p>
              <p className="text-base font-bold font-mono mt-0.5" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Max Pain Analysis */}
      <Card className="bg-white border-zinc-200 p-4">
        <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-3 uppercase">
          Max Pain Analysis
        </p>
        <div className="flex gap-4 items-baseline mb-3">
          <span className="text-4xl font-bold font-mono text-purple-600 leading-none">
            {maxPain}
          </span>
          <div>
            <p className="text-xs font-bold text-purple-600">MAX PAIN STRIKE</p>
            <p className={`text-[10px] mt-0.5 ${maxPain > spot ? "text-green-700" : "text-red-600"}`}>
              {fn(maxPain - spot, 0)} pts {maxPain > spot ? "above" : "below"} spot
            </p>
          </div>
        </div>
        <p className="text-[9px] text-zinc-500 mb-2 uppercase tracking-wide">
          Near Max Pain — OI Concentration
        </p>
        <div className="space-y-2">
          {nearMpStrikes.map(({ strike, call, put }) => (
            <div key={strike} className="flex items-center gap-2">
              <span
                className="w-12 text-right text-[10px] font-mono font-bold flex-shrink-0"
                style={{
                  color: strike === maxPain ? "#a78bfa" : strike === atm ? "#94a3b8" : "#374a5e",
                }}
              >
                {strike}
              </span>
              <div className="flex-1 flex gap-0.5 h-2">
                <div
                  className="rounded-l transition-all"
                  style={{
                    flex: call.oi / maxMpOI,
                    background: "#f87171",
                    opacity: 0.7,
                    minWidth: 2,
                  }}
                />
                <div
                  className="rounded-r transition-all"
                  style={{
                    flex: put.oi / maxMpOI,
                    background: "#34d399",
                    opacity: 0.7,
                    minWidth: 2,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[9px]">
          <span className="text-red-600">■ Call OI</span>
          <span className="text-green-700">■ Put OI</span>
        </div>
      </Card>

      {/* LTP × Volume */}
      <Card className="bg-white border-zinc-200 p-4">
        <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-3 uppercase">
          LTP × Volume — Top Value Strikes (₹ Traded)
        </p>
        <div className="space-y-3">
          {topLtpVol.map(({ strike, call, put }) => {
            const total  = call.ltp_volume + put.ltp_volume;
            const cPct   = total > 0 ? (call.ltp_volume / total) * 100 : 50;
            const pPct   = 100 - cPct;
            const barW   = (total / maxLtpVolTotal) * 100;
            const isAtm  = strike === atm;
            const isMp   = strike === maxPain;

            return (
              <div key={strike}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span
                    className="font-mono font-semibold"
                    style={{ color: isAtm ? "#a78bfa" : isMp ? "#7c3aed" : "#94a3b8" }}
                  >
                    {strike}
                    {isAtm ? " ◀ATM" : isMp ? " ◀MP" : ""}
                  </span>
                  <span className="font-mono font-bold text-zinc-400">₹{fOI(total)}</span>
                </div>
                {/* Total bar (relative) */}
                <div className="h-2 rounded bg-zinc-200 overflow-hidden mb-0.5">
                  <div
                    className="h-full flex"
                    style={{ width: `${barW}%`, transition: "width 0.4s" }}
                  >
                    <div className="bg-red-400 opacity-80" style={{ width: cPct + "%" }} />
                    <div className="bg-green-400 opacity-80" style={{ width: pPct + "%" }} />
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                  <span>CE ₹{fOI(call.ltp_volume)} ({fn(cPct, 1)}%)</span>
                  <span>PE ₹{fOI(put.ltp_volume)} ({fn(pPct, 1)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* OI Change + IV Skew */}
      <Card className="bg-white border-zinc-200 p-4 space-y-4">
        {/* OI Change */}
        <div>
          <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-3 uppercase">
            OI Change Breakdown
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: "Call OI Added", v: fOI(callOIAdded), c: "#f87171" },
              { l: "Call OI Shed",  v: fOI(callOIShed),  c: "#fca5a5" },
              { l: "Put OI Added",  v: fOI(putOIAdded),  c: "#34d399" },
              { l: "Put OI Shed",   v: fOI(putOIShed),   c: "#86efac" },
            ].map(({ l, v, c }) => (
              <div key={l} className="bg-zinc-50/60 rounded p-2.5">
                <p className="text-[9px] text-zinc-500">{l}</p>
                <p className="text-base font-bold font-mono mt-0.5" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* IV Skew */}
        <div>
          <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-2 uppercase">
            IV Skew — Near ATM
          </p>
          <div className="space-y-1.5">
            {nearAtm.map(({ strike, call, put }) => {
              const diff    = put.iv - call.iv;
              const isAtm   = strike === atm;
              const barPos  = diff >= 0 ? "right" : "left";
              return (
                <div key={strike} className="flex items-center gap-2">
                  <span
                    className="w-12 text-right text-[10px] font-mono"
                    style={{ color: isAtm ? "#a78bfa" : "#374a5e" }}
                  >
                    {strike}
                  </span>
                  <span className="w-8 text-right text-[9px] font-mono text-red-600">{call.iv}%</span>
                  <div className="flex-1 relative h-1.5 bg-zinc-200 rounded overflow-hidden">
                    <div
                      className="absolute top-0 h-full rounded"
                      style={{
                        width: `${Math.min(100, Math.abs(diff) * 5)}%`,
                        background: diff >= 0 ? "#34d399" : "#f87171",
                        [barPos === "right" ? "left" : "right"]: "50%",
                      }}
                    />
                    <div className="absolute top-0 h-full w-px bg-zinc-600 left-1/2" />
                  </div>
                  <span className="w-8 text-[9px] font-mono text-green-700">{put.iv}%</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-zinc-400 mt-1">
            <span>← CE IV</span><span>PE IV →</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

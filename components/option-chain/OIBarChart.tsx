"use client";
import { Card } from "@/components/ui/card";
import { fOI, fn } from "@/lib/formatters";
import type { ChainRow, Symbol } from "@/lib/types";
import { STEPS } from "@/lib/mock-data";

interface OIBarChartProps {
  chain:    ChainRow[];
  symbol:   Symbol;
  expiry:   string;
  spot:     number;
  maxPain:  number;
}

export function OIBarChart({ chain, symbol, expiry, spot, maxPain }: OIBarChartProps) {
  if (!chain.length) return null;

  const step    = STEPS[symbol];
  const atm     = Math.round(spot / step) * step;
  const display = chain.filter((r) => Math.abs(r.strike - atm) <= step * 7);
  const maxOI   = Math.max(
    ...chain.map((r) => r.call.oi),
    ...chain.map((r) => r.put.oi),
    1
  );

  return (
    <Card className="bg-white border-zinc-200 p-4">
      <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-4 uppercase">
        OI Distribution by Strike — {symbol} {expiry}
      </p>

      <div className="flex flex-col gap-1.5">
        {display.map(({ strike, call, put }) => {
          const isAtm = strike === atm;
          const isMp  = strike === maxPain;
          const callW = (call.oi / maxOI) * 100;
          const putW  = (put.oi  / maxOI) * 100;

          return (
            <div key={strike} className="flex items-center gap-2 h-5">
              {/* Strike label */}
              <div
                className={`w-14 text-right text-[10px] font-mono flex-shrink-0 font-${
                  isAtm || isMp ? "bold" : "normal"
                }`}
                style={{
                  color: isAtm ? "#a78bfa" : isMp ? "#7c3aed" : "#374a5e",
                }}
              >
                {strike}
                {isAtm && <span className="text-[8px] ml-0.5 text-violet-600">▲</span>}
              </div>

              {/* Call bar (extends left from centre) */}
              <div className="flex-1 flex justify-end h-3">
                <div
                  className="h-full rounded-l transition-all duration-300"
                  style={{
                    width: `${callW}%`,
                    background: isMp ? "#7c3aed" : "#f87171",
                    opacity: 0.75,
                    minWidth: callW > 0.1 ? 2 : 0,
                  }}
                />
              </div>

              {/* Centre divider */}
              <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />

              {/* Put bar (extends right) */}
              <div className="flex-1 flex h-3">
                <div
                  className="h-full rounded-r transition-all duration-300"
                  style={{
                    width: `${putW}%`,
                    background: "#34d399",
                    opacity: 0.75,
                    minWidth: putW > 0.1 ? 2 : 0,
                  }}
                />
              </div>

              {/* OI labels */}
              <div className="w-12 text-[9px] text-zinc-500 font-mono text-right flex-shrink-0">
                {fOI(call.oi)}
              </div>
              <div className="w-12 text-[9px] text-zinc-500 font-mono flex-shrink-0">
                {fOI(put.oi)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-[9px] text-zinc-500">
        <span className="text-red-600">■ Call OI</span>
        <span className="text-green-700">■ Put OI</span>
        <span className="text-violet-600">■ Max Pain strike</span>
        <span className="ml-auto font-mono">
          ATM {atm} · Spot {fn(spot)} · Max Pain {maxPain}
        </span>
      </div>
    </Card>
  );
}

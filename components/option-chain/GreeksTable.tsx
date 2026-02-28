"use client";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fn } from "@/lib/formatters";
import type { ChainRow, Symbol } from "@/lib/types";
import { STEPS } from "@/lib/mock-data";

interface GreeksTableProps {
  chain:  ChainRow[];
  symbol: Symbol;
  spot:   number;
}

export function GreeksTable({ chain, symbol, spot }: GreeksTableProps) {
  const step    = STEPS[symbol];
  const atm     = Math.round(spot / step) * step;
  const strikes = chain.filter((r) => Math.abs(r.strike - atm) <= step * 6);

  const rows = strikes.flatMap(({ strike, call, put }) => [
    { strike, type: "CE" as const, ...call, isCall: true  },
    { strike, type: "PE" as const, ...put,  isCall: false },
  ]);

  const th = "px-3 py-1.5 text-right text-[9px] font-bold text-zinc-500 tracking-wide whitespace-nowrap";
  const td = "px-3 py-1 text-right font-mono text-[11px]";

  return (
    <Card className="bg-white border-zinc-200 p-4">
      <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-3 uppercase">
        Options Greeks — All Near-ATM Strikes
      </p>
      <ScrollArea className="w-full">
        <table className="w-full border-collapse" style={{ minWidth: 700 }}>
          <thead>
            <tr className="border-b border-zinc-200">
              <th className={th}>STRIKE</th>
              <th className={th}>TYPE</th>
              <th className={th}>LTP</th>
              <th className={th}>IV%</th>
              <th className={th}>Δ DELTA</th>
              <th className={th}>Γ GAMMA</th>
              <th className={th}>Θ THETA</th>
              <th className={th}>ν VEGA</th>
              <th className={th}>LTP×VOL</th>
              <th className={th}>DAY HIGH</th>
              <th className={th}>DAY LOW</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ strike, type, ltp, iv, delta, gamma, theta, vega, ltp_volume, day_high, day_low, isCall }) => (
              <tr
                key={`${strike}-${type}`}
                className="border-b border-zinc-200 hover:bg-zinc-100/50 transition-colors"
              >
                <td className={`${td} font-bold`} style={{ color: strike === atm ? "#a78bfa" : "#475569" }}>
                  {strike}{strike === atm ? " ◀" : ""}
                </td>
                <td className={`${td} font-bold`} style={{ color: isCall ? "#f87171" : "#34d399" }}>
                  {type}
                </td>
                <td className={td} style={{ color: isCall ? "#fca5a5" : "#86efac" }}>
                  {fn(ltp)}
                </td>
                <td className="px-3 py-1 text-right font-mono text-[11px] text-yellow-600">
                  {iv}%
                </td>
                <td className={td} style={{ color: isCall ? "#93c5fd" : "#c4b5fd" }}>
                  {delta >= 0 ? "+" : ""}{delta}
                </td>
                <td className="px-3 py-1 text-right font-mono text-[11px] text-sky-600">
                  {gamma}
                </td>
                <td className="px-3 py-1 text-right font-mono text-[11px] text-red-600">
                  {theta}
                </td>
                <td className="px-3 py-1 text-right font-mono text-[11px] text-purple-600">
                  {vega}
                </td>
                <td className={td} style={{ color: "#94a3b8" }}>
                  ₹{(ltp_volume / 1000).toFixed(0)}K
                </td>
                <td className="px-3 py-1 text-right font-mono text-[11px] text-zinc-500">
                  {fn(day_high)}
                </td>
                <td className="px-3 py-1 text-right font-mono text-[11px] text-zinc-500">
                  {fn(day_low)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {rows.length === 0 && (
        <div className="text-center text-zinc-500 text-sm py-8">
          No data — load the option chain first
        </div>
      )}
    </Card>
  );
}

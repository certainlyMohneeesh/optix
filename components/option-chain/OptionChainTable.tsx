"use client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { filterChain } from "@/lib/calculations";
import { fn, fOI, fChg, fPct, oiChangeColor } from "@/lib/formatters";
import { STEPS } from "@/lib/mock-data";
import type {
  ChainRow,
  ChainAnalytics,
  Symbol,
  MetricKey,
  FilterKey,
} from "@/lib/types";

interface OptionChainTableProps {
  chain:     ChainRow[];
  analytics: ChainAnalytics;
  symbol:    Symbol;
  spot:      number;
  metric:    MetricKey;
  filter:    FilterKey;
  onMetric:  (m: MetricKey) => void;
  onFilter:  (f: FilterKey) => void;
}

const METRICS: Record<MetricKey, { label: string }> = {
  oi:     { label: "Open Interest" },
  ltp:    { label: "LTP (₹)" },
  volume: { label: "Volume" },
  ltpvol: { label: "LTP × Vol" },
  iv:     { label: "IV %" },
};

const FILTERS: Array<[FilterKey, string]> = [
  ["all", "ALL"],
  ["itm", "ITM"],
  ["otm", "OTM"],
  ["atm", "NEAR ATM"],
];

function getMetricVal(row: ChainRow, side: "call" | "put", metric: MetricKey): string {
  const leg = row[side];
  switch (metric) {
    case "oi":     return fOI(leg.oi);
    case "ltp":    return fn(leg.ltp);
    case "volume": return fOI(leg.volume);
    case "ltpvol": return "₹" + fOI(leg.ltp_volume);
    case "iv":     return leg.iv + "%";
  }
}

function getMetricBar(row: ChainRow, side: "call" | "put", metric: MetricKey, analytics: ChainAnalytics): number {
  const leg = row[side];
  switch (metric) {
    case "oi":     return leg.oi / (side === "call" ? analytics.maxCallOI : analytics.maxPutOI);
    case "ltp":    return leg.ltp / 2000;
    case "volume": return leg.volume / (side === "call" ? analytics.totalCallVolume / 20 : analytics.totalPutVolume / 20);
    case "ltpvol": return leg.ltp_volume / analytics.maxLtpVolume;
    case "iv":     return leg.iv / 40;
  }
}

interface BarCellProps {
  children: React.ReactNode;
  barWidth: number;
  barColor: string;
  align: "left" | "right";
  highlight?: boolean;
  highlightColor?: string;
}

function BarCell({ children, barWidth, barColor, align, highlight, highlightColor }: BarCellProps) {
  const w = Math.min(100, barWidth * 100);
  return (
    <td className={`px-2 py-1 text-[11px] font-mono relative ${align === "right" ? "text-right" : "text-left"}`}>
      {/* Background bar */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[60%] rounded-sm opacity-[0.13] pointer-events-none"
        style={{
          width: `${w}%`,
          background: barColor,
          [align === "right" ? "right" : "left"]: 0,
          borderRadius: align === "right" ? "2px 0 0 2px" : "0 2px 2px 0",
        }}
      />
      <span className="relative" style={{ color: highlight ? highlightColor : "#374a5e" }}>
        {children}
      </span>
    </td>
  );
}

export function OptionChainTable({
  chain, analytics, symbol, spot, metric, filter, onMetric, onFilter,
}: OptionChainTableProps) {
  const step     = STEPS[symbol];
  const atm      = Math.round(spot / step) * step;
  const maxPain  = analytics.maxPain;
  const filtered = filterChain(chain, spot, step, filter);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">Metric</span>
        {(Object.entries(METRICS) as [MetricKey, { label: string }][]).map(([k, { label }]) => (
          <Button
            key={k}
            size="sm"
            variant="ghost"
            className={`h-6 px-2.5 text-[10px] font-bold rounded-full border ${
              metric === k
                ? "bg-violet-500/20 text-violet-600 border-violet-500/30"
                : "text-zinc-500 border-transparent hover:text-zinc-500"
            }`}
            onClick={() => onMetric(k)}
          >
            {label}
          </Button>
        ))}
        <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase ml-3">Filter</span>
        {FILTERS.map(([k, v]) => (
          <Button
            key={k}
            size="sm"
            variant="ghost"
            className={`h-6 px-2.5 text-[10px] font-bold rounded-full border ${
              filter === k
                ? "bg-blue-500/20 text-blue-600 border-blue-500/30"
                : "text-zinc-500 border-transparent hover:text-zinc-500"
            }`}
            onClick={() => onFilter(k)}
          >
            {v}
          </Button>
        ))}
      </div>

      {/* Table */}
      <ScrollArea className="w-full">
        <table className="w-full border-collapse text-[11px]" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th colSpan={8} className="text-center py-1.5 text-[10px] font-bold text-red-600 border-b-2 border-red-400/30 tracking-widest">
                — CALLS (CE) —
              </th>
              <th className="text-center py-1.5 text-[10px] font-bold text-violet-600 border-b-2 border-violet-400/30 px-3">
                STRIKE
              </th>
              <th colSpan={8} className="text-center py-1.5 text-[10px] font-bold text-green-700 border-b-2 border-green-400/30 tracking-widest">
                — PUTS (PE) —
              </th>
            </tr>
            <tr className="border-b border-zinc-200">
              {/* Call headers */}
              {["OI CHG%", "OI CHG", "OI", METRICS[metric].label, "IV%", "Δ", "BID", "LTP"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-right text-[9px] font-bold text-zinc-500 tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="px-3 py-1.5 text-center text-[9px] font-bold text-zinc-500 whitespace-nowrap">
                STRIKE
              </th>
              {/* Put headers */}
              {["LTP", "BID", "Δ", "IV%", METRICS[metric].label, "OI", "OI CHG", "OI CHG%"].map((h) => (
                <th key={h + "_p"} className="px-2 py-1.5 text-left text-[9px] font-bold text-zinc-500 tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ strike, call, put }) => {
              const isATM    = strike === atm;
              const isMP     = strike === maxPain;
              const itmC     = strike < spot;
              const itmP     = strike > spot;
              const cMetricV = getMetricVal({ strike, call, put }, "call", metric);
              const pMetricV = getMetricVal({ strike, call, put }, "put", metric);
              const cMetricB = getMetricBar({ strike, call, put }, "call", metric, analytics);
              const pMetricB = getMetricBar({ strike, call, put }, "put", metric, analytics);

              return (
                <tr
                  key={strike}
                  className={`border-b border-zinc-200 transition-colors hover:bg-black/[0.03] cursor-default ${
                    isATM ? "bg-violet-500/[0.05]" : ""
                  }`}
                >
                  {/* ── CALL CELLS ── */}
                  <td className="px-2 py-1 text-right font-mono text-[10px]" style={{ color: oiChangeColor(call.oi_change_pct) }}>
                    {fPct(call.oi_change_pct)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-[10px]" style={{ color: oiChangeColor(call.oi_change) }}>
                    {fChg(call.oi_change)}
                  </td>

                  {/* OI with bar */}
                  <BarCell barWidth={call.oi / analytics.maxCallOI} barColor="#f87171" align="right" highlight={itmC} highlightColor="#fca5a5">
                    {fOI(call.oi)}
                  </BarCell>

                  {/* Metric with bar */}
                  <BarCell barWidth={cMetricB} barColor="#f87171" align="right" highlight={itmC} highlightColor="#fca5a5">
                    {cMetricV}
                  </BarCell>

                  <td className="px-2 py-1 text-right font-mono text-zinc-500">{call.iv}%</td>
                  <td className="px-2 py-1 text-right font-mono text-zinc-400">
                    {call.delta >= 0 ? "+" : ""}{call.delta}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-zinc-400">{fn(call.bid_price)}</td>
                  <td className={`px-2 py-1 text-right font-mono font-semibold ${itmC ? "text-red-600" : "text-zinc-400"}`}>
                    {fn(call.ltp)}
                  </td>

                  {/* ── STRIKE ── */}
                  <td className="px-3 py-1 text-center relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`inline-flex flex-col items-center justify-center w-16 rounded px-1 py-0.5 font-mono font-bold text-[11px] ${
                            isATM ? "bg-violet-500/20" : isMP ? "bg-purple-100/60" : "bg-zinc-100"
                          }`}
                          style={{
                            color: isATM ? "#a78bfa" : isMP ? "#7c3aed" : "#64748b",
                          }}
                        >
                          {strike}
                          {isATM && <span className="text-[7px] text-violet-700/80 font-normal">ATM</span>}
                          {isMP  && <span className="text-[7px] text-purple-600/80 font-normal">MAX PAIN</span>}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Strike: {strike} | {itmC ? "ITM Call" : "OTM Call"} / {itmP ? "ITM Put" : "OTM Put"}
                      </TooltipContent>
                    </Tooltip>
                  </td>

                  {/* ── PUT CELLS ── */}
                  <td className={`px-2 py-1 text-left font-mono font-semibold ${itmP ? "text-green-700" : "text-zinc-400"}`}>
                    {fn(put.ltp)}
                  </td>
                  <td className="px-2 py-1 text-left font-mono text-zinc-400">{fn(put.bid_price)}</td>
                  <td className="px-2 py-1 text-left font-mono text-zinc-400">{put.delta}</td>
                  <td className="px-2 py-1 text-left font-mono text-zinc-500">{put.iv}%</td>

                  {/* Metric with bar */}
                  <BarCell barWidth={pMetricB} barColor="#34d399" align="left" highlight={itmP} highlightColor="#86efac">
                    {pMetricV}
                  </BarCell>

                  {/* OI with bar */}
                  <BarCell barWidth={put.oi / analytics.maxPutOI} barColor="#34d399" align="left" highlight={itmP} highlightColor="#86efac">
                    {fOI(put.oi)}
                  </BarCell>

                  <td className="px-2 py-1 text-left font-mono text-[10px]" style={{ color: oiChangeColor(put.oi_change) }}>
                    {fChg(put.oi_change)}
                  </td>
                  <td className="px-2 py-1 text-left font-mono text-[10px]" style={{ color: oiChangeColor(put.oi_change_pct) }}>
                    {fPct(put.oi_change_pct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

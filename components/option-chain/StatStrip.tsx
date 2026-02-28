"use client";
import { Card } from "@/components/ui/card";
import { fn, fOI, pcrColor, pcrLabel } from "@/lib/formatters";
import type { ChainAnalytics, Symbol } from "@/lib/types";
import { STEPS } from "@/lib/mock-data";

interface StatStripProps {
  symbol:    Symbol;
  expiry:    string;
  spot:      number;
  analytics: ChainAnalytics;
}

interface StatCardProps {
  label:    string;
  value:    string;
  sub?:     string;
  color?:   string;
  large?:   boolean;
}

function StatCard({ label, value, sub, color = "#94a3b8", large }: StatCardProps) {
  return (
    <Card className="bg-white border-zinc-200 p-3 min-w-0">
      <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-1 uppercase">
        {label}
      </p>
      <p
        className={`font-bold font-mono leading-none ${large ? "text-2xl" : "text-lg"}`}
        style={{ color }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] text-zinc-500 mt-1 font-mono">{sub}</p>
      )}
    </Card>
  );
}

export function StatStrip({ symbol, expiry, spot, analytics }: StatStripProps) {
  const step = STEPS[symbol];
  const atm  = Math.round(spot / step) * step;
  const { pcr, maxPain, ivSkew, totalCallOI, totalPutOI, totalCallVolume, totalPutVolume } = analytics;
  const [pcrLbl, , pcrClr] = pcrLabel(pcr);
  const mpDiff = maxPain - spot;
  const ivSkewColor = ivSkew > 1.5 ? "#f87171" : ivSkew < -1.5 ? "#34d399" : "#fbbf24";

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "auto repeat(6, 1fr)" }}>
      {/* Spot price — larger */}
      <Card className="bg-white border-zinc-200 p-3 border-l-2 border-l-violet-500">
        <p className="text-[9px] font-bold tracking-widest text-zinc-500 mb-1 uppercase">
          {symbol} SPOT
        </p>
        <p className="text-2xl font-bold font-mono text-violet-700 leading-none">
          {fn(spot)}
        </p>
        <p className="text-[9px] text-zinc-500 mt-1 font-mono">
          ATM: {atm} · Step: {step}
        </p>
      </Card>

      <StatCard
        label="PCR (OI)"
        value={fn(pcr, 3)}
        sub={pcrLbl}
        color={pcrClr}
      />
      <StatCard
        label="Max Pain"
        value={String(maxPain)}
        sub={`${mpDiff >= 0 ? "+" : ""}${fn(mpDiff, 0)} from spot`}
        color="#a78bfa"
      />
      <StatCard
        label="IV Skew 1-step"
        value={(ivSkew >= 0 ? "+" : "") + ivSkew + "%"}
        sub="PE IV − CE IV"
        color={ivSkewColor}
      />
      <StatCard
        label="Total Call OI"
        value={fOI(totalCallOI)}
        sub={`Vol: ${fOI(totalCallVolume)}`}
        color="#f87171"
      />
      <StatCard
        label="Total Put OI"
        value={fOI(totalPutOI)}
        sub={`Vol: ${fOI(totalPutVolume)}`}
        color="#34d399"
      />
      <StatCard
        label="Vol PCR"
        value={fn(totalPutVolume / Math.max(1, totalCallVolume), 3)}
        sub="Put Vol / Call Vol"
        color="#fbbf24"
      />
    </div>
  );
}

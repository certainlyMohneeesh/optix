"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Activity, RefreshCw, Settings, Zap, BarChart2 } from "lucide-react";
import { SYMBOLS, EXPIRIES } from "@/lib/mock-data";
import { fTime } from "@/lib/formatters";
import type { Broker, Symbol, ViewTab, ConnectionStatus } from "@/lib/types";

interface HeaderProps {
  broker:     Broker;
  symbol:     Symbol;
  expiry:     string;
  tab:        ViewTab;
  liveMode:   boolean;
  connStatus: ConnectionStatus;
  lastTs:     Date;
  tickAnim:   boolean;
  onBroker:   (b: Broker) => void;
  onSymbol:   (s: Symbol) => void;
  onExpiry:   (e: string) => void;
  onTab:      (t: ViewTab) => void;
  onLive:     (v: boolean) => void;
  onRefresh:  () => void;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; class: string }> = {
  demo:        { label: "DEMO",        class: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" },
  connecting:  { label: "CONNECTING",  class: "bg-blue-500/20 text-blue-600 border-blue-500/30" },
  connected:   { label: "LIVE",        class: "bg-green-500/20 text-green-700 border-green-500/30" },
  error:       { label: "ERROR",       class: "bg-red-500/20 text-red-600 border-red-500/30" },
};

export function Header({
  broker, symbol, expiry, tab, liveMode, connStatus, lastTs, tickAnim,
  onBroker, onSymbol, onExpiry, onTab, onLive, onRefresh,
}: HeaderProps) {
  const expiryList = EXPIRIES[symbol] ?? [];
  const status = STATUS_CONFIG[connStatus];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex h-12 items-center gap-3 px-4 flex-wrap">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <BarChart2 className="h-5 w-5 text-violet-600" />
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-mono">
            OPTIX
          </span>
        </div>

        <Separator orientation="vertical" className="h-6 bg-zinc-200" />

        {/* Broker Toggle */}
        <div className="flex gap-1">
          {(["upstox", "zerodha"] as Broker[]).map((b) => (
            <Button
              key={b}
              size="sm"
              variant={broker === b ? "secondary" : "ghost"}
              className={`h-7 text-xs font-bold px-3 ${
                broker === b
                  ? b === "upstox"
                    ? "bg-cyan-500/20 text-cyan-700 border border-cyan-500/30 hover:bg-cyan-500/30"
                    : "bg-orange-500/20 text-orange-600 border border-orange-500/30 hover:bg-orange-500/30"
                  : "text-zinc-500 hover:text-zinc-500"
              }`}
              onClick={() => onBroker(b)}
            >
              {b === "upstox" ? "▲ UPSTOX" : "⬡ ZERODHA"}
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6 bg-zinc-200" />

        {/* Symbol Select */}
        <Select value={symbol} onValueChange={(v) => onSymbol(v as Symbol)}>
          <SelectTrigger className="h-7 w-36 text-xs bg-zinc-100 border-zinc-300 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-100 border-zinc-300">
            {SYMBOLS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs font-mono">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Expiry Select */}
        <Select value={expiry} onValueChange={onExpiry}>
          <SelectTrigger className="h-7 w-36 text-xs bg-zinc-100 border-zinc-300 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-100 border-zinc-300">
            {expiryList.map((e) => (
              <SelectItem key={e} value={e} className="text-xs font-mono">
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6 bg-zinc-200" />

        {/* Tabs */}
        <nav className="flex gap-1">
          {(["chain", "analytics", "greeks", "setup"] as ViewTab[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant="ghost"
              className={`h-7 px-3 text-xs font-bold uppercase tracking-wide ${
                tab === t
                  ? "bg-violet-500/20 text-violet-600 border border-violet-500/30"
                  : "text-zinc-500 hover:text-zinc-500"
              }`}
              onClick={() => onTab(t)}
            >
              {t}
            </Button>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`text-xs font-mono transition-colors duration-300 ${
              tickAnim ? "text-cyan-700" : "text-zinc-500"
            }`}
          >
            {fTime(lastTs)}
          </span>

          {/* Live toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Switch
                  id="live-switch"
                  checked={liveMode}
                  onCheckedChange={onLive}
                  className="data-[state=checked]:bg-green-500 scale-90"
                />
                <Label
                  htmlFor="live-switch"
                  className={`text-xs font-bold cursor-pointer ${
                    liveMode ? "text-green-700" : "text-zinc-500"
                  }`}
                >
                  {liveMode ? (
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 animate-pulse" /> LIVE
                    </span>
                  ) : (
                    "PAUSED"
                  )}
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Toggle live data polling (every 5s)
            </TooltipContent>
          </Tooltip>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-400"
            onClick={onRefresh}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <Badge
            variant="outline"
            className={`text-xs font-bold px-2 py-0.5 ${status.class}`}
          >
            {connStatus === "connected" && (
              <Zap className="h-2.5 w-2.5 mr-1 inline" />
            )}
            {status.label}
          </Badge>
        </div>
      </div>
    </header>
  );
}

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

import { Activity, RefreshCw, Zap, BarChart2, LogIn } from "lucide-react";
import { SYMBOLS, EXPIRIES } from "@/lib/mock-data";
import { fTime } from "@/lib/formatters";
import type { Broker, Symbol, ViewTab, ConnectionStatus } from "@/lib/types";

interface HeaderProps {
  broker:     Broker;
  symbol:     Symbol;
  expiry:     string;
  expiries:   string[];  // live list from API / computed
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
  demo:          { label: "DEMO",         class: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" },
  connecting:    { label: "CONNECTING",   class: "bg-blue-500/20 text-blue-600 border-blue-500/30" },
  connected:     { label: "LIVE",         class: "bg-green-500/20 text-green-700 border-green-500/30" },
  reconnecting:  { label: "RECONNECTING", class: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
  error:         { label: "ERROR",        class: "bg-red-500/20 text-red-600 border-red-500/30" },
  auth_required: { label: "LOGIN",        class: "bg-orange-500/20 text-orange-600 border-orange-500/30" },
};

// Fallback so undefined statuses never crash
const getStatus = (s: ConnectionStatus) =>
  STATUS_CONFIG[s] ?? STATUS_CONFIG.error;

export function Header({
  broker, symbol, expiry, expiries, tab, liveMode, connStatus, lastTs, tickAnim,
  onBroker, onSymbol, onExpiry, onTab, onLive, onRefresh,
}: HeaderProps) {
  const expiryList = expiries.length ? expiries : (EXPIRIES[symbol] ?? []);
  const status = getStatus(connStatus);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
      {/* ── Row 1: Logo + right controls ─────────────────────────────────── */}
      <div className="flex h-11 items-center gap-2 px-3 sm:px-4 border-b border-zinc-100">
        {/* Logo */}
        <div className="flex items-center gap-1.5 shrink-0">
          <BarChart2 className="h-4 w-4 text-violet-600" />
          <span className="font-bold text-sm tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-mono">
            OPTIX
          </span>
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <span
            suppressHydrationWarning
            className={`hidden sm:block text-xs font-mono transition-colors duration-300 ${
              tickAnim ? "text-cyan-700" : "text-zinc-500"
            }`}
          >
            {fTime(lastTs)}
          </span>

          {/* Live toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Switch
                  id="live-switch"
                  checked={liveMode}
                  onCheckedChange={onLive}
                  className="data-[state=checked]:bg-green-500 scale-90"
                />
                <Label
                  htmlFor="live-switch"
                  className={`hidden sm:flex text-xs font-bold cursor-pointer items-center gap-1 ${
                    liveMode ? "text-green-700" : "text-zinc-500"
                  }`}
                >
                  {liveMode ? (
                    <><Activity className="h-3 w-3 animate-pulse" /> LIVE</>
                  ) : (
                    "PAUSED"
                  )}
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle live data polling</TooltipContent>
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
            className={`text-[10px] font-bold px-1.5 py-0.5 ${status.class}`}
          >
            {connStatus === "connected" && <Zap className="h-2.5 w-2.5 mr-0.5 inline" />}
            {status.label}
          </Badge>

          {(connStatus === "auth_required" || connStatus === "demo") && (
            <a href={`/api/auth/${broker}/login`}>
              <Button
                size="sm"
                className="h-7 px-2 sm:px-3 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white gap-1"
              >
                <LogIn className="h-3 w-3" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* ── Row 2: Controls — horizontally scrollable on mobile ────────────── */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 px-3 sm:px-4 h-9 min-w-max">
          {/* Broker Toggle */}
          <div className="flex gap-1 shrink-0">
            {(["upstox", "zerodha"] as Broker[]).map((b) => (
              <Button
                key={b}
                size="sm"
                variant={broker === b ? "secondary" : "ghost"}
                className={`h-6 text-[10px] font-bold px-2 ${
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

          <div className="w-px h-4 bg-zinc-200 shrink-0" />

          {/* Symbol Select */}
          <Select value={symbol} onValueChange={(v) => onSymbol(v as Symbol)}>
            <SelectTrigger className="h-6 w-28 text-[10px] bg-zinc-100 border-zinc-300 font-mono shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-100 border-zinc-300">
              {SYMBOLS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs font-mono">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Expiry Select */}
          <Select value={expiry} onValueChange={onExpiry}>
            <SelectTrigger className="h-6 w-28 text-[10px] bg-zinc-100 border-zinc-300 font-mono shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-100 border-zinc-300">
              {expiryList.map((e) => (
                <SelectItem key={e} value={e} className="text-xs font-mono">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-4 bg-zinc-200 shrink-0" />

          {/* Tabs */}
          <nav className="flex gap-0.5 shrink-0">
            {(["chain", "analytics", "greeks", "setup"] as ViewTab[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant="ghost"
                className={`h-6 px-2 text-[10px] font-bold uppercase tracking-wide ${
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
        </div>
      </div>
    </header>
  );
}

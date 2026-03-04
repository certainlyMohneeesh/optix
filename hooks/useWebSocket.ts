"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  useWebSocket — connects to the ws-server proxy and passes ticks upstream
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback, useState } from "react";
import type { ConnectionStatus } from "@/lib/types";

interface WsTick {
  instrument_key: string;
  ltp: number;
  oi: number;
  volume: number;
}

interface UseWebSocketOptions {
  enabled: boolean;
  instruments: string[];
  onTicks: (ticks: WsTick[]) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "ws://localhost:8765";

export function useWebSocket({
  enabled,
  instruments,
  onTicks,
  onStatusChange,
}: UseWebSocketOptions) {
  const wsRef           = useRef<WebSocket | null>(null);
  const reconnectRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef      = useRef(enabled);
  const instrumentsRef  = useRef(instruments);
  const onTicksRef      = useRef(onTicks);
  const onStatusRef     = useRef(onStatusChange);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>("demo");

  // Keep refs in sync with latest props — no re-renders / dep changes
  useEffect(() => { enabledRef.current     = enabled; },      [enabled]);
  useEffect(() => { instrumentsRef.current = instruments; },  [instruments]);
  useEffect(() => { onTicksRef.current     = onTicks; },      [onTicks]);
  useEffect(() => { onStatusRef.current    = onStatusChange; }, [onStatusChange]);

  const updateStatus = useCallback((s: ConnectionStatus) => {
    setWsStatus(s);
    onStatusRef.current?.(s);
  }, []);

  // connect is now stable — no instrument/onTicks deps, uses refs instead
  const connect = useCallback(() => {
    if (!enabledRef.current || typeof window === "undefined") return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log("[WS] Connecting to", WS_URL);
    updateStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      updateStatus("connected");
      const instr = instrumentsRef.current;
      if (instr.length > 0) {
        ws.send(JSON.stringify({ type: "subscribe", instruments: instr }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as {
          type: string;
          ticks?: WsTick[];
          status?: ConnectionStatus;
        };
        if (msg.type === "ticks" && msg.ticks) {
          onTicksRef.current(msg.ticks);
        } else if (msg.type === "status" && msg.status) {
          updateStatus(msg.status);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      // Browser intentionally hides WS error details for security — no message to log
      updateStatus("error");
    };

    ws.onclose = () => {
      console.log("[WS] Closed — will retry in 5s");
      wsRef.current = null;
      if (enabledRef.current) {
        reconnectRef.current = setTimeout(connect, 5000);
      }
    };
  }, [updateStatus]); // stable — no instruments/onTicks deps

  const disconnect = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus("demo");
  }, []);

  // Re-subscribe when instrument list *actually* changes (not just reference changes)
  const lastSubKey = useRef<string>("");
  useEffect(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || instruments.length === 0) return;
    const key = instruments.join(",");
    if (key === lastSubKey.current) return; // same instruments — skip
    lastSubKey.current = key;
    wsRef.current.send(JSON.stringify({ type: "subscribe", instruments }));
  }, [instruments]);

  // Connect / disconnect only when enabled changes — stable connect/disconnect means no storm
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
    return disconnect;
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { wsStatus };
}

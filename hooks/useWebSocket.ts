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
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>("demo");

  const updateStatus = useCallback(
    (s: ConnectionStatus) => {
      setWsStatus(s);
      onStatusChange?.(s);
    },
    [onStatusChange]
  );

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log("[WS] Connecting to", WS_URL);
    updateStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      updateStatus("connected");
      // Subscribe to the instruments we care about
      if (instruments.length > 0) {
        ws.send(JSON.stringify({ type: "subscribe", instruments }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as {
          type: string;
          ticks?: WsTick[];
          status?: ConnectionStatus;
          message?: string;
        };
        if (msg.type === "ticks" && msg.ticks) {
          onTicks(msg.ticks);
        } else if (msg.type === "status" && msg.status) {
          updateStatus(msg.status as ConnectionStatus);
        }
        // heartbeat — do nothing
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = (evt) => {
      const msg = evt instanceof ErrorEvent ? evt.message : "WebSocket connection failed";
      console.error("[WS] Error:", msg);
      updateStatus("error");
    };

    ws.onclose = () => {
      console.log("[WS] Closed — will retry in 5s");
      wsRef.current = null;
      if (enabled) {
        reconnectRef.current = setTimeout(connect, 5000);
      }
    };
  }, [enabled, instruments, onTicks, updateStatus]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    // Only update local wsStatus — don't reset parent connStatus when user
    // intentionally pauses live mode (REST-derived status should be preserved)
    setWsStatus("demo");
  }, []);

  // Re-subscribe when instrument list changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && instruments.length > 0) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", instruments }));
    }
  }, [instruments]);

  // Connect / disconnect when enabled changes
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
    return disconnect;
  }, [enabled, connect, disconnect]);

  return { wsStatus };
}

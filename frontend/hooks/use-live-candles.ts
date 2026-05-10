"use client";

import { useEffect, useRef, useState } from "react";
import { WS_BASE, LiveTick, LiveStatus } from "@/lib/api";

interface LiveCandleCallbacks {
  onCandle: (bar: { time: number; open: number; high: number; low: number; close: number }) => void;
  onTick?: (tick: LiveTick) => void;
  onStatus?: (status: LiveStatus) => void;
}

export function useLiveCandles(
  pair: string,
  timeframe: string,
  callbacks: LiveCandleCallbacks
): { status: LiveStatus } {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const callbacksRef = useRef<LiveCandleCallbacks>(callbacks);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    let closedByUs = false;

    function connect() {
      setStatus("connecting");
      callbacksRef.current.onStatus?.("connecting");
      const ws = new WebSocket(`${WS_BASE}/ws/candles/${pair}/${timeframe}`);
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = 1000;
        setStatus("connected");
        callbacksRef.current.onStatus?.("connected");
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          const type = data.type;
          if (type === "candle_update") {
            const { time, open, high, low, close } = data;
            callbacksRef.current.onCandle({ time: Number(time), open: Number(open), high: Number(high), low: Number(low), close: Number(close) });
          } else if (type === "tick") {
            const tick: LiveTick = {
              pair: String(data.pair),
              bid: Number(data.bid),
              ask: Number(data.ask),
              spreadPips: Number(data.spread_pips ?? data.spreadPips ?? 0),
              timeMs: Number(data.time_ms ?? data.timeMs ?? Date.now()),
            };
            callbacksRef.current.onTick?.(tick);
          } else if (type === "status") {
            const state = String(data.state ?? "offline");
            const mapped: LiveStatus = (state as LiveStatus) ?? "offline";
            setStatus(mapped);
            callbacksRef.current.onStatus?.(mapped);
          }
        } catch (err) {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closedByUs) return;
        setStatus("reconnecting");
        callbacksRef.current.onStatus?.("reconnecting");
        const delay = backoffRef.current;
        reconnectTimer.current = window.setTimeout(() => {
          connect();
        }, delay);
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    }

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [pair, timeframe]);

  return { status };
}

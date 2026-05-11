"use client";

import { useEffect, useRef, useState } from "react";
import { WS_BASE, type LiveTick } from "@/lib/api";

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"];
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface WatchlistTick extends LiveTick {
  dayOpen: number | null;
  pctChange: number | null;
}

export function useWatchlistTicks(): Map<string, WatchlistTick> {
  const [ticks, setTicks] = useState<Map<string, WatchlistTick>>(new Map());
  const dayOpenRef = useRef<Map<string, number>>(new Map());

  // Fetch day-open prices once on mount
  useEffect(() => {
    async function fetchDayOpens() {
      const token = localStorage.getItem("access_token") ?? "";
      await Promise.allSettled(
        PAIRS.map(async (pair) => {
          try {
            const res = await fetch(
              `${API_BASE}/ohlcv/${pair}?tf=D1&days=2`,
              { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            if (!res.ok) return;
            const rows: { open: number }[] = await res.json();
            if (rows.length > 0) {
              dayOpenRef.current.set(pair, rows[rows.length - 1].open);
            }
          } catch { /* offline — skip */ }
        })
      );
    }
    fetchDayOpens();
  }, []);

  // WebSocket subscriptions for all 4 pairs
  useEffect(() => {
    const sockets: WebSocket[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    function connect(pair: string) {
      const ws = new WebSocket(`${WS_BASE}/live_data/ws/${pair}`);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.type !== "tick") return;
          const bid: number = msg.bid;
          const ask: number = msg.ask;
          const spreadPips = Math.round((ask - bid) * 10000);
          const dayOpen = dayOpenRef.current.get(pair) ?? null;
          const pctChange =
            dayOpen !== null && dayOpen !== 0
              ? ((bid - dayOpen) / dayOpen) * 100
              : null;

          setTicks((prev) => {
            const next = new Map(prev);
            next.set(pair, { pair, bid, ask, spreadPips, timeMs: Date.now(), dayOpen, pctChange });
            return next;
          });
        } catch { /* malformed frame — ignore */ }
      };

      ws.onerror = () => ws.close();
      ws.onclose = () => {
        // Reconnect after 3s
        const t = setTimeout(() => connect(pair), 3000);
        timers.push(t);
      };

      sockets.push(ws);
    }

    for (const pair of PAIRS) connect(pair);

    return () => {
      sockets.forEach((ws) => ws.close());
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return ticks;
}

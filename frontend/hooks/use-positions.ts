"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchPositions,
  fetchAccount,
  fetchPendingOrders,
  fetchTradeHistory,
  LivePosition,
  LiveAccount,
  LivePendingOrder,
  HistoricalTrade,
} from "@/lib/api";

export function usePositions(pollIntervalMs = 5000): {
  positions: LivePosition[];
  pendingOrders: LivePendingOrder[];
  history: HistoricalTrade[];
  account: LiveAccount | null;
  loading: boolean;
  refresh: () => void;
} {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [pendingOrders, setPendingOrders] = useState<LivePendingOrder[]>([]);
  const [history, setHistory] = useState<HistoricalTrade[]>([]);
  const [account, setAccount] = useState<LiveAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Poll open positions + pending orders + account at pollIntervalMs
  useEffect(() => {
    mountedRef.current = true;

    async function poll() {
      try {
        const [pos, acc, pending] = await Promise.all([
          fetchPositions(),
          fetchAccount(),
          fetchPendingOrders(),
        ]);
        if (!mountedRef.current) return;
        setPositions(pos);
        setAccount(acc);
        setPendingOrders(pending);
      } catch {
        // keep stale data on transient MT5/network error
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    poll();
    const timer = window.setInterval(poll, pollIntervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [pollIntervalMs]);

  // Fetch closed trade history once on mount (refreshed on demand via refresh())
  useEffect(() => {
    fetchTradeHistory(30).then(setHistory).catch(() => {});
  }, []);

  const refresh = useCallback(() => {
    Promise.all([fetchPositions(), fetchAccount(), fetchPendingOrders()])
      .then(([pos, acc, pending]) => {
        setPositions(pos);
        setAccount(acc);
        setPendingOrders(pending);
      })
      .catch(() => {});
    fetchTradeHistory(30).then(setHistory).catch(() => {});
  }, []);

  return { positions, pendingOrders, history, account, loading, refresh };
}

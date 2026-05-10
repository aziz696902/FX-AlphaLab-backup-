"use client";

import { useState } from "react";
import { TradeRequest, TradeResult, openTrade, closeTrade, closeAllTrades } from "@/lib/api";

export function useTrade(): {
  openOrder: (params: TradeRequest) => Promise<TradeResult>;
  closePosition: (ticket: number) => Promise<TradeResult>;
  closeAll: () => Promise<TradeResult[]>;
  isPending: boolean;
} {
  const [isPending, setIsPending] = useState(false);

  async function openOrder(params: TradeRequest): Promise<TradeResult> {
    setIsPending(true);
    try {
      const res = await openTrade(params);
      return res;
    } catch (err: unknown) {
      return { success: false, retcode: 0, errorMessage: err instanceof Error ? err.message : String(err) };
    } finally {
      setIsPending(false);
    }
  }

  async function closePosition(ticket: number): Promise<TradeResult> {
    setIsPending(true);
    try {
      const res = await closeTrade(ticket);
      if (res.success) window.dispatchEvent(new Event("trade:closed"));
      return res;
    } catch (err: unknown) {
      return { success: false, retcode: 0, errorMessage: err instanceof Error ? err.message : String(err) };
    } finally {
      setIsPending(false);
    }
  }

  async function closeAll(): Promise<TradeResult[]> {
    setIsPending(true);
    try {
      const res = await closeAllTrades();
      if (res.some((r) => r.success)) window.dispatchEvent(new Event("trade:closed"));
      return res;
    } catch (err: unknown) {
      return [ { success: false, retcode: 0, errorMessage: err instanceof Error ? err.message : String(err) } ];
    } finally {
      setIsPending(false);
    }
  }

  return { openOrder, closePosition, closeAll, isPending };
}

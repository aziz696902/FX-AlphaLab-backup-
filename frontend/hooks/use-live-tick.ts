"use client";

import { useEffect, useState } from "react";
import type { LiveTick } from "@/lib/api";

/**
 * Subscribe to live tick data for a given FX pair via the window CustomEvent
 * bus emitted by useLiveCandles. Returns the latest tick or null before the
 * first tick arrives.
 *
 * This keeps tick updates scoped to the subscribing component — no state is
 * hoisted to the page level, so ticks never cause dashboard-wide re-renders.
 */
export function useLiveTick(pair: string): LiveTick | null {
  const [tick, setTick] = useState<LiveTick | null>(null);

  useEffect(() => {
    setTick(null);

    const eventName = `fx:tick:${pair}`;
    const handler = (e: Event) => setTick((e as CustomEvent<LiveTick>).detail);

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [pair]);

  return tick;
}

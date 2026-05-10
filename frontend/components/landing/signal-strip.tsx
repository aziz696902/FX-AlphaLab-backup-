'use client';

import { useEffect, useRef, useState } from 'react';
import { WS_BASE, fetchLatestReport, fetchSignals, fetchOHLCV, toActionLabel } from '@/lib/api';
import type { ActionLabel } from '@/lib/api';

const PAIRS = [
  { key: 'EURUSD', display: 'EUR/USD', decimals: 5 },
  { key: 'GBPUSD', display: 'GBP/USD', decimals: 5 },
  { key: 'USDJPY', display: 'USD/JPY', decimals: 3 },
  { key: 'USDCHF', display: 'USD/CHF', decimals: 5 },
];

interface PairState {
  bid: number | null;
  prevClose: number | null;
  signal: ActionLabel;
  conviction: number | null;
}

function useLivePairs() {
  const [pairs, setPairs] = useState<Record<string, PairState>>(() =>
    Object.fromEntries(
      PAIRS.map(({ key }) => [key, { bid: null, prevClose: null, signal: 'HOLD' as ActionLabel, conviction: null }])
    )
  );

  const update = (key: string, patch: Partial<PairState>) =>
    setPairs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  // ── WebSocket ticks — one per pair ────────────────────────────────────────
  useEffect(() => {
    const sockets: WebSocket[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let destroyed = false;

    PAIRS.forEach(({ key }) => {
      function connect() {
        if (destroyed) return;
        const ws = new WebSocket(`${WS_BASE}/ws/candles/${key}/M1`);
        sockets.push(ws);

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string);
            if (msg.type === 'tick') {
              update(key, { bid: Number(msg.bid) });
            }
          } catch { /* ignore malformed */ }
        };

        ws.onclose = () => {
          if (!destroyed) timers.push(setTimeout(connect, 3000));
        };
        ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
      }
      connect();
    });

    return () => {
      destroyed = true;
      timers.forEach(clearTimeout);
      sockets.forEach((ws) => { try { ws.close(); } catch { /* ignore */ } });
    };
  }, []);

  // ── Previous close via OHLCV D1 REST ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PAIRS.map(async ({ key }) => {
        try {
          const bars = await fetchOHLCV(key, 'D1', 2);
          const prev = bars.length >= 2 ? bars[bars.length - 2].close : bars[0]?.close ?? null;
          if (!cancelled) update(key, { prevClose: prev });
        } catch { /* backend may be offline */ }
      })
    );
    return () => { cancelled = true; };
  }, []);

  // ── Coordinator signals ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const report = await fetchLatestReport();
        const { coordinator_signals } = await fetchSignals(report.date);
        if (cancelled) return;
        coordinator_signals.forEach((s) => {
          update(s.pair, {
            signal: toActionLabel(s.suggested_action),
            conviction: s.conviction_score != null ? Math.round(s.conviction_score * 100) : null,
          });
        });
      } catch { /* no signals yet */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return pairs;
}

// ── Tiny sparkline — direction only until real bars are wired ─────────────
function Sparkline({ positive }: { positive: boolean }) {
  const path = positive
    ? 'M0,28 C8,22 14,16 20,12 S32,4 40,0'
    : 'M0,0 C8,6 14,12 20,16 S32,24 40,28';
  return (
    <svg width="48" height="28" viewBox="0 0 40 28" fill="none">
      <path d={path} stroke={positive ? '#3D9970' : '#C0392B'} strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const signalColor: Record<ActionLabel, string> = {
  BUY: '#3D9970',
  SELL: '#C0392B',
  HOLD: '#8F939C',
};

export default function SignalStrip() {
  const pairs = useLivePairs();

  return (
    <section className="w-full border-y border-[rgba(143,147,156,0.10)] py-12">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-8">
          Live Currency Pairs
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PAIRS.map(({ key, display, decimals }) => {
            const state = pairs[key];
            const mid = state.bid != null ? state.bid : null;
            const changePct =
              mid != null && state.prevClose != null && state.prevClose !== 0
                ? ((mid - state.prevClose) / state.prevClose) * 100
                : null;
            const positive = changePct == null ? true : changePct >= 0;

            return (
              <div
                key={key}
                className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#1A2530] hover:border-[#294F69] transition-all"
              >
                {/* Header row */}
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-[#E8ECF0] font-mono font-semibold text-sm">{display}</p>
                  {changePct != null ? (
                    <p className={`text-xs font-mono ${positive ? 'text-[#3D9970]' : 'text-[#C0392B]'}`}>
                      {positive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                    </p>
                  ) : (
                    <p className="text-[#8F939C] text-xs font-mono">—</p>
                  )}
                </div>

                {/* Price */}
                <p className="text-[#BBC0CB] font-mono text-xs mb-3">
                  {mid != null ? mid.toFixed(decimals) : '—'}
                </p>

                {/* Sparkline + signal */}
                <div className="flex items-end justify-between gap-2">
                  <Sparkline positive={positive} />
                  <span
                    className="px-2 py-1 rounded text-[10px] font-mono font-semibold text-[#0E1418] whitespace-nowrap"
                    style={{ backgroundColor: signalColor[state.signal] }}
                  >
                    {state.signal}
                  </span>
                </div>

                {/* Conviction */}
                <p className="text-[#8F939C] text-[10px] font-mono mt-2">
                  {state.conviction != null ? `Conviction ${state.conviction}%` : 'Conviction —'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

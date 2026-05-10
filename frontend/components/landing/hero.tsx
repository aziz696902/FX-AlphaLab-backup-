'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  WS_BASE,
  fetchLatestReport,
  fetchSignals,
  fetchOHLCV,
  toActionLabel,
} from '@/lib/api';
import type { ActionLabel, OHLCVBarAPI, AgentSignalAPI, CoordinatorSignalAPI } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAIRS = [
  { key: 'EURUSD', display: 'EUR/USD', decimals: 5 },
  { key: 'GBPUSD', display: 'GBP/USD', decimals: 5 },
  { key: 'USDJPY', display: 'USD/JPY', decimals: 3 },
  { key: 'USDCHF', display: 'USD/CHF', decimals: 5 },
];

const SIGNAL_COLOR: Record<ActionLabel, string> = {
  BUY: '#3D9970',
  SELL: '#C0392B',
  HOLD: '#8F939C',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function dirToLabel(d: number | string | null): ActionLabel {
  if (d == null) return 'HOLD';
  const n = typeof d === 'string' ? parseFloat(d) : d;
  if (n > 0) return 'BUY';
  if (n < 0) return 'SELL';
  return 'HOLD';
}

// ── SVG candlestick chart ─────────────────────────────────────────────────────

interface Bar { open: number; high: number; low: number; close: number }

function CandleChart({ bars }: { bars: Bar[] }) {
  if (bars.length === 0) return <div className="h-28 flex items-center justify-center text-[#8F939C] text-xs font-mono">Loading…</div>;

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const range = maxP - minP || 1;
  const H = 112;
  const W = 320;
  const cw = W / bars.length;

  const y = (price: number) => ((maxP - price) / range) * H;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {bars.map((b, i) => {
        const bull = b.close >= b.open;
        const color = bull ? '#3D9970' : '#C0392B';
        const cx = i * cw + cw / 2;
        const bodyTop = y(Math.max(b.open, b.close));
        const bodyH = Math.max(Math.abs(y(b.open) - y(b.close)), 1);
        return (
          <g key={i}>
            <line x1={cx} y1={y(b.high)} x2={cx} y2={y(b.low)} stroke={color} strokeWidth="0.6" opacity="0.6" />
            <rect x={cx - cw * 0.35} y={bodyTop} width={cw * 0.7} height={bodyH} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Data hook ─────────────────────────────────────────────────────────────────

interface HeroState {
  bars: Bar[];
  bid: number | null;
  prevClose: number | null;
  coord: CoordinatorSignalAPI | null;
  agent: AgentSignalAPI | null;
  reportDate: string | null;
}

function useHeroData(pairKey: string): HeroState {
  const [state, setState] = useState<HeroState>({
    bars: [], bid: null, prevClose: null, coord: null, agent: null, reportDate: null,
  });

  const patch = (p: Partial<HeroState>) => setState((s) => ({ ...s, ...p }));
  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  // OHLCV bars + previous close
  useEffect(() => {
    let cancelled = false;
    patch({ bars: [], prevClose: null });
    fetchOHLCV(pairKey, 'H1', 3).then((raw: OHLCVBarAPI[]) => {
      if (cancelled) return;
      const bars: Bar[] = raw.slice(-40).map((b) => ({
        open: b.open, high: b.high, low: b.low, close: b.close,
      }));
      // D1 for previous close
      fetchOHLCV(pairKey, 'D1', 2).then((daily) => {
        if (cancelled) return;
        const prevClose = daily.length >= 2 ? daily[daily.length - 2].close : (daily[0]?.close ?? null);
        patch({ bars, prevClose });
      }).catch(() => patch({ bars }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pairKey]);

  // Live tick via WebSocket
  useEffect(() => {
    patch({ bid: null });
    let closed = false;
    let ws: WebSocket;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      if (closed) return;
      ws = new WebSocket(`${WS_BASE}/ws/candles/${pairKey}/M1`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'tick') patch({ bid: Number(msg.bid) });
          else if (msg.type === 'candle_update') {
            setStateRef.current((s) => {
              const bars = [...s.bars];
              const last = bars[bars.length - 1];
              if (last) {
                bars[bars.length - 1] = {
                  ...last,
                  high: Math.max(last.high, Number(msg.close)),
                  low: Math.min(last.low, Number(msg.close)),
                  close: Number(msg.close),
                };
              }
              return { ...s, bars };
            });
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { if (!closed) timer = setTimeout(connect, 3000); };
      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
    }
    connect();
    return () => { closed = true; clearTimeout(timer); try { ws?.close(); } catch { /* ignore */ } };
  }, [pairKey]);

  // Coordinator + agent signals
  useEffect(() => {
    let cancelled = false;
    patch({ coord: null, agent: null, reportDate: null });
    (async () => {
      try {
        const report = await fetchLatestReport();
        const { coordinator_signals, agent_signals } = await fetchSignals(report.date);
        if (cancelled) return;
        patch({
          coord: coordinator_signals.find((s) => s.pair === pairKey) ?? null,
          agent: agent_signals.find((s) => s.pair === pairKey) ?? null,
          reportDate: report.date,
        });
      } catch { /* backend offline */ }
    })();
    return () => { cancelled = true; };
  }, [pairKey]);

  return state;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Hero() {
  const [activePairIdx, setActivePairIdx] = useState(0);
  const activePair = PAIRS[activePairIdx];
  const { bars, bid, prevClose, coord, agent, reportDate } = useHeroData(activePair.key);

  const displayPrice = bid ?? (bars.length ? bars[bars.length - 1].close : null);
  const changePct =
    displayPrice != null && prevClose != null && prevClose !== 0
      ? ((displayPrice - prevClose) / prevClose) * 100
      : null;
  const positive = changePct == null ? true : changePct >= 0;

  const coordAction = toActionLabel(coord?.suggested_action ?? null);
  const conviction = coord?.conviction_score != null ? Math.round(coord.conviction_score * 100) : null;

  const agentRows = [
    { label: 'TECHNICAL', action: dirToLabel(agent?.tech_direction ?? null), conf: agent?.tech_confidence != null ? Math.round(agent.tech_confidence * 100) : null },
    { label: 'MACRO', action: dirToLabel(agent?.macro_direction ?? null), conf: agent?.macro_confidence != null ? Math.round(agent.macro_confidence * 100) : null },
    { label: 'GEOPOLITICAL', action: dirToLabel(agent?.geo_bilateral_risk ?? null), conf: null },
  ];

  return (
    <section id="hero" className="relative min-h-screen w-full pt-24 pb-12 flex items-center">
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 flex items-center gap-12">

        {/* Left column */}
        <div className="flex-1">
          <div className="mb-6">
            <span className="text-[#B3902E] font-mono text-xs uppercase tracking-widest">
              Multi-Agent FX Research Platform
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-[#E8ECF0] mb-4 leading-tight">
            FX-AlphaLab
          </h1>

          <p className="text-[#BBC0CB] text-lg mb-6 max-w-sm">
            Multi-agent intelligence for explainable FX market analysis.
          </p>

          <p className="text-[#8F939C] text-sm mb-10" style={{ maxWidth: '44ch' }}>
            Market data, macro indicators, central bank sentiment, and agent reasoning — unified in one research-grade dashboard.
          </p>

          <div className="flex gap-4 mb-10">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-[#294F69] text-[#E8ECF0] rounded-lg font-medium text-sm hover:bg-[#3A5F7A] transition-colors"
            >
              Open Dashboard
            </Link>
            <button
              onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-3 border border-[#294F69] text-[#8CB8D0] rounded-lg font-medium text-sm hover:bg-[rgba(41,79,105,0.1)] transition-colors"
            >
              View Architecture
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-[#8F939C] text-xs font-mono">
            <span>● 5 Active Agents</span>
            <span>● Medallion Pipeline</span>
            <span>● Live MT5 Feed</span>
          </div>
        </div>

        {/* Right column — live data card */}
        <div
          className="flex-1 hidden lg:flex flex-col p-6 rounded-xl border border-[rgba(143,147,156,0.20)]"
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(17,21,25,0.80)', borderLeft: '3px solid #294F69' }}
        >
          {/* Pair tabs */}
          <div className="flex gap-1 mb-4">
            {PAIRS.map((p, i) => (
              <button
                key={p.key}
                onClick={() => setActivePairIdx(i)}
                className="px-3 py-1 rounded text-xs font-mono transition-all"
                style={{
                  background: i === activePairIdx ? 'rgba(41,79,105,0.4)' : 'transparent',
                  color: i === activePairIdx ? '#E8ECF0' : '#8F939C',
                  border: `1px solid ${i === activePairIdx ? 'rgba(41,79,105,0.6)' : 'transparent'}`,
                }}
              >
                {p.display}
              </button>
            ))}
          </div>

          {/* Price header */}
          <div className="flex items-end justify-between mb-4 pb-4 border-b border-[rgba(143,147,156,0.10)]">
            <div>
              <p className="text-[#8F939C] text-xs font-mono mb-1">PAIR</p>
              <p className="text-[#E8ECF0] font-mono text-lg font-semibold">{activePair.display}</p>
            </div>
            <div className="text-right">
              <p className="text-[#E8ECF0] font-mono text-xl font-semibold">
                {displayPrice != null ? displayPrice.toFixed(activePair.decimals) : '—'}
              </p>
              {changePct != null ? (
                <p className={`text-xs font-mono ${positive ? 'text-[#3D9970]' : 'text-[#C0392B]'}`}>
                  {positive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                </p>
              ) : (
                <p className="text-[#8F939C] text-xs font-mono">—</p>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="mb-4 h-28">
            <CandleChart bars={bars} />
          </div>

          {/* Coordinator signal */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-[rgba(143,147,156,0.10)]">
            <p className="text-[#8F939C] text-xs font-mono">SIGNAL</p>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-1 rounded text-xs font-mono font-semibold text-[#0E1418]"
                style={{ backgroundColor: SIGNAL_COLOR[coordAction] }}
              >
                {coordAction}
              </span>
              <p className="text-[#BBC0CB] text-xs font-mono">
                {conviction != null ? `Conviction ${conviction}%` : '—'}
              </p>
            </div>
          </div>

          {/* Agent votes */}
          <div className="space-y-2 mb-4 pb-4 border-b border-[rgba(143,147,156,0.10)]">
            {agentRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <span className="text-[#8F939C] font-mono">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-[#0E1418]"
                    style={{ backgroundColor: SIGNAL_COLOR[row.action] }}
                  >
                    {row.action}
                  </span>
                  <span className="text-[#BBC0CB] font-mono">{row.conf != null ? `${row.conf}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Run ID */}
          <p className="text-[#8F939C] text-[10px] font-mono">
            {reportDate ? `RUN-${reportDate}` : 'RUN-—'}
          </p>
        </div>
      </div>
    </section>
  );
}

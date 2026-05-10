'use client';

import { useState } from 'react';

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  color: 'green' | 'red';
}

// Simple candlestick SVG component
function CandlestickChart({ data }: { data: CandleData[] }) {
  const maxPrice = Math.max(...data.map((d) => d.high));
  const minPrice = Math.min(...data.map((d) => d.low));
  const range = maxPrice - minPrice;
  const height = 120;
  const width = 120;
  const candleWidth = width / data.length;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {data.map((candle, idx) => {
        const x = idx * candleWidth + candleWidth / 2;
        const wickX = x;

        // Normalize prices to SVG coordinates
        const bodyTop = ((maxPrice - Math.max(candle.open, candle.close)) / range) * height;
        const bodyBottom = ((maxPrice - Math.min(candle.open, candle.close)) / range) * height;
        const wickTop = ((maxPrice - candle.high) / range) * height;
        const wickBottom = ((maxPrice - candle.low) / range) * height;

        const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
        const candleColor = candle.color === 'green' ? '#3D9970' : '#C0392B';

        return (
          <g key={idx}>
            {/* Wick */}
            <line x1={wickX} y1={wickTop} x2={wickX} y2={wickBottom} stroke={candleColor} strokeWidth="0.5" opacity="0.6" />
            {/* Body */}
            <rect x={x - candleWidth / 3} y={bodyTop} width={candleWidth * 0.6} height={bodyHeight} fill={candleColor} />
          </g>
        );
      })}
    </svg>
  );
}

// Sample data for candlestick chart
const sampleCandles: CandleData[] = [
  { open: 1.081, high: 1.084, low: 1.080, close: 1.082, color: 'green' },
  { open: 1.082, high: 1.085, low: 1.081, close: 1.083, color: 'green' },
  { open: 1.083, high: 1.086, low: 1.082, close: 1.084, color: 'green' },
  { open: 1.084, high: 1.087, low: 1.083, close: 1.085, color: 'green' },
  { open: 1.085, high: 1.088, low: 1.084, close: 1.086, color: 'green' },
  { open: 1.086, high: 1.089, low: 1.085, close: 1.087, color: 'green' },
  { open: 1.087, high: 1.088, low: 1.084, close: 1.085, color: 'red' },
  { open: 1.085, high: 1.086, low: 1.083, close: 1.084, color: 'red' },
  { open: 1.084, high: 1.090, low: 1.082, close: 1.088, color: 'green' },
  { open: 1.088, high: 1.091, low: 1.087, close: 1.089, color: 'green' },
  { open: 1.089, high: 1.092, low: 1.088, close: 1.090, color: 'green' },
  { open: 1.090, high: 1.093, low: 1.089, close: 1.091, color: 'green' },
  { open: 1.091, high: 1.094, low: 1.090, close: 1.092, color: 'green' },
  { open: 1.092, high: 1.095, low: 1.091, close: 1.093, color: 'green' },
  { open: 1.093, high: 1.096, low: 1.092, close: 1.094, color: 'green' },
  { open: 1.084, high: 1.088, low: 1.082, close: 1.086, color: 'green' },
  { open: 1.086, high: 1.089, low: 1.085, close: 1.087, color: 'green' },
  { open: 1.087, high: 1.090, low: 1.086, close: 1.088, color: 'green' },
  { open: 1.083, high: 1.087, low: 1.081, close: 1.085, color: 'green' },
  { open: 1.085, high: 1.088, low: 1.084, close: 1.084, color: 'red' },
];

interface PairData {
  name: string;
  price: number;
  change: number;
  signal: 'HOLD' | 'LONG' | 'SHORT';
  confidence: number;
}

const currencyPairs: Record<string, PairData> = {
  'EUR/USD': { name: 'EUR/USD', price: 1.0842, change: 0.12, signal: 'HOLD', confidence: 61 },
  'GBP/USD': { name: 'GBP/USD', price: 1.2731, change: 0.34, signal: 'LONG', confidence: 74 },
  'USD/JPY': { name: 'USD/JPY', price: 149.82, change: -0.21, signal: 'SHORT', confidence: 68 },
  'USD/CHF': { name: 'USD/CHF', price: 0.8943, change: 0.07, signal: 'HOLD', confidence: 55 },
};

interface AgentVote {
  agent: string;
  vote: 'HOLD' | 'LONG' | 'SHORT';
  confidence: number;
}

const agentVotes: Record<string, AgentVote[]> = {
  'EUR/USD': [
    { agent: 'TECHNICAL', vote: 'HOLD', confidence: 58 },
    { agent: 'MACRO', vote: 'LONG', confidence: 72 },
    { agent: 'SENTIMENT', vote: 'SHORT', confidence: 44 },
  ],
};

export default function Hero() {
  const [activePair, setActivePair] = useState('EUR/USD');
  const currentPair = currencyPairs[activePair];

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'LONG':
        return '#3D9970';
      case 'SHORT':
        return '#C0392B';
      case 'HOLD':
      default:
        return '#8F939C';
    }
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen w-full pt-24 pb-12 overflow-hidden flex items-center"
    >
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 flex items-center gap-12">
        {/* Left column */}
        <div className="flex-1">
          {/* Label */}
          <div className="mb-6">
            <span className="text-[#B3902E] font-mono text-xs uppercase tracking-widest">
              Multi-Agent FX Research Platform
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-6xl font-bold text-[#E8ECF0] mb-4 leading-tight">
            FX-AlphaLab
          </h1>

          {/* Subtitle */}
          <p className="text-[#BBC0CB] text-lg mb-6 max-w-sm">
            Multi-agent intelligence for explainable FX market analysis.
          </p>

          {/* Description */}
          <p className="text-[#8F939C] text-sm mb-10 max-w-lg" style={{ maxWidth: '44ch' }}>
            Market data, macro indicators, central bank sentiment, and agent reasoning — unified in one
            research-grade dashboard.
          </p>

          {/* CTAs */}
          <div className="flex gap-4 mb-10">
            <button className="px-6 py-3 bg-[#294F69] text-[#E8ECF0] rounded-lg font-medium text-sm hover:bg-[#3A5F7A] transition-colors">
              Open Dashboard
            </button>
            <button className="px-6 py-3 border border-[#294F69] text-[#294F69] rounded-lg font-medium text-sm hover:bg-[rgba(41,79,105,0.1)] transition-colors">
              View Architecture
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 text-[#8F939C] text-xs font-mono">
            <span>● 5 Active Agents</span>
            <span>● Medallion Pipeline</span>
            <span>● CRISP-DM W4</span>
          </div>
        </div>

        {/* Right column - Glassmorphic card */}
        <div
          className="flex-1 hidden lg:flex flex-col p-6 rounded-xl border border-[rgba(143,147,156,0.20)]"
          style={{
            backdropFilter: 'blur(8px)',
            background: 'rgba(17, 21, 25, 0.75)',
            borderLeft: '3px solid #294F69',
          }}
        >
          {/* Pair info */}
          <div className="flex items-end justify-between mb-4 pb-4 border-b border-[rgba(143,147,156,0.10)]">
            <div>
              <p className="text-[#8F939C] text-xs font-mono mb-1">PAIR</p>
              <p className="text-[#E8ECF0] font-mono text-lg font-semibold">{currentPair.name}</p>
            </div>
            <div className="text-right">
              <p className="text-[#E8ECF0] font-mono text-xl font-semibold">{currentPair.price.toFixed(4)}</p>
              <p className={`text-xs font-mono ${currentPair.change >= 0 ? 'text-[#3D9970]' : 'text-[#C0392B]'}`}>
                {currentPair.change >= 0 ? '▲' : '▼'} {Math.abs(currentPair.change).toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="mb-4">
            <CandlestickChart data={sampleCandles} />
          </div>

          {/* Signal */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-[rgba(143,147,156,0.10)]">
            <p className="text-[#8F939C] text-xs font-mono">SIGNAL</p>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-1 rounded text-xs font-mono font-semibold text-[#161D22]"
                style={{ backgroundColor: getSignalColor(currentPair.signal) }}
              >
                {currentPair.signal}
              </span>
              <p className="text-[#BBC0CB] text-xs font-mono">Confidence: {currentPair.confidence}%</p>
            </div>
          </div>

          {/* Agent votes */}
          <div className="space-y-2 mb-4 pb-4 border-b border-[rgba(143,147,156,0.10)]">
            {agentVotes[activePair].map((vote) => (
              <div key={vote.agent} className="flex items-center justify-between text-xs">
                <span className="text-[#8F939C] font-mono">{vote.agent}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-[#161D22]"
                    style={{ backgroundColor: getSignalColor(vote.vote) }}
                  >
                    {vote.vote}
                  </span>
                  <span className="text-[#BBC0CB] font-mono">{vote.confidence}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Latest event */}
          <div className="mb-3">
            <p className="text-[#8F939C] text-xs truncate">ECB holds rates — Lagarde signals data dependency</p>
          </div>

          {/* Run ID */}
          <p className="text-[#8F939C] text-[10px] font-mono">RUN-2024-11-03-0842</p>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useMemo } from 'react';

interface PairData {
  name: string;
  price: number;
  change: number;
  signal: 'HOLD' | 'LONG' | 'SHORT';
  confidence: number;
}

const currencyPairs: PairData[] = [
  { name: 'EUR/USD', price: 1.0842, change: 0.12, signal: 'HOLD', confidence: 61 },
  { name: 'GBP/USD', price: 1.2731, change: 0.34, signal: 'LONG', confidence: 74 },
  { name: 'USD/JPY', price: 149.82, change: -0.21, signal: 'SHORT', confidence: 68 },
  { name: 'USD/CHF', price: 0.8943, change: 0.07, signal: 'HOLD', confidence: 55 },
];

function Sparkline({ change }: { change: number }) {
  // Simple sparkline path - uptrend if positive, downtrend if negative
  const isPositive = change >= 0;
  const path = isPositive
    ? 'M0,30 Q5,25 10,20 T20,10 T30,5 T40,0'
    : 'M0,0 Q5,5 10,10 T20,20 T30,25 T40,30';

  return (
    <svg width="40" height="30" viewBox="0 0 40 30" className="w-full">
      <path
        d={path}
        stroke={isPositive ? '#3D9970' : '#C0392B'}
        strokeWidth="1.5"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

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

export default function SignalStrip() {
  return (
    <section className="w-full border-y border-[rgba(143,147,156,0.10)] py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Label */}
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-8">
          Currency Pairs
        </h2>

        {/* Pairs grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currencyPairs.map((pair) => (
            <div
              key={pair.name}
              className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#1A2530] hover:border-[#294F69] transition-all cursor-pointer hover:bg-[rgba(41,79,105,0.1)]"
            >
              {/* Pair name and price */}
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[#E8ECF0] font-mono font-semibold text-sm">{pair.name}</p>
                <p className={`text-xs font-mono ${pair.change >= 0 ? 'text-[#3D9970]' : 'text-[#C0392B]'}`}>
                  {pair.change >= 0 ? '▲' : '▼'} {Math.abs(pair.change).toFixed(2)}%
                </p>
              </div>

              {/* Price */}
              <p className="text-[#BBC0CB] font-mono text-xs mb-3">{pair.price.toFixed(4)}</p>

              {/* Sparkline and signal */}
              <div className="flex items-end justify-between gap-2">
                <Sparkline change={pair.change} />
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 rounded text-[10px] font-mono font-semibold text-[#161D22] whitespace-nowrap"
                    style={{ backgroundColor: getSignalColor(pair.signal) }}
                  >
                    {pair.signal}
                  </span>
                </div>
              </div>

              {/* Confidence */}
              <p className="text-[#8F939C] text-[10px] font-mono mt-2">Confidence: {pair.confidence}%</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

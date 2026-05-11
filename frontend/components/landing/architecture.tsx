'use client';

import { useState } from 'react';

interface Tier {
  key: string;
  label: string;
  color: string;
  badge: string;
  description: string;
  details: string[];
}

const tiers: Tier[] = [
  {
    key: 'sources',
    label: 'Data Sources',
    color: '#8F939C',
    badge: 'Real-time',
    description: 'Raw external data feeds',
    details: ['MT5 / Dukascopy', 'FRED', 'ECB · Fed · BoE', 'ForexFactory', 'GDELT', 'Reddit · StockTwits', 'Google Trends'],
  },
  {
    key: 'bronze',
    label: 'Bronze',
    color: '#B3902E',
    badge: 'Append-only · Parquet',
    description: 'Immutable raw collection',
    details: ['Historical tick data archived', 'OHLCV bars timestamped', 'Economic releases as-is', 'Social streams raw', 'Geopolitical event logs'],
  },
  {
    key: 'silver',
    label: 'Silver',
    color: '#9AA5B4',
    badge: 'Pandera validated',
    description: 'Cleaned & normalised',
    details: ['Outliers detected & flagged', 'Missing values imputed', 'Timezone normalisation', 'Feature engineering', 'Schema validation'],
  },
  {
    key: 'gold',
    label: 'Gold',
    color: '#D4AF5A',
    badge: 'Signals · Scores',
    description: 'Alpha-grade outputs',
    details: ['Agent signals computed', 'Confidence scores', 'Analysis reports', 'Explainability traces', 'Quality metrics'],
  },
];

const outputs = [
  { label: 'Agents', description: 'Technical · Macro · Sentiment · Geo' },
  { label: 'Coordinator', description: 'Signal fusion & ranking' },
  { label: 'Report', description: 'LLM-generated research output' },
];

export default function Architecture() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  return (
    <section id="architecture" className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-3">
          Medallion Data Architecture
        </h2>
        <p className="text-[#8F939C] text-sm mb-10 max-w-2xl">
          Three-tier immutable data pipeline from raw collection to alpha-grade outputs.
        </p>

        {/* Tier cards — fluid, no horizontal scroll */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {tiers.map((tier, idx) => (
            <div key={tier.key}>
              <button
                onClick={() => toggle(tier.key)}
                className="w-full text-left p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,15,20,0.45)] backdrop-blur-md hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.04)] transition-all"
                style={{ borderLeft: `3px solid ${tier.color}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs uppercase" style={{ color: tier.color }}>
                    {tier.label}
                  </span>
                  <span className="text-[#8F939C] text-xs">{expanded === tier.key ? '−' : '+'}</span>
                </div>
                <p className="text-[#E8ECF0] text-xs mb-2 leading-snug">{tier.description}</p>
                <p className="text-[#8F939C] text-[10px] font-mono">{tier.badge}</p>
              </button>

              {expanded === tier.key && (
                <div className="mt-1 p-3 rounded-lg bg-[rgba(10,15,20,0.6)] border border-[rgba(255,255,255,0.06)]">
                  {tier.details.map((d, i) => (
                    <p key={i} className="text-[#BBC0CB] text-xs mb-1 last:mb-0">· {d}</p>
                  ))}
                </div>
              )}

              {/* Flow arrow between tiers (desktop only) */}
              {idx < tiers.length - 1 && (
                <div className="hidden md:block absolute" />
              )}
            </div>
          ))}
        </div>

        {/* Flow indicator */}
        <div className="flex items-center gap-2 mb-10 px-1">
          {tiers.map((tier, idx) => (
            <div key={tier.key} className="flex items-center gap-2 flex-1">
              <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${tier.color}66, ${tier.color})` }} />
              {idx < tiers.length - 1 && (
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                  <path d="M1 1l4 4-4 4" stroke="rgba(143,147,156,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>

        {/* Output layer */}
        <div className="grid grid-cols-3 gap-3">
          {outputs.map((out, idx) => (
            <div key={out.label} className="flex items-stretch gap-3">
              <div className="flex-1 p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,15,20,0.45)] backdrop-blur-md">
                <p className="text-[#B3902E] text-xs font-mono uppercase mb-1">{out.label}</p>
                <p className="text-[#8F939C] text-xs">{out.description}</p>
              </div>
              {idx < outputs.length - 1 && (
                <div className="flex items-center self-center">
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                    <path d="M1 1l4 4-4 4" stroke="rgba(143,147,156,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

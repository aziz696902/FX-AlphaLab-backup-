'use client';

import { useState } from 'react';

interface TierDetails {
  [key: string]: {
    label: string;
    description: string;
    badge: string;
    details: string[];
  };
}

const tiers: TierDetails = {
  sources: {
    label: 'Data Sources',
    description: 'Raw external data feeds',
    badge: 'Real-time',
    details: ['MT5/Dukascopy', 'FRED', 'ECB/Fed/BoE', 'ForexFactory', 'GDELT', 'Reddit/Stocktwits', 'Google Trends'],
  },
  bronze: {
    label: 'Bronze Layer',
    description: 'Raw immutable data collection',
    badge: 'Append-only · Parquet · TimescaleDB',
    details: [
      'Historical tick data archived',
      'OHLCV bars timestamped',
      'Economic releases unmodified',
      'Social media streams as-is',
      'Geopolitical event logs raw',
    ],
  },
  silver: {
    label: 'Silver Layer',
    description: 'Cleaned, normalized, validated data',
    badge: 'Pandera validated · Feature-ready',
    details: [
      'Outliers detected and flagged',
      'Missing values imputed',
      'Timezone normalization',
      'Feature engineering applied',
      'Schema validation enforced',
    ],
  },
  gold: {
    label: 'Gold Layer',
    description: 'Alpha outputs ready for research',
    badge: 'Signals · Reports · Scores',
    details: [
      'Agent signals computed',
      'Confidence scores calculated',
      'Analysis reports generated',
      'Explainability provided',
      'Quality metrics tracked',
    ],
  },
};

export default function Architecture() {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  return (
    <section id="architecture" className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-3">
          Medallion Data Architecture
        </h2>
        <p className="text-[#8F939C] text-sm mb-12 max-w-2xl">
          A three-tier immutable data pipeline from raw collection to alpha-grade outputs.
        </p>

        {/* Pipeline flow */}
        <div className="overflow-x-auto pb-4 mb-12">
          <div className="flex items-center gap-0 min-w-max">
            {/* Sources */}
            <div className="w-48">
              <div
                className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] cursor-pointer hover:border-[#294F69] transition-all"
                onClick={() => setExpandedTier(expandedTier === 'sources' ? null : 'sources')}
              >
                <p className="text-[#8F939C] text-xs font-mono uppercase mb-2">Data Sources</p>
                <p className="text-[#E8ECF0] text-xs leading-relaxed mb-2">{tiers.sources.description}</p>
                <p className="text-[#8F939C] text-[10px] font-mono">{tiers.sources.badge}</p>
              </div>
              {expandedTier === 'sources' && (
                <div className="mt-2 p-3 rounded bg-[#0E1418] border border-[rgba(143,147,156,0.10)]">
                  {tiers.sources.details.map((detail, idx) => (
                    <p key={idx} className="text-[#BBC0CB] text-xs mb-1">
                      • {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="px-4 flex-shrink-0">
              <svg width="24" height="2" viewBox="0 0 24 2" fill="none">
                <line x1="0" y1="1" x2="24" y2="1" stroke="rgba(143,147,156,0.4)" strokeWidth="1" strokeDasharray="4" />
              </svg>
            </div>

            {/* Bronze */}
            <div className="w-48">
              <div
                className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] cursor-pointer hover:border-[#B3902E] transition-all"
                style={{ borderLeft: '3px solid #B3902E' }}
                onClick={() => setExpandedTier(expandedTier === 'bronze' ? null : 'bronze')}
              >
                <p className="text-[#B3902E] text-xs font-mono uppercase mb-2">Bronze</p>
                <p className="text-[#E8ECF0] text-xs leading-relaxed mb-2">{tiers.bronze.description}</p>
                <p className="text-[#8F939C] text-[10px] font-mono">{tiers.bronze.badge}</p>
              </div>
              {expandedTier === 'bronze' && (
                <div className="mt-2 p-3 rounded bg-[#0E1418] border border-[rgba(143,147,156,0.10)]">
                  {tiers.bronze.details.map((detail, idx) => (
                    <p key={idx} className="text-[#BBC0CB] text-xs mb-1">
                      • {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="px-4 flex-shrink-0">
              <svg width="24" height="2" viewBox="0 0 24 2" fill="none">
                <line x1="0" y1="1" x2="24" y2="1" stroke="rgba(143,147,156,0.4)" strokeWidth="1" strokeDasharray="4" />
              </svg>
            </div>

            {/* Silver */}
            <div className="w-48">
              <div
                className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] cursor-pointer hover:border-[#8F939C] transition-all"
                style={{ borderLeft: '3px solid #8F939C' }}
                onClick={() => setExpandedTier(expandedTier === 'silver' ? null : 'silver')}
              >
                <p className="text-[#8F939C] text-xs font-mono uppercase mb-2">Silver</p>
                <p className="text-[#E8ECF0] text-xs leading-relaxed mb-2">{tiers.silver.description}</p>
                <p className="text-[#8F939C] text-[10px] font-mono">{tiers.silver.badge}</p>
              </div>
              {expandedTier === 'silver' && (
                <div className="mt-2 p-3 rounded bg-[#0E1418] border border-[rgba(143,147,156,0.10)]">
                  {tiers.silver.details.map((detail, idx) => (
                    <p key={idx} className="text-[#BBC0CB] text-xs mb-1">
                      • {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="px-4 flex-shrink-0">
              <svg width="24" height="2" viewBox="0 0 24 2" fill="none">
                <line x1="0" y1="1" x2="24" y2="1" stroke="rgba(143,147,156,0.4)" strokeWidth="1" strokeDasharray="4" />
              </svg>
            </div>

            {/* Gold */}
            <div className="w-48">
              <div
                className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] cursor-pointer hover:border-[#B3902E] transition-all"
                style={{ borderLeft: '3px solid #B3902E' }}
                onClick={() => setExpandedTier(expandedTier === 'gold' ? null : 'gold')}
              >
                <p className="text-[#B3902E] text-xs font-mono uppercase mb-2">Gold</p>
                <p className="text-[#E8ECF0] text-xs leading-relaxed mb-2">{tiers.gold.description}</p>
                <p className="text-[#8F939C] text-[10px] font-mono">{tiers.gold.badge}</p>
              </div>
              {expandedTier === 'gold' && (
                <div className="mt-2 p-3 rounded bg-[#0E1418] border border-[rgba(143,147,156,0.10)]">
                  {tiers.gold.details.map((detail, idx) => (
                    <p key={idx} className="text-[#BBC0CB] text-xs mb-1">
                      • {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="px-4 flex-shrink-0">
              <svg width="24" height="2" viewBox="0 0 24 2" fill="none">
                <line x1="0" y1="1" x2="24" y2="1" stroke="rgba(143,147,156,0.4)" strokeWidth="1" strokeDasharray="4" />
              </svg>
            </div>

            {/* Agents */}
            <div className="w-40">
              <div className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519]">
                <p className="text-[#8F939C] text-xs font-mono uppercase mb-2">Agents</p>
                <p className="text-[#E8ECF0] text-xs">Analysis & inference</p>
              </div>
            </div>

            {/* Arrow */}
            <div className="px-4 flex-shrink-0">
              <svg width="24" height="2" viewBox="0 0 24 2" fill="none">
                <line x1="0" y1="1" x2="24" y2="1" stroke="rgba(143,147,156,0.4)" strokeWidth="1" strokeDasharray="4" />
              </svg>
            </div>

            {/* Report */}
            <div className="w-40">
              <div className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519]">
                <p className="text-[#B3902E] text-xs font-mono uppercase mb-2">Report</p>
                <p className="text-[#E8ECF0] text-xs">Research output</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline for mobile */}
        <div className="hidden gap-8 flex-col lg:hidden">
          {['sources', 'bronze', 'silver', 'gold'].map((tier) => (
            <div key={tier}>
              <div
                className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] cursor-pointer"
                onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
              >
                <p className="text-[#B3902E] text-xs font-mono uppercase mb-2">
                  {tiers[tier as keyof typeof tiers].label}
                </p>
                <p className="text-[#E8ECF0] text-xs mb-2">{tiers[tier as keyof typeof tiers].description}</p>
              </div>
              {expandedTier === tier && (
                <div className="mt-2 p-3 rounded bg-[#0E1418] border border-[rgba(143,147,156,0.10)]">
                  {tiers[tier as keyof typeof tiers].details.map((detail, idx) => (
                    <p key={idx} className="text-[#BBC0CB] text-xs mb-1">
                      • {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

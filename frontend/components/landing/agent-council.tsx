'use client';

import { useState } from 'react';

interface Agent {
  name: string;
  icon: string;
  vote: 'HOLD' | 'LONG' | 'SHORT';
  confidence: number;
  evidence: string[];
}

const agents: Agent[] = [
  {
    name: 'Technical',
    icon: 'T',
    vote: 'HOLD',
    confidence: 58,
    evidence: ['RSI neutral at 52', 'Price consolidating below 1.0860 resistance', 'Support holds at 1.0820'],
  },
  {
    name: 'Macro',
    icon: 'M',
    vote: 'LONG',
    confidence: 72,
    evidence: ['US CPI beat expectations', 'EUR fundamentals relatively stronger', 'Fed tightening cycle stabilizing'],
  },
  {
    name: 'Sentiment',
    icon: 'S',
    vote: 'SHORT',
    confidence: 44,
    evidence: ['Reddit bearish bias detected', 'Retail positioning contrarian', 'Stocktwits short mentions rising'],
  },
  {
    name: 'Geopolitical',
    icon: 'G',
    vote: 'HOLD',
    confidence: 61,
    evidence: ['No major geopolitical event in GDELT', 'EU policy uncertainty contained', 'Trade tensions stable'],
  },
];

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

export default function AgentCouncil() {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  return (
    <section id="agents" className="w-full bg-[#161D22] py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-3">Agent Council</h2>
        <p className="text-[#8F939C] text-sm mb-12 max-w-2xl">
          Five specialized agents analyze each pair independently. The Coordinator synthesizes their votes into a final signal.
        </p>

        {/* Agents grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-8">
          {agents.map((agent) => (
            <div
              key={agent.name}
              onClick={() => setExpandedAgent(expandedAgent === agent.name ? null : agent.name)}
              className="p-6 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] hover:border-[#294F69] transition-all cursor-pointer hover:bg-[rgba(41,79,105,0.05)]"
            >
              {/* Icon and name */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{agent.icon}</span>
                <h3 className="text-[#E8ECF0] font-semibold">{agent.name} Agent</h3>
              </div>

              {/* Vote and confidence */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="px-2 py-1 rounded text-xs font-mono font-semibold text-[#161D22]"
                  style={{ backgroundColor: getSignalColor(agent.vote) }}
                >
                  {agent.vote}
                </span>
                <span className="text-[#B3902E] font-mono text-sm font-semibold">{agent.confidence}%</span>
              </div>

              {/* Primary evidence */}
              <p className="text-[#8F939C] text-xs leading-relaxed mb-3">{agent.evidence[0]}</p>

              {/* Expand indicator */}
              <div className="text-[#8F939C] text-xs flex items-center gap-1">
                {expandedAgent === agent.name ? '▼' : '▶'} {expandedAgent === agent.name ? 'Hide' : 'More'} details
              </div>

              {/* Expanded content */}
              {expandedAgent === agent.name && (
                <div className="mt-4 pt-4 border-t border-[rgba(143,147,156,0.10)] space-y-2">
                  {agent.evidence.slice(1).map((ev, idx) => (
                    <p key={idx} className="text-[#8F939C] text-xs leading-relaxed">
                      • {ev}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Coordinator card */}
        <div
          className="p-6 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] md:col-span-3"
          style={{
            borderTop: '2px solid #B3902E',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl font-bold text-[#B3902E]">C</span>
            <div>
              <h3 className="text-[#B3902E] font-mono text-xs uppercase tracking-wider">Coordinator</h3>
              <p className="text-[#8F939C] text-xs">Final synthesis agent</p>
            </div>
          </div>

          {/* Final signal */}
          <div className="mb-4 pb-4 border-b border-[rgba(143,147,156,0.10)]">
            <p className="text-[#8F939C] text-xs font-mono mb-2">FINAL SIGNAL</p>
            <div className="flex items-center gap-3">
              <span
                className="px-3 py-2 rounded text-xs font-mono font-bold text-[#161D22]"
                style={{ backgroundColor: '#8F939C' }}
              >
                HOLD
              </span>
              <span className="text-[#B3902E] font-mono font-semibold">61%</span>
            </div>
          </div>

          {/* Reasoning */}
          <div
            className="p-4 rounded mb-4 text-[#BBC0CB] text-xs leading-relaxed font-mono"
            style={{ background: '#0E1418' }}
          >
            "Mixed signals: Macro agent bullish offset by bearish retail sentiment. Technical confirms indecision.
            Recommend holding positions until next ECB statement."
          </div>

          {/* Weights */}
          <p className="text-[#8F939C] text-xs font-mono">
            Weights: Technical 30% · Macro 30% · Sentiment 20% · Geopolitical 20%
          </p>
        </div>
      </div>
    </section>
  );
}

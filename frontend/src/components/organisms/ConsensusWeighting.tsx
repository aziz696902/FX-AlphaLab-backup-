"use client";

import Panel from "@/components/atoms/Panel";
import SectionHeader from "@/components/atoms/SectionHeader";
import { useAgentStore } from "@/store/agentStore";

export default function ConsensusWeighting() {
  const weights = useAgentStore((state) => state.report.consensus_weights);

  return (
    <Panel>
      <SectionHeader title="Consensus Weighting" subtitle="Coordinator agent fusion" />
      <div className="mt-4 space-y-3">
        {Object.entries(weights).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink-3">
              <span>{key}</span>
              <span className="font-mono text-ink-1">{value.toFixed(2)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-emerald-400/70"
                style={{ width: `${Math.min(value * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

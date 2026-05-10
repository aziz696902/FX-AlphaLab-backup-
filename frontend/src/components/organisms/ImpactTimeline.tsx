"use client";

import Panel from "@/components/atoms/Panel";
import SectionHeader from "@/components/atoms/SectionHeader";
import { useAgentStore } from "@/store/agentStore";
import TraceLink from "@/components/molecules/TraceLink";

export default function ImpactTimeline() {
  const events = useAgentStore((state) => state.impactTimeline);
  const reasoning = useAgentStore((state) => state.reasoningLog.find((item) => item.agent === "geopolitical"));

  return (
    <Panel>
      <SectionHeader
        title="Impact Timeline"
        subtitle="Geopolitical events correlated with volatility spikes"
        actions={reasoning ? <TraceLink item={reasoning} /> : null}
      />
      <div className="mt-4 space-y-3">
        {events.map((event) => (
          <div key={event.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-1">{event.title}</p>
                <p className="text-xs text-ink-3">
                  {event.zone} · {event.timestamp_utc}
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-2">
                {event.impact.toUpperCase()}
              </span>
            </div>
            {event.volatility_spike ? (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Volatility Spike</p>
                <p className="text-sm font-mono text-emerald-100">{event.volatility_spike.label}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

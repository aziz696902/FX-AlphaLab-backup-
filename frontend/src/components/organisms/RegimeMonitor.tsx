"use client";

import Panel from "@/components/atoms/Panel";
import SectionHeader from "@/components/atoms/SectionHeader";
import DeltaBadge from "@/components/molecules/DeltaBadge";
import { useAgentStore } from "@/store/agentStore";
import TraceLink from "@/components/molecules/TraceLink";

export default function RegimeMonitor() {
  const macroSignal = useAgentStore((state) => state.macroSignal);
  const macroState = useAgentStore((state) => state.agentStates.macro);
  const reasoning = useAgentStore((state) => state.reasoningLog.find((item) => item.agent === "macro"));

  return (
    <Panel>
      <SectionHeader
        title="Regime Monitor"
        subtitle="Macro drivers and event surprise overlay"
        actions={reasoning ? <TraceLink item={reasoning} /> : null}
      />
      {macroState === "running" ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="h-12 w-full rounded-lg shimmer" />
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {macroSignal.drivers.map((driver) => (
          <div key={driver.name} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-1">{driver.label}</p>
                <p className="text-xs text-ink-3">Score {driver.score.toFixed(2)}</p>
              </div>
              <DeltaBadge value={driver.delta} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Top Calendar Drivers</p>
        <div className="mt-2 space-y-2">
          {macroSignal.top_calendar_events.map((event) => (
            <div
              key={event.event_id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <div>
                <p className="text-sm text-ink-1">{event.event_name}</p>
                <p className="text-xs text-ink-3">
                  {event.country} · {event.timestamp_utc}
                </p>
              </div>
              <span className="font-mono text-sm text-emerald-300">{event.contribution.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

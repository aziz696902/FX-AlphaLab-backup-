"use client";

import Panel from "@/components/atoms/Panel";
import SectionHeader from "@/components/atoms/SectionHeader";
import SignalPill from "@/components/molecules/SignalPill";
import ScenarioRow from "@/components/molecules/ScenarioRow";
import { useAgentStore } from "@/store/agentStore";
import TraceLink from "@/components/molecules/TraceLink";

export default function AlphaTerminal() {
  const report = useAgentStore((state) => state.report);
  const reasoning = useAgentStore((state) => state.reasoningLog.find((item) => item.agent === "coordinator"));

  const topPick = report.pair_analyses.find((item) => item.pair === report.top_pick);
  const overallDirection = topPick?.direction ?? "neutral";

  return (
    <Panel>
      <SectionHeader
        title="Alpha Terminal"
        subtitle="Coordinator report and trade construction"
        actions={reasoning ? <TraceLink item={reasoning} /> : null}
      />
      <div className="mt-4 grid gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Top Pick</p>
            <p className="text-2xl font-semibold text-ink-1">{report.top_pick}</p>
          </div>
          <div className="flex items-center gap-3">
            <SignalPill direction={overallDirection} />
            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1">
              <span className="text-xs uppercase tracking-[0.2em] text-emerald-200">Alpha</span>
              <span className="ml-2 font-mono text-emerald-100">{report.alpha_score}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-ink-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Action</p>
            <p className="text-ink-1">{report.overall_action.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Regime</p>
            <p className="text-ink-1">{topPick?.regime === "high_attention" ? "High Attention" : "Normal"}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {report.pair_analyses.map((scenario) => (
          <ScenarioRow key={scenario.pair} scenario={scenario} isTopPick={scenario.pair === report.top_pick} />
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Narrative Context</p>
        <ul className="mt-2 space-y-2 text-sm text-ink-2">
          {report.narrative.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

"use client";

import AgentStatusPanel from "@/components/organisms/AgentStatusPanel";
import RegimeMonitor from "@/components/organisms/RegimeMonitor";
import ConfluenceChart from "@/components/organisms/ConfluenceChart";
import SentimentPolarity from "@/components/organisms/SentimentPolarity";
import ImpactTimeline from "@/components/organisms/ImpactTimeline";
import ConsensusWeighting from "@/components/organisms/ConsensusWeighting";
import AlphaTerminal from "@/components/organisms/AlphaTerminal";
import ReasoningLog from "@/components/organisms/ReasoningLog";
import Panel from "@/components/atoms/Panel";
import { useAgentStore } from "@/store/agentStore";
import SignalPill from "@/components/molecules/SignalPill";
import useReportStream from "@/lib/useReportStream";

export default function TradingDashboard() {
  useReportStream();
  const { macroSignal, technicalSignal } = useAgentStore();

  const conflict =
    macroSignal.direction !== "neutral" &&
    technicalSignal.direction !== "neutral" &&
    macroSignal.direction !== technicalSignal.direction;

  return (
    <div className="space-y-6">
      {conflict ? (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Conflict State</p>
              <p className="text-sm text-ink-1">
                Macro signal is {macroSignal.direction}, technical is {technicalSignal.direction}.
              </p>
            </div>
            <SignalPill direction="neutral" />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.6fr_0.95fr]">
        <div className="space-y-6">
          <AgentStatusPanel />
          <RegimeMonitor />
        </div>
        <div className="space-y-6">
          <ConfluenceChart />
          <ImpactTimeline />
        </div>
        <div className="space-y-6">
          <AlphaTerminal />
          <ConsensusWeighting />
          <SentimentPolarity />
        </div>
      </div>
      <ReasoningLog />
    </div>
  );
}

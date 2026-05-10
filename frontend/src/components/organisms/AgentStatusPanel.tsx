"use client";

import Panel from "@/components/atoms/Panel";
import AgentCard from "@/components/molecules/AgentCard";
import { useAgentStore } from "@/store/agentStore";

export default function AgentStatusPanel() {
  const { agentStates, macroSignal, technicalSignal, sentimentSignal, geopoliticalSignal } =
    useAgentStore();

  return (
    <Panel title="Agent Status">
      <div className="space-y-4">
        <AgentCard
          title="Macro Analysis"
          state={agentStates.macro}
          confidence={macroSignal.macro_confidence}
          detail={`Dominant driver: ${macroSignal.dominant_driver}`}
          tone={macroSignal.direction === "bullish" ? "bull" : "bear"}
        />
        <AgentCard
          title="Technical Analysis"
          state={agentStates.technical}
          confidence={technicalSignal.confidence}
          detail={`Volatility regime: ${technicalSignal.volatility_regime}`}
          tone={technicalSignal.direction === "bullish" ? "bull" : "bear"}
        />
        <AgentCard
          title="Sentiment"
          state={agentStates.sentiment}
          confidence={sentimentSignal.usdjpy_stocktwits_active ? 0.61 : 0.12}
          detail={
            sentimentSignal.composite_stress_flag
              ? "Composite stress flag active"
              : "Regime overlay stable"
          }
          tone={sentimentSignal.composite_stress_flag ? "bear" : "neutral"}
        />
        <AgentCard
          title="Geopolitical"
          state={agentStates.geopolitical}
          confidence={Math.min(Math.abs(geopoliticalSignal.bilateral_risk_score), 1)}
          detail={`Bilateral risk: ${geopoliticalSignal.bilateral_risk_score.toFixed(2)}`}
          tone={geopoliticalSignal.risk_regime === "elevated" ? "bear" : "neutral"}
        />
      </div>
    </Panel>
  );
}

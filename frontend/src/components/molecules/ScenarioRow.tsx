import type { PairAnalysis } from "@/types/agents";
import SignalPill from "@/components/molecules/SignalPill";

interface ScenarioRowProps {
  scenario: PairAnalysis;
  isTopPick: boolean;
}

export default function ScenarioRow({ scenario, isTopPick }: ScenarioRowProps) {
  return (
    <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr] items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold text-ink-1">
          {scenario.pair}
          {isTopPick ? <span className="ml-2 text-[10px] text-emerald-300">TOP</span> : null}
        </div>
        <SignalPill direction={scenario.direction} />
      </div>
      <div className="font-mono text-ink-2">{scenario.position_pct.toFixed(2)}%</div>
      <div className="font-mono text-ink-2">SL {scenario.sl_pct.toFixed(2)}%</div>
      <div className="font-mono text-ink-2">TP {scenario.tp_pct.toFixed(2)}%</div>
      <div className="font-mono text-ink-2">{scenario.conviction.toFixed(3)}</div>
    </div>
  );
}

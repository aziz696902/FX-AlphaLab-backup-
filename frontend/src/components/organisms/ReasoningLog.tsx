"use client";

import Panel from "@/components/atoms/Panel";
import SectionHeader from "@/components/atoms/SectionHeader";
import { useAgentStore } from "@/store/agentStore";

const toneMap: Record<string, string> = {
  macro: "text-emerald-300",
  technical: "text-sky-300",
  sentiment: "text-amber-300",
  geopolitical: "text-rose-300",
  coordinator: "text-emerald-200"
};

export default function ReasoningLog() {
  const reasoning = useAgentStore((state) => state.reasoningLog);
  const selected = useAgentStore((state) => state.selectedReasoning);
  const setSelected = useAgentStore((state) => state.setSelectedReasoning);

  return (
    <Panel>
      <SectionHeader title="Agent Reasoning" subtitle="Cross-agent communication feed" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-3">
          {reasoning.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left font-mono text-xs text-ink-2 hover:border-emerald-400/40"
            >
              <div className="flex items-center justify-between">
                <span className={toneMap[item.agent] ?? "text-ink-2"}>{item.agent.toUpperCase()}</span>
                <span className="text-[10px] text-ink-3">{item.timestamp_utc}</span>
              </div>
              <div className="mt-1 text-ink-1">{item.title}</div>
              <div className="mt-1 text-ink-3">{item.detail}</div>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Traceability</p>
          {selected ? (
            <div className="mt-3 space-y-2 text-sm text-ink-2">
              <p className="font-semibold text-ink-1">{selected.title}</p>
              <p>{selected.detail}</p>
              <div className="rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-ink-2">
                <p className="text-ink-3">{selected.doc_path}</p>
                <p className="mt-2">{selected.excerpt}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-3">Select a signal to view the source excerpt.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

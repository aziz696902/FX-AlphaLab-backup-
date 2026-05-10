import { useAgentStore } from "@/store/agentStore";
import type { ReasoningItem } from "@/types/agents";

interface TraceLinkProps {
  item: ReasoningItem;
}

export default function TraceLink({ item }: TraceLinkProps) {
  const setSelectedReasoning = useAgentStore((state) => state.setSelectedReasoning);
  return (
    <button
      type="button"
      onClick={() => setSelectedReasoning(item)}
      className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 hover:text-emerald-200"
    >
      Trace
    </button>
  );
}

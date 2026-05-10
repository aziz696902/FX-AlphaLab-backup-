"use client";

import { motion } from "framer-motion";
import type { AgentState } from "@/types/agents";
import Pulse from "@/components/atoms/Pulse";
import ConfidenceGauge from "@/components/molecules/ConfidenceGauge";

interface AgentCardProps {
  title: string;
  state: AgentState;
  confidence: number;
  detail: string;
  tone: "bull" | "bear" | "neutral";
}

export default function AgentCard({ title, state, confidence, detail, tone }: AgentCardProps) {
  const badge =
    state === "running"
      ? "ACTIVE"
      : state === "stale"
      ? "STALE"
      : state === "error"
      ? "ERROR"
      : "IDLE";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pulse tone={tone} />
          <h3 className="text-sm font-semibold text-ink-1">{title}</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.3em] text-ink-3">{badge}</span>
      </div>
      <p className="mt-2 text-xs text-ink-3">{detail}</p>
      <div className="mt-3">
        <ConfidenceGauge value={confidence} label="Confidence" tone={tone} />
      </div>
    </motion.div>
  );
}

"use client";

import Panel from "@/components/atoms/Panel";
import SectionHeader from "@/components/atoms/SectionHeader";
import SignalPill from "@/components/molecules/SignalPill";
import { useAgentStore } from "@/store/agentStore";
import TraceLink from "@/components/molecules/TraceLink";

export default function SentimentPolarity() {
  const sentiment = useAgentStore((state) => state.sentimentSignal);
  const sentimentState = useAgentStore((state) => state.agentStates.sentiment);
  const reasoning = useAgentStore((state) => state.reasoningLog.find((item) => item.agent === "sentiment"));

  const polarity = sentiment.usdjpy_stocktwits_active
    ? sentiment.usdjpy_stocktwits_vol_signal && sentiment.usdjpy_stocktwits_vol_signal > 0
      ? "bullish"
      : "bearish"
    : "neutral";

  return (
    <Panel>
      <SectionHeader
        title="Sentiment Polarity"
        subtitle="Tiered source breakdown"
        actions={reasoning ? <TraceLink item={reasoning} /> : null}
      />
      {sentimentState === "running" ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="h-10 w-full rounded-lg shimmer" />
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink-1">USDJPY StockTwits Vol Signal</p>
          <p className="text-xs text-ink-3">
            {sentiment.usdjpy_stocktwits_active ? "Active" : "Inactive"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-ink-1">
            {sentiment.usdjpy_stocktwits_vol_signal?.toFixed(2) ?? "--"}
          </span>
          <SignalPill direction={polarity} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-3">GDELT Attention</p>
          <p className="mt-1 font-mono text-ink-1">
            {sentiment.gdelt_attention_zscore?.toFixed(2) ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Macro Attention</p>
          <p className="mt-1 font-mono text-ink-1">
            {sentiment.macro_attention_zscore?.toFixed(2) ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-3">GDELT Tone</p>
          <p className="mt-1 font-mono text-ink-1">
            {sentiment.gdelt_tone_zscore?.toFixed(2) ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Stress Flag</p>
          <p className="mt-1 text-ink-1">
            {sentiment.composite_stress_flag ? "ACTIVE" : "OFF"}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Source Breakdown</p>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-ink-2">Social (StockTwits)</span>
            <span className="font-mono text-ink-1">
              {sentiment.usdjpy_stocktwits_vol_signal?.toFixed(2) ?? "--"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-ink-2">News (GDELT Tone)</span>
            <span className="font-mono text-ink-1">{sentiment.gdelt_tone_zscore?.toFixed(2) ?? "--"}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-ink-2">Search (Google Trends)</span>
            <span className="font-mono text-ink-1">
              {sentiment.macro_attention_zscore?.toFixed(2) ?? "--"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Stress Sources</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {sentiment.stress_sources.length === 0 ? (
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-3">
              none
            </span>
          ) : (
            sentiment.stress_sources.map((source) => (
              <span
                key={source}
                className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200"
              >
                {source}
              </span>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}

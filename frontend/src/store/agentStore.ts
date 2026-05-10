import { create } from "zustand";
import type {
  AgentState,
  CoordinatorReport,
  GeopoliticalSignal,
  MacroSignal,
  Pair,
  ReasoningItem,
  SentimentSignal,
  TechnicalSignal
} from "@/types/agents";

export interface PriceBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolatilitySpike {
  timestamp_utc: string;
  label: string;
  magnitude: number;
}

export interface ImpactEvent {
  timestamp_utc: string;
  title: string;
  zone: "USD" | "EUR" | "GBP" | "JPY" | "CHF";
  impact: "high" | "medium" | "low";
  volatility_spike: VolatilitySpike | null;
}

export interface ReportPayload {
  report: CoordinatorReport;
  macro?: MacroSignal;
  technical?: TechnicalSignal;
  sentiment?: SentimentSignal;
  geopolitical?: GeopoliticalSignal;
  reasoning?: ReasoningItem[];
  priceSeries?: PriceBar[];
  impactTimeline?: ImpactEvent[];
}

interface AgentStoreState {
  selectedPair: Pair;
  agentStates: Record<"macro" | "technical" | "sentiment" | "geopolitical", AgentState>;
  macroSignal: MacroSignal;
  technicalSignal: TechnicalSignal;
  sentimentSignal: SentimentSignal;
  geopoliticalSignal: GeopoliticalSignal;
  report: CoordinatorReport;
  priceSeries: PriceBar[];
  impactTimeline: ImpactEvent[];
  reasoningLog: ReasoningItem[];
  selectedReasoning: ReasoningItem | null;
  setSelectedPair: (pair: Pair) => void;
  setSelectedReasoning: (item: ReasoningItem | null) => void;
  setAgentState: (
    agent: "macro" | "technical" | "sentiment" | "geopolitical",
    state: AgentState
  ) => void;
  hydrateFromPayload: (payload: ReportPayload) => void;
}

const baseTimestamp = "2026-05-04";

export const useAgentStore = create<AgentStoreState>((set) => ({
  selectedPair: "GBPUSD",
  agentStates: {
    macro: "running",
    technical: "running",
    sentiment: "running",
    geopolitical: "running"
  },
  macroSignal: {
    kind: "macro",
    pair: "GBPUSD",
    timestamp_utc: baseTimestamp,
    direction: "bullish",
    macro_confidence: 0.62,
    carry_signal_score: 0.24,
    regime_context_score: -0.12,
    fundamental_mispricing_score: 0.33,
    macro_surprise_score: 0.18,
    macro_bias_score: 0.09,
    dominant_driver: "fundamental",
    drivers: [
      { name: "carry", label: "Carry", score: 0.24, delta: 0.04 },
      { name: "regime", label: "Regime", score: -0.12, delta: -0.02 },
      { name: "fundamental", label: "Fundamental", score: 0.33, delta: 0.06 },
      { name: "surprise", label: "Event Surprise", score: 0.18, delta: 0.03 },
      { name: "bias", label: "Bias", score: 0.09, delta: -0.01 }
    ],
    top_calendar_events: [
      {
        event_id: "uk_cpi_2026_04",
        timestamp_utc: "2026-04-17",
        country: "GB",
        event_name: "UK CPI YoY beat",
        impact: "high",
        contribution: 0.21
      },
      {
        event_id: "uk_jobs_2026_04",
        timestamp_utc: "2026-04-24",
        country: "GB",
        event_name: "UK Jobs: wage growth surprise",
        impact: "medium",
        contribution: 0.12
      }
    ]
  },
  technicalSignal: {
    kind: "technical",
    pair: "GBPUSD",
    timestamp_utc: baseTimestamp,
    direction: "bearish",
    confidence: 0.46,
    volatility_regime: "low",
    indicator_snapshot: {
      rsi: 42.4,
      macd_hist: -0.18,
      bb_pct: 0.32,
      above_ema200: false,
      atr_pct_rank: 0.38
    },
    timeframe_votes: {
      D1: 0,
      H4: 0,
      H1: 1
    },
    confluence_levels: [
      { level: 1.2684, alignment: "D1 + H4", strength: "major" },
      { level: 1.2572, alignment: "H4 + H1", strength: "minor" },
      { level: 1.2828, alignment: "D1 + H1", strength: "major" }
    ]
  },
  sentimentSignal: {
    kind: "sentiment",
    timestamp_utc: baseTimestamp,
    usdjpy_stocktwits_vol_signal: -0.37,
    usdjpy_stocktwits_active: true,
    gdelt_tone_zscore: -0.88,
    gdelt_attention_zscore: 1.14,
    macro_attention_zscore: 1.29,
    composite_stress_flag: true,
    stress_sources: ["gdelt_attention", "macro_attention"],
    context: {
      reddit_global_activity_zscore: 0.61,
      reddit_pair_views: {
        GBPUSD: {
          risk_off_score: 0.18,
          risk_on_score: 0.31,
          sentiment_strength_wmean: 0.24
        }
      },
      stocktwits_pair_breakdown: {
        USDJPY: {
          bullish_score: 0.62,
          bearish_score: 0.25,
          net_sentiment: 0.37
        }
      }
    }
  },
  geopoliticalSignal: {
    kind: "geopolitical",
    timestamp_utc: baseTimestamp,
    bilateral_risk_score: 0.72,
    risk_regime: "elevated",
    layer1_drivers: [
      { zone: "USD", dominant_feature: "conflict_frac", zscore: 1.34, delta: 0.42 },
      { zone: "EUR", dominant_feature: "goldstein", zscore: 0.88, delta: 0.19 },
      { zone: "GBP", dominant_feature: "log_mentions", zscore: 0.64, delta: 0.12 }
    ],
    layer2_events: [
      {
        timestamp_utc: "2026-05-02",
        title: "EU trade sanctions escalation",
        zone: "EUR",
        salience: 0.81,
        tone: -0.52,
        url: "https://gdeltproject.org"
      },
      {
        timestamp_utc: "2026-05-03",
        title: "US-China technology export curbs",
        zone: "USD",
        salience: 0.77,
        tone: -0.41,
        url: "https://gdeltproject.org"
      }
    ],
    layer3_edges: [
      { from: "USD", to: "EUR", weight: 0.48 },
      { from: "USD", to: "JPY", weight: 0.32 },
      { from: "EUR", to: "GBP", weight: 0.41 }
    ]
  },
  report: {
    timestamp_utc: baseTimestamp,
    top_pick: "GBPUSD",
    overall_action: "trade",
    alpha_score: 74,
    pair_analyses: [
      {
        pair: "GBPUSD",
        direction: "bullish",
        conviction: 0.069,
        position_pct: 0.75,
        sl_pct: 1.52,
        tp_pct: 2.51,
        estimated_vol_3d: 0.0049,
        regime: "high_attention",
        source: "macro_gbpusd"
      },
      {
        pair: "USDJPY",
        direction: "neutral",
        conviction: 0.0,
        position_pct: 0.0,
        sl_pct: 0.0,
        tp_pct: 0.0,
        estimated_vol_3d: 0.0064,
        regime: "high_attention",
        source: "tech_usdjpy"
      }
    ],
    stale_inputs: [],
    narrative: [
      "GBPUSD macro bias remains constructive with fundamental mispricing leading the score.",
      "High-attention regime active, position size reduced by 25%.",
      "USDJPY volatility signal is active but directional conviction is below the hold gate."
    ],
    consensus_weights: {
      macro: 0.4,
      technical: 0.2,
      sentiment: 0.15,
      geopolitical: 0.25
    }
  },
  priceSeries: [
    { time: "2026-04-18", open: 1.2731, high: 1.2792, low: 1.2689, close: 1.2774 },
    { time: "2026-04-21", open: 1.2774, high: 1.2813, low: 1.2708, close: 1.2739 },
    { time: "2026-04-22", open: 1.2739, high: 1.2786, low: 1.2675, close: 1.2701 },
    { time: "2026-04-23", open: 1.2701, high: 1.2748, low: 1.2642, close: 1.2666 },
    { time: "2026-04-24", open: 1.2666, high: 1.2712, low: 1.2611, close: 1.2697 },
    { time: "2026-04-25", open: 1.2697, high: 1.2741, low: 1.2648, close: 1.2681 },
    { time: "2026-04-28", open: 1.2681, high: 1.2738, low: 1.2641, close: 1.2719 },
    { time: "2026-04-29", open: 1.2719, high: 1.2789, low: 1.2695, close: 1.2762 },
    { time: "2026-04-30", open: 1.2762, high: 1.2834, low: 1.2737, close: 1.2816 },
    { time: "2026-05-01", open: 1.2816, high: 1.2852, low: 1.2769, close: 1.2783 },
    { time: "2026-05-02", open: 1.2783, high: 1.2827, low: 1.2744, close: 1.2761 },
    { time: "2026-05-03", open: 1.2761, high: 1.2798, low: 1.2702, close: 1.2724 },
    { time: "2026-05-04", open: 1.2724, high: 1.2769, low: 1.2678, close: 1.2709 }
  ],
  impactTimeline: [
    {
      timestamp_utc: "2026-05-02",
      title: "EU trade sanctions escalation",
      zone: "EUR",
      impact: "high",
      volatility_spike: {
        timestamp_utc: "2026-05-03",
        label: "3d vol spike +0.21",
        magnitude: 0.21
      }
    },
    {
      timestamp_utc: "2026-05-03",
      title: "US-China technology export curbs",
      zone: "USD",
      impact: "medium",
      volatility_spike: {
        timestamp_utc: "2026-05-04",
        label: "3d vol spike +0.17",
        magnitude: 0.17
      }
    }
  ],
  reasoningLog: [
    {
      id: "macro-001",
      agent: "macro",
      timestamp_utc: "2026-05-04 08:04:12",
      title: "Fundamental mispricing dominates",
      detail: "MacroSignal shows fundamental mispricing score (0.33) as the dominant driver. Surprise overlay contributed +0.18 from UK CPI and wage growth events.",
      doc_path: "docs/macro_agent_pipeline.md",
      excerpt: "Macro Agent Orchestrator computes dominant_driver from carry, regime, fundamental, surprise, bias."
    },
    {
      id: "tech-001",
      agent: "technical",
      timestamp_utc: "2026-05-04 08:04:23",
      title: "Multi-timeframe votes split",
      detail: "D1 and H4 are bearish while H1 remains bullish, producing a net bearish bias with low confidence.",
      doc_path: "docs/technical_agent_pipeline.md",
      excerpt: "Timeframe votes preserve D1/H4/H1 directional outputs for explainability."
    },
    {
      id: "sent-001",
      agent: "sentiment",
      timestamp_utc: "2026-05-04 08:05:04",
      title: "Composite stress flag active",
      detail: "GDELT attention z-score and macro attention z-score both exceed 1.0. Stress sources: gdelt_attention, macro_attention.",
      doc_path: "docs/sentiment_agent_pipeline.md",
      excerpt: "composite_stress_flag fires when both attention z-scores exceed the threshold."
    },
    {
      id: "geo-001",
      agent: "geopolitical",
      timestamp_utc: "2026-05-04 08:06:17",
      title: "Rising USD conflict intensity",
      detail: "USD zone conflict fraction is +1.34 z-score with a 0.42 delta trend, pushing bilateral risk higher.",
      doc_path: "docs/geopolitical_agent_pipeline.md",
      excerpt: "Delta features capture rising stress and are concatenated with levels before z-scoring."
    },
    {
      id: "coord-001",
      agent: "coordinator",
      timestamp_utc: "2026-05-04 08:07:01",
      title: "GBPUSD routed to macro tier",
      detail: "Coordinator selects macro_gbpusd for directional track with medium conviction tier. High-attention regime trims position sizing.",
      doc_path: "docs/alpha_generator_pipeline.md",
      excerpt: "Signal Router routes GBPUSD to macro_gbpusd with medium tier weight."
    }
  ],
  selectedReasoning: null,
  setSelectedPair: (pair) => set({ selectedPair: pair }),
  setSelectedReasoning: (item) => set({ selectedReasoning: item }),
  setAgentState: (agent, state) =>
    set((current) => ({
      agentStates: { ...current.agentStates, [agent]: state }
    })),
  hydrateFromPayload: (payload) =>
    set((current) => ({
      report: payload.report ?? current.report,
      macroSignal: payload.macro ?? current.macroSignal,
      technicalSignal: payload.technical ?? current.technicalSignal,
      sentimentSignal: payload.sentiment ?? current.sentimentSignal,
      geopoliticalSignal: payload.geopolitical ?? current.geopoliticalSignal,
      reasoningLog: payload.reasoning ?? current.reasoningLog,
      priceSeries: payload.priceSeries ?? current.priceSeries,
      impactTimeline: payload.impactTimeline ?? current.impactTimeline
    }))
}));

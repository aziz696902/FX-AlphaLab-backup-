export type Pair = "EURUSD" | "GBPUSD" | "USDJPY" | "USDCHF";
export type Direction = "bullish" | "bearish" | "neutral";
export type VolatilityRegime = "high" | "low";
export type AgentState = "idle" | "running" | "stale" | "error";

export type MacroDriverName = "carry" | "regime" | "fundamental" | "surprise" | "bias";

export interface MacroDriver {
  name: MacroDriverName;
  label: string;
  score: number;
  delta: number;
}

export interface TopCalendarEvent {
  event_id: string;
  timestamp_utc: string;
  country: string;
  event_name: string;
  impact: "high" | "medium" | "low";
  contribution: number;
}

export interface MacroSignal {
  kind: "macro";
  pair: Pair;
  timestamp_utc: string;
  direction: Direction;
  macro_confidence: number;
  carry_signal_score: number;
  regime_context_score: number;
  fundamental_mispricing_score: number;
  macro_surprise_score: number;
  macro_bias_score: number;
  dominant_driver: MacroDriverName;
  top_calendar_events: TopCalendarEvent[];
  drivers: MacroDriver[];
}

export interface IndicatorSnapshot {
  rsi: number;
  macd_hist: number;
  bb_pct: number;
  above_ema200: boolean;
  atr_pct_rank: number;
}

export interface ConfluenceLevel {
  level: number;
  alignment: string;
  strength: "major" | "minor";
}

export interface TechnicalSignal {
  kind: "technical";
  pair: Pair;
  timestamp_utc: string;
  direction: Direction;
  confidence: number;
  volatility_regime: VolatilityRegime;
  indicator_snapshot: IndicatorSnapshot;
  timeframe_votes: Record<"D1" | "H4" | "H1", 0 | 1>;
  confluence_levels: ConfluenceLevel[];
}

export interface StocktwitsBreakdown {
  bullish_score: number;
  bearish_score: number;
  net_sentiment: number;
}

export interface RedditPairView {
  risk_off_score: number;
  risk_on_score: number;
  sentiment_strength_wmean: number;
}

export interface SentimentContext {
  reddit_global_activity_zscore: number | null;
  reddit_pair_views: Partial<Record<Pair, RedditPairView>> | null;
  stocktwits_pair_breakdown: Partial<Record<Pair, StocktwitsBreakdown>> | null;
}

export interface SentimentSignal {
  kind: "sentiment";
  timestamp_utc: string;
  usdjpy_stocktwits_vol_signal: number | null;
  usdjpy_stocktwits_active: boolean;
  gdelt_tone_zscore: number | null;
  gdelt_attention_zscore: number | null;
  macro_attention_zscore: number | null;
  composite_stress_flag: boolean;
  stress_sources: Array<"gdelt_attention" | "macro_attention">;
  context: SentimentContext | null;
}

export interface GeoDriver {
  zone: "USD" | "EUR" | "GBP" | "JPY" | "CHF";
  dominant_feature: string;
  zscore: number;
  delta: number;
}

export interface GeoEvent {
  timestamp_utc: string;
  title: string;
  zone: "USD" | "EUR" | "GBP" | "JPY" | "CHF";
  salience: number;
  tone: number;
  url: string;
}

export interface GeoGraphEdge {
  from: "USD" | "EUR" | "GBP" | "JPY" | "CHF";
  to: "USD" | "EUR" | "GBP" | "JPY" | "CHF";
  weight: number;
}

export interface GeopoliticalSignal {
  kind: "geopolitical";
  timestamp_utc: string;
  bilateral_risk_score: number;
  risk_regime: "normal" | "elevated";
  layer1_drivers: GeoDriver[];
  layer2_events: GeoEvent[];
  layer3_edges: GeoGraphEdge[];
}

export interface PairAnalysis {
  pair: Pair;
  direction: Direction;
  conviction: number;
  position_pct: number;
  sl_pct: number;
  tp_pct: number;
  estimated_vol_3d: number;
  regime: "normal" | "high_attention";
  source: "tech_usdjpy" | "macro_gbpusd" | "macro_eurusd" | "macro_usdjpy" | "macro_usdchf";
}

export interface CoordinatorReport {
  timestamp_utc: string;
  top_pick: Pair;
  overall_action: "trade" | "hold";
  alpha_score: number;
  pair_analyses: PairAnalysis[];
  stale_inputs: string[];
  narrative: string[];
  consensus_weights: Record<"macro" | "technical" | "sentiment" | "geopolitical", number>;
}

export interface ReasoningItem {
  id: string;
  agent: "macro" | "technical" | "sentiment" | "geopolitical" | "coordinator";
  timestamp_utc: string;
  title: string;
  detail: string;
  doc_path: string;
  excerpt: string;
}

export type AgentOutput = MacroSignal | TechnicalSignal | SentimentSignal | GeopoliticalSignal;

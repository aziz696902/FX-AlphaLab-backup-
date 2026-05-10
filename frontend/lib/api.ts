const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

// ── API types ─────────────────────────────────────────────────────────────────

export interface CoordinatorReportAPI {
  date: string;
  top_pick: string | null;
  overall_action: string;
  hold_reason: string | null;
  global_regime: string | null;
  narrative_context: Record<string, unknown> | null;
}

export interface IndicatorSnapshot {
  rsi: number;
  macd_hist: number;
  bb_pct: number;
  above_ema200: boolean;
  atr_pct_rank: number;
}

export interface TopEvent {
  actor1_name: string | null;
  actor2_name: string | null;
  goldstein_scale: number;
  avg_tone: number;
  num_mentions: number;
  quad_class: number;
  source_url: string | null;
}

export interface ZoneExplanation {
  zone: string;
  risk_score: number;
  feature_zscores: Record<string, number>;
  dominant_driver: string;
}

export interface CalendarEvent {
  event_name: string;
  country: string;
  surprise_direction: number;
  surprise_magnitude: number;
  impact_weight: number;
  prob: number;
  contribution: number;
}

export interface AgentSignalAPI {
  date: string;
  pair: string;
  tech_direction: number | null;
  tech_confidence: number | null;
  tech_vol_regime: string | null;
  geo_bilateral_risk: number | null;
  geo_risk_regime: string | null;
  macro_direction: string | null;
  macro_confidence: number | null;
  macro_carry_score: number | null;
  macro_regime_score: number | null;
  macro_fundamental_score: number | null;
  macro_surprise_score: number | null;
  macro_bias_score: number | null;
  macro_dominant_driver: string | null;
  usdjpy_stocktwits_vol_signal: number | null;
  gdelt_tone_zscore: number | null;
  gdelt_attention_zscore: number | null;
  macro_attention_zscore: number | null;
  composite_stress_flag: boolean | null;
  tech_indicator_snapshot: IndicatorSnapshot | null;
  tech_timeframe_votes: Record<string, number> | null;
  geo_top_events: TopEvent[] | null;
  geo_base_zone_explanation: ZoneExplanation | null;
  geo_quote_zone_explanation: ZoneExplanation | null;
  geo_graph: { zone_risk_scores: Record<string, number>; edge_weights: Record<string, number> } | null;
  macro_top_calendar_events: CalendarEvent[] | null;
  sentiment_stress_sources: string[] | null;
  sentiment_stocktwits_breakdown: Record<string, unknown> | null;
}

export interface CoordinatorSignalAPI {
  date: string;
  pair: string;
  vol_signal: number | null;
  vol_source: string | null;
  direction: number | null;
  direction_source: string | null;
  direction_horizon: string | null;
  direction_ic: number | null;
  confidence_tier: string | null;
  flat_reason: string | null;
  regime: string | null;
  suggested_action: string | null;
  conviction_score: number | null;
  position_size_pct: number | null;
  sl_pct: number | null;
  tp_pct: number | null;
  risk_reward_ratio: number | null;
  estimated_vol_3d: number | null;
  is_top_pick: boolean | null;
  overall_action: string | null;
}

export interface DateSignalsAPI {
  date: string;
  agent_signals: AgentSignalAPI[];
  coordinator_signals: CoordinatorSignalAPI[];
}

export interface OHLCVBarAPI {
  timestamp_utc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export const fetchLatestReport = () => get<CoordinatorReportAPI>("/reports/latest");

export const fetchSignals = (date: string) => get<DateSignalsAPI>(`/signals/${date}`);

export const fetchOHLCV = (instrument: string, tf = "H1", days = 30) =>
  get<OHLCVBarAPI[]>(`/ohlcv/${instrument}?tf=${tf}&days=${days}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

export type ActionLabel = "BUY" | "SELL" | "HOLD";

export function toActionLabel(suggested_action: string | null): ActionLabel {
  if (suggested_action === "LONG") return "BUY";
  if (suggested_action === "SHORT") return "SELL";
  return "HOLD";
}

export function toConfidenceLabel(tier: string | null): string {
  if (tier === "high") return "3/3";
  if (tier === "medium") return "2/3";
  if (tier === "low") return "1/3";
  return "—";
}

// Derive WS base from API_BASE (handles http→ws and https→wss)
export const WS_BASE = API_BASE.replace(/^http/, "ws");

export type LiveStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface LiveTick {
  pair: string;
  bid: number;
  ask: number;
  spreadPips: number;
  timeMs: number;
}

export interface LivePosition {
  ticket: number;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  openTime: string;
}

export interface LiveAccount {
  balance: number;
  equity: number;
  margin: number;
  marginFree: number;
  marginLevel: number;
  profit: number;
}

export interface TradeRequest {
  pair: string;
  side: "BUY" | "SELL";
  volume: number;
  orderType?: "MARKET" | "LIMIT" | "STOP";
  price?: number;
  sl?: number;
  tp?: number;
  comment?: string;
}

export interface TradeResult {
  success: boolean;
  ticket?: number | null;
  retcode: number;
  fillPrice?: number | null;
  volumeFilled?: number | null;
  errorMessage?: string | null;
}

export interface LivePendingOrder {
  ticket: number;
  symbol: string;
  type: string;   // "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP" | etc.
  volume: number;
  price: number;  // trigger price
  sl: number;
  tp: number;
  timeSetup: string;  // ISO datetime
}

export interface HistoricalTrade {
  ticket: number;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  entryPrice: number;
  exitPrice: number | null;
  entryTime: string;
  exitTime: string | null;
  profit: number;
  swap: number;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function openTrade(req: TradeRequest): Promise<TradeResult> {
  const r = await post<Record<string, unknown>>("/trade/open", req);
  return {
    success: Boolean(r.success),
    ticket: r.ticket == null ? null : Number(r.ticket),
    retcode: Number(r.retcode ?? 0),
    fillPrice: r.fill_price == null ? null : Number(r.fill_price),
    volumeFilled: r.volume_filled == null ? null : Number(r.volume_filled),
    errorMessage: r.error_message == null ? null : String(r.error_message),
  };
}

export async function closeTrade(ticket: number): Promise<TradeResult> {
  const r = await post<Record<string, unknown>>(`/trade/close/${ticket}`);
  return {
    success: Boolean(r.success),
    ticket: r.ticket == null ? null : Number(r.ticket),
    retcode: Number(r.retcode ?? 0),
    fillPrice: r.fill_price == null ? null : Number(r.fill_price),
    volumeFilled: r.volume_filled == null ? null : Number(r.volume_filled),
    errorMessage: r.error_message == null ? null : String(r.error_message),
  };
}

export async function closeAllTrades(): Promise<TradeResult[]> {
  const r = await post<Record<string, unknown>[]>(`/trade/close-all`);
  return r.map((it) => ({
    success: Boolean(it.success),
    ticket: it.ticket == null ? null : Number(it.ticket),
    retcode: Number(it.retcode ?? 0),
    fillPrice: it.fill_price == null ? null : Number(it.fill_price),
    volumeFilled: it.volume_filled == null ? null : Number(it.volume_filled),
    errorMessage: it.error_message == null ? null : String(it.error_message),
  }));
}

export async function fetchPositions(): Promise<LivePosition[]> {
  const r = await get<Record<string, unknown>[]>(`/trade/positions`);
  return r.map((p) => ({
    ticket: Number(p.ticket),
    symbol: String(p.symbol),
    side: (String(p.side) as "BUY" | "SELL"),
    volume: Number(p.volume),
    openPrice: Number(p.open_price),
    currentPrice: Number(p.current_price),
    sl: Number(p.sl ?? 0),
    tp: Number(p.tp ?? 0),
    profit: Number(p.profit ?? 0),
    swap: Number(p.swap ?? 0),
    openTime: String(p.open_time ?? ""),
  }));
}

export async function fetchAccount(): Promise<LiveAccount> {
  const r = await get<Record<string, unknown>>(`/trade/account`);
  return {
    balance: Number(r.balance ?? 0),
    equity: Number(r.equity ?? 0),
    margin: Number(r.margin ?? 0),
    marginFree: Number(r.margin_free ?? 0),
    marginLevel: Number(r.margin_level ?? 0),
    profit: Number(r.profit ?? 0),
  };
}

export async function fetchPendingOrders(): Promise<LivePendingOrder[]> {
  const r = await get<Record<string, unknown>[]>(`/trade/orders`);
  return r.map((o) => ({
    ticket: Number(o.ticket),
    symbol: String(o.symbol),
    type: String(o.type),
    volume: Number(o.volume),
    price: Number(o.price),
    sl: Number(o.sl ?? 0),
    tp: Number(o.tp ?? 0),
    timeSetup: String(o.time_setup ?? ""),
  }));
}

export async function fetchTradeHistory(days = 30): Promise<HistoricalTrade[]> {
  const r = await get<Record<string, unknown>[]>(`/trade/history?days=${days}`);
  return r.map((t) => ({
    ticket: Number(t.ticket),
    symbol: String(t.symbol),
    side: String(t.side) as "BUY" | "SELL",
    volume: Number(t.volume),
    entryPrice: Number(t.entry_price),
    exitPrice: t.exit_price == null ? null : Number(t.exit_price),
    entryTime: String(t.entry_time ?? ""),
    exitTime: t.exit_time == null ? null : String(t.exit_time),
    profit: Number(t.profit ?? 0),
    swap: Number(t.swap ?? 0),
  }));
}

export async function cancelOrder(ticket: number): Promise<TradeResult> {
  const r = await del<Record<string, unknown>>(`/trade/orders/${ticket}`);
  return {
    success: Boolean(r.success),
    ticket: r.ticket == null ? null : Number(r.ticket),
    retcode: Number(r.retcode ?? 0),
    fillPrice: r.fill_price == null ? null : Number(r.fill_price),
    volumeFilled: r.volume_filled == null ? null : Number(r.volume_filled),
    errorMessage: r.error_message == null ? null : String(r.error_message),
  };
}

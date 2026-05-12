export const DETAILS = {

  // ──────────────────────────────────────────────────────────────────────
  // TECHNICAL AGENT
  // ──────────────────────────────────────────────────────────────────────

  mt5: {
    tag: 'Data Source', title: 'MetaTrader 5 Terminal', sub: 'Live FX broker · OHLCV',
    desc: 'Streams OHLCV price bars for 4 currency pairs (EURUSDm, GBPUSDm, USDJPYm, USDCHFm) across H1, H4, D1. Windows-only live connection. Data written to Bronze exactly as received — never transformed at this stage.',
    metrics: [
      { l: 'Pairs',      v: 'EURUSDm, GBPUSDm, USDJPYm, USDCHFm' },
      { l: 'Timeframes', v: 'H1, H4, D1' },
      { l: 'Output',     v: 'Bronze CSV (data/raw/mt5/)' }
    ]
  },

  raw_store: {
    tag: 'Storage · Bronze', title: 'Raw Storage', sub: 'Immutable archive',
    desc: 'Bars written exactly as received from MT5. No transformation, no cleaning. Permanent archive. Naming: mt5_{pair}_{tf}_{YYYYMMDD}.csv. Fields: timestamp (Unix epoch), open, high, low, close, volume, source="mt5".',
    metrics: [
      { l: 'Format',    v: 'CSV' },
      { l: 'Transform', v: 'None (immutable)' },
      { l: 'Path',      v: 'data/raw/mt5/' }
    ]
  },

  price_norm: {
    tag: 'Preprocessing · NB20', title: 'DukascopyPreprocessor', sub: 'Bronze → Silver OHLCV',
    desc: 'Reads MT5 Bronze CSVs and produces Silver Parquet. Midnight UTC anchor (NB20): daily bars are anchored to 00:00 UTC to align with the macro monthly pipeline. Validates OHLC consistency (high ≥ open/close/low), deduplicates timestamps, converts Unix epoch → UTC ISO 8601. `_resample_ohlcv` is module-level for FastAPI reuse.',
    metrics: [
      { l: 'Timestamp',  v: 'Midnight UTC anchor (NB20)' },
      { l: 'Validation', v: 'OHLC consistency + dedup' },
      { l: 'Output',     v: 'ohlcv_{pair}_{tf}_{start}_{end}.parquet' },
      { l: 'Tests',      v: '16/16 passing' }
    ]
  },

  proc_store: {
    tag: 'Storage · Silver', title: 'Processed Storage', sub: 'Canonical agent input',
    desc: 'Standardized OHLCV parquet files. Single source of truth for all downstream agents. Naming: ohlcv_{pair}_{timeframe}_{start}_{end}.parquet.',
    metrics: [
      { l: 'Format', v: 'Parquet' },
      { l: 'Schema', v: 'timestamp_utc, pair, tf, O/H/L/C/V, source' },
      { l: 'Path',   v: 'data/processed/ohlcv/' }
    ]
  },

  feat_eng: {
    tag: 'Technical · Stage 1', title: 'Feature Engineering', sub: '15 indicators + ATR rank',
    desc: 'Computes 15 technical indicators via add_features(). Also computes atr_pct_rank (252-day rolling ATR percentile) exclusively for the volatility regime label — this is NOT a model input. The IndicatorSnapshot (Layer 1 explainability) is captured from the last unscaled D1 bar before MinMax scaling.',
    metrics: [
      { l: 'Returns',      v: 'log return, squared log return' },
      { l: 'Momentum',     v: 'RSI(14), MACD(12/26), momentum(5,20)' },
      { l: 'Volatility',   v: 'ATR(14), BB upper/lower/%' },
      { l: 'Trend',        v: 'EMA(20), EMA(50), EMA(200)' },
      { l: 'Regime input', v: 'ATR pct rank 252-day (not model feature)' }
    ]
  },

  minmax: {
    tag: 'Technical · Stage 2', title: 'MinMax Scaler', sub: '[0, 1] · train-time only',
    desc: 'Normalizes all 15 features to [0, 1] using statistics fit exclusively on training data (up to 2023-12-31). Never refitted at inference. Prevents data leakage and distribution drift.',
    metrics: [
      { l: 'Range',           v: '[0, 1]' },
      { l: 'Fit',             v: 'Training data only (≤ 2023-12-31)' },
      { l: 'Inference refit', v: 'Never' }
    ]
  },

  lstm_d1: {
    tag: 'Technical · Model', title: 'LSTM D1', sub: 'Daily timeframe · mandatory anchor',
    desc: '2-layer stacked LSTM, 128 hidden units, 30% dropout, sigmoid output. Predicts prob_up for next D1 bar. Acts as the mandatory anchor — provides timestamp, volatility_regime, and IndicatorSnapshot for the fused signal. 12 production models total (4 pairs × 3 timeframes).',
    metrics: [
      { l: 'Architecture', v: '2-layer LSTM → dropout → sigmoid' },
      { l: 'Hidden units', v: '128' },
      { l: 'Sequence len', v: '60 bars' },
      { l: 'Output',       v: 'prob_up [0, 1]' },
      { l: 'ROC-AUC',      v: '0.50 – 0.54 (near-random by design)' },
      { l: 'Role',         v: 'Mandatory anchor (timestamp + regime)' }
    ]
  },

  lstm_h4: {
    tag: 'Technical · Model', title: 'LSTM H4', sub: '4-hour timeframe',
    desc: '2-layer LSTM, identical architecture to D1. Predicts prob_up for next H4 bar. Fused with equal weight (1/3). AUC 0.50–0.54 is expected — FX next-bar direction is close to a random walk.',
    metrics: [
      { l: 'Architecture',  v: '2-layer LSTM → dropout → sigmoid' },
      { l: 'Sequence len',  v: '30 bars' },
      { l: 'Fusion weight', v: '1/3 (equal)' }
    ]
  },

  lstm_h1: {
    tag: 'Technical · Model', title: 'LSTM H1', sub: '1-hour timeframe',
    desc: '2-layer LSTM, identical architecture. Predicts prob_up for next H1 bar. Fused with equal weight (1/3). Production artifact: models/production/{pair}_H1.pkl.',
    metrics: [
      { l: 'Architecture',  v: '2-layer LSTM → dropout → sigmoid' },
      { l: 'Sequence len',  v: '30 bars' },
      { l: 'Fusion weight', v: '1/3 (equal)' }
    ]
  },

  mtf_fusion: {
    tag: 'Technical · Fusion', title: 'Multi-Timeframe Fusion', sub: 'Equal weights validated',
    desc: 'fused_score = (1/3)(D1−0.5) + (1/3)(H4−0.5) + (1/3)(H1−0.5). direction = 1 if fused_score ≥ 0 else 0. confidence = |fused_score| × 2. Equal weights empirically validated in NB03 — no learned weighting outperformed them. Timeframe votes preserved as Layer 2 explainability.',
    metrics: [
      { l: 'Weights',           v: '1/3 each (D1 / H4 / H1)' },
      { l: 'Confidence formula', v: '|fused_score| × 2' },
      { l: 'Typical confidence', v: '0.02 – 0.04 (weak by design)' },
      { l: 'Layer 2',           v: 'timeframe_votes: {D1, H4, H1} → 0/1' }
    ]
  },

  tech_signal: {
    tag: 'Output Signal', title: 'TechnicalSignal', sub: 'One per pair per day',
    desc: "The Technical Agent's output contract. direction and confidence from MTF fusion. volatility_regime from D1 ATR percentile rank. Two explainability layers attached at zero extra model cost: IndicatorSnapshot (5 human-readable D1 indicators) and timeframe_votes (per-TF directional vote). Coordinator uses volatility_regime for position sizing.",
    metrics: [
      { l: 'direction',          v: '1 = bullish · 0 = bearish' },
      { l: 'confidence',         v: '[0, 1] · typ. 0.02–0.04' },
      { l: 'volatility_regime',  v: '"high" or "low" (ATR pct rank > 0.6)' },
      { l: 'indicator_snapshot', v: 'Layer 1: RSI, MACD hist, BB%, EMA200, ATR rank' },
      { l: 'timeframe_votes',    v: 'Layer 2: {D1, H4, H1} → 1=bullish / 0=bearish' },
      { l: 'Artifacts',          v: 'models/production/{pair}_{tf}.pkl (12 total)' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // MACRO AGENT
  // ──────────────────────────────────────────────────────────────────────

  macro_store: {
    tag: 'Data Source', title: 'Macro Signals Store', sub: 'Monthly precomputed',
    desc: 'Precomputed monthly macro directional outputs. Path: data/processed/macro/macro_signal.parquet. Fields: pair, timestamp_utc (month-end), module_c_direction, macro_confidence, carry_signal_score, regime_context_score, fundamental_mispricing_score, macro_surprise_score, macro_bias_score.',
    metrics: [
      { l: 'Format',    v: 'Parquet' },
      { l: 'Frequency', v: 'Monthly (month-end timestamps)' },
      { l: 'Path',      v: 'data/processed/macro/macro_signal.parquet' }
    ]
  },

  events_store: {
    tag: 'Data Source', title: 'Economic Events Store', sub: 'Calendar + surprise fields',
    desc: 'Structured economic calendar. Path: data/processed/events/events_2021-01-01_2025-12-31.csv. Fields: timestamp_utc, event_id, country, event_name, impact (high/medium/low/non-economic), actual, forecast, previous, source.',
    metrics: [
      { l: 'Coverage',  v: '2021 – 2025' },
      { l: 'Impact levels', v: 'high(1.0), medium(0.5), low(0.25), non-economic(excluded)' }
    ]
  },

  mkt_ctx: {
    tag: 'Data Source', title: 'Market Context Stores', sub: 'D1 OHLCV + VIX CSV',
    desc: 'Two data sources consumed by Node 2 at load time for context feature construction: (1) D1 OHLCV parquets per pair at data/processed/ohlcv/; (2) VIX daily series at data/processed/macro/macro_VIXCLS_2021-01-01_2026-02-21.csv.',
    metrics: [
      { l: 'OHLCV',  v: 'data/processed/ohlcv/ohlcv_{PAIR}_D1_*.parquet' },
      { l: 'VIX',    v: 'macro_VIXCLS_2021-01-01_2026-02-21.csv' }
    ]
  },


  macro_node1: {
    tag: 'Macro · Node 1', title: 'Node 1: Macroeconomics', sub: 'Baseline monthly direction',
    desc: 'Loads macro_signal.parquet once at init and serves month-aware temporal lookups. A request for 2025-02-15 maps to the 2025-01-31 signal (latest month-end ≤ request date). Always active — mandatory baseline. Pair normalization: "EURUSDm" → "EURUSD".',
    metrics: [
      { l: 'Frequency',  v: 'Monthly (month-end)' },
      { l: 'Lookup rule', v: 'max(timestamp_utc) ≤ request_date' },
      { l: 'Role',       v: 'Mandatory baseline' }
    ]
  },

  macro_node2: {
    tag: 'Macro · Node 2 (Optional)', title: 'Node 2: Calendar Events', sub: 'Event surprise overlay',
    desc: 'Expensive load-time pass: reads pre-trained event-scoring models and events CSV, expands events per pair via PAIR_COUNTRY_SIGN, builds context features (returns, vol, ATR, Bollinger, VIX, 15 interactions), batch-scores event probabilities. At predict time: lightweight filter + weighted surprise aggregation → score ∈ [-1, 1]. Degrades gracefully to neutral on failure.',
    metrics: [
      { l: 'Score range',  v: '[-1, 1]' },
      { l: 'Aggregation',  v: 'Σ(prob × surprise_dir × country_sign × impact_w) / Σ(prob × impact_w)' },
      { l: 'LightGBM',     v: 'models/production/macro/lgb_models.joblib → EURUSD, USDCHF' },
      { l: 'CatBoost',     v: 'models/production/macro/catboost_models.joblib → GBPUSD, USDJPY' },
      { l: 'Layer 2',      v: 'top_calendar_events: top-5 events by |contribution|' },
      { l: 'Fault mode',   v: 'Degrades to macro_surprise_score = 0.0' }
    ]
  },

  macro_orch: {
    tag: 'Macro · Orchestrator', title: 'Orchestrator', sub: 'Fusion + dominant_driver',
    desc: 'Coordinates Node 1 (mandatory) and Node 2 (optional). Always gets baseline from Node 1. If Node 2 active: replaces macro_surprise_score and top_calendar_events fields. If Node 2 fails: logs warning, returns Node 1 signal safely. Computes dominant_driver (Layer 1) = argmax(|carry|, |regime|, |fundamental|, |surprise|).',
    metrics: [
      { l: 'Baseline',       v: 'Node 1 (always)' },
      { l: 'Overlay field',  v: 'macro_surprise_score (Node 2 only)' },
      { l: 'Layer 1',        v: 'dominant_driver: sub-score with highest |value|' },
      { l: 'Fault behavior', v: 'Safe fallback to Node 1' }
    ]
  },

  macro_signal: {
    tag: 'Output Signal', title: 'MacroSignal', sub: 'Monthly per pair',
    desc: 'Final macro signal with baseline direction + confidence from Node 1, optional surprise overlay from Node 2, and two explainability layers. Directional IC vs 5d forward return: GBPUSD +0.115 (medium), EURUSD/USDJPY +0.060 (low), USDCHF +0.033 (low).',
    metrics: [
      { l: 'module_c_direction',  v: '"up" or "down"' },
      { l: 'macro_confidence',    v: '[0, 1]' },
      { l: 'macro_surprise_score',v: '[-1, +1] (0.0 if Node 2 inactive)' },
      { l: 'dominant_driver',     v: 'Layer 1: "carry/regime/fundamental/surprise"' },
      { l: 'top_calendar_events', v: 'Layer 2: list[TopCalendarEvent] | None' },
      { l: 'Frequency',           v: 'Monthly' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // SENTIMENT AGENT — DATA SOURCES
  // ──────────────────────────────────────────────────────────────────────

  st_silver_src: {
    tag: 'Data Source · Silver', title: 'StockTwits Silver Checkpoint', sub: 'FinTwitBERT inference output',
    desc: 'Canonical input for StocktwitsSignalNode. Path: data/processed/stocktwits/labels_checkpoint.jsonl. One record per message: message_id, symbol, timestamp_published, prob_bullish, prob_bearish, predicted_label, model. Produced by StocktwitsPreprocessor running FinTwitBERT-sentiment at threshold=0.58. Immutable once written — incremental appends only.',
    metrics: [
      { l: 'Model',      v: 'FinTwitBERT-sentiment (fine-tuned)' },
      { l: 'Threshold',  v: '0.58 (validation-tuned)' },
      { l: 'Bal. accuracy', v: '0.851' },
      { l: 'Pairs',      v: 'EURUSD, GBPUSD, USDCHF, USDJPY' },
      { l: 'Coverage',   v: '2021-09-15 → present' }
    ]
  },

  gdelt_gkg_src: {
    tag: 'Data Source · Silver', title: 'GDELT GKG Silver', sub: 'Hive-partitioned Parquet',
    desc: 'Canonical input for GDELTSignalNode. BigQuery source: gdelt-bq.gdeltv2.gkg_partitioned. Bronze: monthly JSONL files at data/raw/news/gdelt/gdelt_YYYYMM_raw.jsonl. Silver: data/processed/sentiment/source=gdelt/year={Y}/month={M}/sentiment_cleaned.parquet. ~683k articles over 2021–2025, 1540 trading days.',
    metrics: [
      { l: 'BigQuery source', v: 'gdelt-bq.gdeltv2.gkg_partitioned' },
      { l: 'Filter',          v: 'ECON_CURRENCY or ECON_CENTRAL_BANK + EUR/USD/GBP/JPY' },
      { l: 'Coverage',        v: '2021-01-01 → 2025-12-31' },
      { l: 'Key field',       v: 'tone (V2Tone field 0)' }
    ]
  },

  gtrends_src: {
    tag: 'Data Source · Silver', title: 'Google Trends Silver', sub: '34 keywords · 4 themes · weekly',
    desc: 'Canonical input for GoogleTrendsSignalNode. Path: data/processed/sentiment/source=google_trends/google_trends_weekly.parquet. 262 rows × 35 cols (1 date + 34 keywords). 4 themes: macro_indicators, central_banks, fx_pairs, risk_sentiment. Bronze: 8 CSV files overwritten on each production refresh (pytrends normalization makes partial updates invalid).',
    metrics: [
      { l: 'Keywords',    v: '34 across 4 themes' },
      { l: 'Frequency',   v: 'Weekly (Sunday week-start)' },
      { l: 'Coverage',    v: '2021-01-01 → present' },
      { l: 'Path',        v: 'data/processed/sentiment/source=google_trends/' }
    ]
  },

  reddit_silver: {
    tag: 'Data Source · Silver', title: 'Reddit Silver Parquet', sub: 'Tier C · context only',
    desc: 'Canonical input for RedditSignalNode. Path: data/processed/sentiment/source=reddit/reddit_daily_signal.parquet. 25,458 LLM-labeled posts (2021–2025) from r/Forex (50%), r/investing (25%), r/stocks (25%). Only 3,449 posts pass the signal filter (content_type ≠ NOISE, stance_clarity ≠ QUESTION). IC near-zero — reactive, not predictive.',
    metrics: [
      { l: 'Total posts',    v: '25,458 LLM-labeled' },
      { l: 'Signal posts',   v: '3,449 (13.55% pass filter)' },
      { l: 'Predictive IC',  v: '~0.054 (does not survive BH correction)' },
      { l: 'Usage',          v: 'include_context=True only (not in main signal path)' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // SENTIMENT AGENT — NODES
  // ──────────────────────────────────────────────────────────────────────

  st_node: {
    tag: 'Sentiment · Tier A (Alpha)', title: 'StocktwitsSignalNode', sub: 'Bonferroni-proof vol signal',
    desc: 'Reads Silver checkpoint, applies exponential decay (half-life=5d, window=14d), aggregates to daily net_sentiment and signal_post_count per pair. USDJPY net_sentiment is the only Bonferroni-proof alpha signal in this agent. Higher bullish sentiment → lower USDJPY volatility (risk-on = JPY calm). Directional IC is non-significant.',
    metrics: [
      { l: 'Decay half-life',  v: '5 days' },
      { l: 'Decay window',     v: '14 days' },
      { l: 'USDJPY h=1 IC',   v: '−0.163 (p=0.000241, N=500)' },
      { l: 'USDJPY h=3 IC',   v: '−0.186 (p=0.000029) — Bonferroni-proof' },
      { l: 'Walk-forward',     v: '2024 IC=−0.218 (p=0.003) · 2025 IC=−0.115 (p=0.042)' },
      { l: 'Cross-pair',       v: 'USDCHF h=1 IC=−0.148 (p=0.001) in 2025 regime' }
    ]
  },

  gdelt_sent_node: {
    tag: 'Sentiment · Tier B (Regime)', title: 'GDELTSignalNode', sub: '30d rolling z-score',
    desc: 'Groups Silver articles by calendar date, computes tone_mean (mean V2Tone) and article_count. Applies 30-day rolling z-score (min 10 periods). Days with fewer than 3 articles have tone_zscore masked to NaN. Regime signal only — no directional IC. Walk-forward validation pending (current figures are in-sample).',
    metrics: [
      { l: 'tone_zscore IC',      v: '−0.051 to −0.073 vs next-day |return| (p<0.05)' },
      { l: 'attention_zscore IC', v: '+0.055 vs USDJPY |return| (p=0.033)' },
      { l: 'Directional IC',      v: 'mean |IC|=0.026 (below usability threshold)' },
      { l: 'Rolling window',      v: '30 days (min 10 periods)' },
      { l: 'Low-cov mask',        v: 'article_count < 3 → tone_zscore = NaN' }
    ]
  },

  gtrends_node: {
    tag: 'Sentiment · Tier B (Regime)', title: 'GoogleTrendsSignalNode', sub: '52w rolling z-score',
    desc: 'Reads weekly Silver Parquet, computes row-wise mean per theme group (4 indices), applies 30-week rolling z-score, forward-fills weekly → daily. macro_attention_zscore is the primary fusion signal. No directional IC (balanced accuracy ≈ 0.50). Walk-forward validation pending.',
    metrics: [
      { l: 'Primary signal',    v: 'macro_attention_zscore' },
      { l: 'Lasso RMSE',        v: '0.005069 vs baseline 0.007828 (absret_fwd_1w)' },
      { l: 'Rolling window',    v: '30 weeks (min 10 periods)' },
      { l: 'Forward-fill',      v: 'weekly → daily (ffill only, no backfill)' },
      { l: 'Directional IC',    v: 'balanced accuracy ≈ 0.50 (no signal)' }
    ]
  },

  reddit_node: {
    tag: 'Sentiment · Tier C (Context)', title: 'RedditSignalNode', sub: 'Explainability only',
    desc: 'Loads reddit_daily_signal.parquet. Only called when include_context=True — not part of the main signal path. Provides rolling 30-day activity z-score and pair-level risk sentiment (risk_off_score, risk_on_score, sentiment_strength_wmean). IC vs forward vol and direction is near-zero — predominantly reactive.',
    metrics: [
      { l: 'Usage',         v: 'include_context=True only' },
      { l: 'Predictive lag', v: 'strongest at lag −1 (markets move, Reddit reacts)' },
      { l: 'IC',             v: '~0.054 vs EURUSD |return| (does not survive BH)' },
      { l: 'Output',         v: 'SentimentContext.reddit_pair_views + activity_zscore' }
    ]
  },

  sent_agg: {
    tag: 'Sentiment · Aggregator', title: 'SentimentAgent', sub: 'composite_stress_flag · assembly',
    desc: 'Calls all four nodes over the requested date range. Assembles per-day SentimentSignal. Computes composite_stress_flag when BOTH gdelt_attention_zscore AND macro_attention_zscore exceed 1.0 simultaneously — an attention convergence signal. Derives stress_sources (Layer 1). Reddit context attached only when include_context=True.',
    metrics: [
      { l: 'composite_stress_flag', v: 'gdelt_attention > 1.0 AND macro_attention > 1.0' },
      { l: 'stress_sources',        v: 'Layer 1: ["gdelt_attention", "macro_attention"]' },
      { l: 'SentimentContext',      v: 'Layer 2: optional, include_context=True only' }
    ]
  },

  sent_signal: {
    tag: 'Output Signal', title: 'SentimentSignal', sub: 'One per DAY (not per pair)',
    desc: 'The Sentiment Agent output contract. Sparse by design — most fields can be null on a given day. No fusion layer, no confidence-weighted average, no per-pair directional score. The coordinator uses usdjpy_stocktwits_vol_signal for vol sizing and composite_stress_flag + z-scores as regime modulators.',
    metrics: [
      { l: 'usdjpy_stocktwits_vol_signal', v: 'Tier A: float | None (null = no activity)' },
      { l: 'gdelt_tone_zscore',            v: 'Tier B: 30d rolling z-score' },
      { l: 'gdelt_attention_zscore',       v: 'Tier B: 30d rolling z-score' },
      { l: 'macro_attention_zscore',       v: 'Tier B: 52w rolling z-score' },
      { l: 'composite_stress_flag',        v: 'Tier B: bool' },
      { l: 'stress_sources',               v: 'Layer 1: list[str]' },
      { l: 'context',                      v: 'Layer 2: SentimentContext | None' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // GEOPOLITICAL AGENT — DATA SOURCES
  // ──────────────────────────────────────────────────────────────────────

  gdelt_http: {
    tag: 'Data Source', title: 'GDELT 1.0 HTTP Feed', sub: 'Free daily exports',
    desc: 'Daily event exports from data.gdeltproject.org. No credentials, no cost. URL pattern: http://data.gdeltproject.org/events/YYYYMMDD.export.CSV.zip. 58-column tab-separated format covering all global geopolitical events. Zone-actor filtered at collection time (only events where Actor1 or Actor2 belongs to USD/EUR/GBP/JPY/CHF zone). Data range: 2022-01-01 onward (Russia-Ukraine invasion is the training anchor).',
    metrics: [
      { l: 'Source',      v: 'data.gdeltproject.org (GDELT 1.0)' },
      { l: 'Format',      v: '58-column TSV, zipped' },
      { l: 'Coverage',    v: '2022-01-01 → present (RU-UA anchor)' },
      { l: 'Zone filter', v: 'USD · EUR (21 countries) · GBP · JPY · CHF' }
    ]
  },

  gdelt_bronze: {
    tag: 'Storage · Bronze', title: 'Bronze Storage', sub: 'Daily parquets · zone-filtered',
    desc: 'Raw GDELT events written to disk exactly as downloaded. Zone-actor filtering applied at collection time. One parquet file per calendar day. Immutable. Path: data/raw/gdelt_events/{YYYY}/{MM}/{YYYYMMDD}.parquet. CamelCase column names preserved from GDELT source.',
    metrics: [
      { l: 'Path',       v: 'data/raw/gdelt_events/{YYYY}/{MM}/{YYYYMMDD}.parquet' },
      { l: 'Columns',    v: 'Original GDELT CamelCase (GoldsteinScale, AvgTone, etc.)' },
      { l: 'Transform',  v: 'None (immutable)' }
    ]
  },

  gdelt_clean_silver: {
    tag: 'Storage · Silver', title: 'Clean Silver', sub: 'GDELTEventsPreprocessor output',
    desc: 'GDELTEventsPreprocessor reads each day\'s Bronze parquet and outputs validated, typed event records. Column names → snake_case, timestamps → UTC, numeric columns → float64/Int64, malformed rows dropped. Monthly parquet files. Model-agnostic — consumed at inference for Layer 2 explainability (top GDELT events driving zone risk).',
    metrics: [
      { l: 'Path',       v: 'data/processed/gdelt_events/year={Y}/month={M}/gdelt_events_cleaned.parquet' },
      { l: 'Key fields', v: 'event_date, actor1/2_country_code, goldstein_scale, avg_tone, num_mentions' },
      { l: 'Used for',   v: 'Layer 2: top events lookup at inference' }
    ]
  },

  zone_feat_silver: {
    tag: 'Storage · Silver', title: 'Zone Features Silver', sub: 'GDELTZoneFeatureBuilder output',
    desc: 'GDELTZoneFeatureBuilder aggregates clean Silver events into one row per calendar day. Single flat parquet. 46 columns: date + 5 node features × 5 zones + 20 directed edge weights between zones. Zone features: log_count, goldstein (severity), conflict_frac, avg_tone, log_mentions. Edge weights: log1p(count) of zone→zone event flows. Used as the model\'s primary data source AND for Layer 3 graph visualization.',
    metrics: [
      { l: 'Path',          v: 'data/processed/geopolitical/zone_features_daily.parquet' },
      { l: 'Shape',         v: '1 row/day · 46 cols (1 date + 25 node feat + 20 edges)' },
      { l: 'Node features', v: '5 per zone: log_count, goldstein, conflict_frac, tone, log_mentions' },
      { l: 'Edge weights',  v: '20 directed flows (log1p of event count between zone pairs)' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // GEOPOLITICAL AGENT — INTERNALS
  // ──────────────────────────────────────────────────────────────────────

  delta_zscore: {
    tag: 'Geopolitical · Stage 1', title: 'Delta + Z-Score', sub: 'Δgeo · 30d rolling z-score',
    desc: 'Two operations applied strictly in sequence with no lookahead. (1) Delta computation: Δgeo[t] = X[t] − mean(X[t−5:t]) per feature per zone — captures rising/falling stress trend, not absolute level. Zero-padded for first 5 days. (2) Concat [levels, delta] → 10-dim per zone. (3) Rolling 30-day z-score on the combined array: z[t] = (combined[t] − mean(combined[t−30:t])) / std(combined[t−30:t]). Makes signal regime-agnostic.',
    metrics: [
      { l: 'Delta formula',  v: 'Δgeo[t] = X[t] − mean(X[t−5:t])' },
      { l: 'Combined dim',   v: '10-dim per zone (5 levels + 5 deltas)' },
      { l: 'Z-score window', v: '30 days (excludes target day)' },
      { l: 'Cold start',     v: 'Min 35 days needed (30 z-score + 5 delta)' },
      { l: 'Delta IC gain',  v: '+43% test IC (0.070 → 0.099); 8/8 quarters positive' }
    ]
  },

  gat_ensemble: {
    tag: 'Geopolitical · Stage 2', title: 'GAT Ensemble × 15 Seeds', sub: '5-zone graph · 10-dim input',
    desc: 'Graph Attention Network ensemble. 5-node zone graph (USD, EUR, GBP, JPY, CHF) with static dense adjacency (all nodes attend to all others including self-loops). Architecture: GATLayerV2 10→32 (4 heads, concat) → BatchNorm1d → GATLayerV2 32→8 (4 heads, averaged) → Linear(8→1) per zone. ~1,800 parameters. 15 random-seed models run in parallel and averaged — necessary because 614 training days produce high seed variance. Lag-1 alignment: uses GDELT date T-1 to predict FX vol on trading day T.',
    metrics: [
      { l: 'Architecture', v: 'GATv2 10→32→8 + Linear head per zone' },
      { l: 'Parameters',   v: '~1,800 total' },
      { l: 'Ensemble',     v: '15 seeds averaged' },
      { l: 'Test IC mean', v: '0.099 vs fwd_vol_3d (OOS 2025)' },
      { l: 'Val IC mean',  v: '0.174 (2024)' },
      { l: 'Artifacts',    v: 'models/production/gdelt_gat_final_states.pt + gdelt_gat_config.json' }
    ]
  },

  bilateral_agg: {
    tag: 'Geopolitical · Stage 3', title: 'Bilateral Aggregation', sub: 'score[base] + score[quote]',
    desc: 'Combines the 5 zone risk scores into pair-specific bilateral scores. bilateral_risk_score = zone_risk[base_zone] + zone_risk[quote_zone]. USD zone appears in 3 of 4 pairs — its score is computed once and reused. Adding new pairs requires no retraining. risk_regime threshold = 1.0.',
    metrics: [
      { l: 'Formula',         v: 'zone_risk[base] + zone_risk[quote]' },
      { l: 'risk_regime',     v: '"high" if bilateral_risk_score > 1.0 else "low"' },
      { l: 'Zone collapse',   v: 'All 4 pairs effectively use USD zone as dominant driver' },
      { l: 'Coordinator tier',v: 'A — all 4 pairs positive on both val and test sets' }
    ]
  },

  geo_signal: {
    tag: 'Output Signal', title: 'GeopoliticalSignal', sub: 'One per pair per day',
    desc: 'Predicts 3-day forward realized FX volatility (z-scored). Used by the Coordinator exclusively on the VOL TRACK — not as a directional vote. Three explainability layers attached at zero extra model cost. Coordinator applies OLS calibration (intercept=0.004057, slope=0.002405) to map the signal to expected daily log-return σ.',
    metrics: [
      { l: 'bilateral_risk_score', v: 'float: zone_risk[base] + zone_risk[quote]' },
      { l: 'risk_regime',          v: '"high" if > 1.0 else "low"' },
      { l: 'Layer 1',              v: 'base/quote_zone_explanation: level feature z-scores' },
      { l: 'Layer 2',              v: 'top_events: top-5 GDELT events from dominant zone' },
      { l: 'Layer 3',              v: 'graph: ZoneGraphData (5 scores + 20 edge weights)' },
      { l: 'Test IC (2025)',        v: 'EURUSD 0.109 · GBPUSD 0.092 · USDJPY 0.086 · USDCHF 0.111' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // COORDINATOR
  // ──────────────────────────────────────────────────────────────────────

  sig_table: {
    tag: 'Coordinator · Stage 0', title: 'Signal Table', sub: 'signals_aligned.parquet',
    desc: 'All agent signals joined by (date, pair) into a single flat parquet. 4,172 rows × ~20 signal columns (2022–2025). Each agent runs independently for date T, then signals are aligned. fwd_* columns (fwd_ret_1d, fwd_ret_5d, fwd_vol_3d, fwd_vol_5d, fwd_vol_10d) present for offline evaluation but stripped before any CoordinatorReport computation.',
    metrics: [
      { l: 'Shape',      v: '4,172 rows × 20 signal columns' },
      { l: 'Period',     v: '2022 – 2025' },
      { l: 'Key fields', v: 'tech_direction, tech_confidence, tech_vol_regime, geo_bilateral_risk, macro_direction, macro_confidence, usdjpy_stocktwits_vol_signal, gdelt_tone_zscore, macro_attention_zscore, composite_stress_flag' },
      { l: 'Path',       v: 'data/processed/coordinator/signals_aligned.parquet' }
    ]
  },

  sig_router: {
    tag: 'Coordinator · Stage 1', title: 'Signal Router', sub: 'Empirically validated IC gates',
    desc: 'For each pair, routes to the appropriate directional source based on validated empirical IC/accuracy. Stateless and deterministic — no learned weights at inference. USDJPY routing uses USDJPY_P75_THRESHOLD=0.0887 fit on 2022–2023 training data only.',
    metrics: [
      { l: 'USDJPY (high conf)',   v: 'tech_direction if confidence ≥ 0.0887 (top 8.5%) · tier=high · 1d' },
      { l: 'USDJPY (otherwise)',   v: 'macro_direction · tier=low · 5d (82.7% of USDJPY days)' },
      { l: 'GBPUSD',              v: 'macro_direction · tier=medium · 5d (IC=+0.115)' },
      { l: 'EURUSD',              v: 'macro_direction · tier=low · 5d (IC=+0.060)' },
      { l: 'USDCHF',              v: 'macro_direction · tier=low · 5d (IC=+0.033)' }
    ]
  },

  vol_fusion: {
    tag: 'Coordinator · Stage 2', title: 'Vol Track Fusion', sub: 'StockTwits vs Geo · OLS calib.',
    desc: 'Computes sign-normalized volatility forecast used exclusively for SL/TP sizing (never influences direction). StockTwits IC is negative — signal is inverted before use. OLS calibration maps normalized vol to expected daily log-return σ, fit on 2022–2023 only. Constants should be refit quarterly with expanding window.',
    metrics: [
      { l: 'USDJPY + active',    v: 'StockTwits (inverted) — geo R²=0.005, irrelevant on active days' },
      { l: 'USDJPY + inactive',  v: 'Geo bilateral risk (IC=+0.109 on inactive USDJPY days)' },
      { l: 'EUR/GBP/CHF',        v: 'Geo bilateral risk (IC=+0.12–0.14)' },
      { l: 'Geo OLS',            v: 'intercept=0.004057, slope=0.002405 · test IC=+0.116' },
      { l: 'StockTwits OLS',     v: 'intercept=0.006403, slope=0.004930 · test IC=+0.230 (2025)' }
    ]
  },

  conviction: {
    tag: 'Coordinator · Stage 3', title: 'Conviction Scoring', sub: 'tier_weight × direction_edge',
    desc: 'conviction = tier_weight × direction_edge. Tier weights express empirical confidence: 1.0 for validated tech gate, 0.6 for GBPUSD macro (walk-forward confirmed), 0.3 for other macro signals. Direction edges are empirically measured IC or accuracy−0.5.',
    metrics: [
      { l: 'tech_usdjpy gate',  v: '1.0 × 0.086 = 0.086 (binomial p=0.014)' },
      { l: 'macro_gbpusd',      v: '0.6 × 0.115 = 0.069 (IC walk-forward confirmed)' },
      { l: 'macro_eurusd',      v: '0.3 × 0.060 = 0.018' },
      { l: 'macro_usdjpy',      v: '0.3 × 0.058 = 0.017' },
      { l: 'macro_usdchf',      v: '0.3 × 0.033 = 0.010' }
    ]
  },

  hold_gate: {
    tag: 'Coordinator · Stage 4', title: 'HOLD Gate + Position Sizing', sub: 'SL/TP · R:R = 1.67',
    desc: 'HOLD fires when max(conviction) < 0.02, or when high_attention regime AND max(conviction) < 0.05. In practice GBPUSD conviction (0.069) prevents HOLD on every day with valid macro_direction — HOLD is only a safety net for data-gap days. SL and TP distances are fixed multiples of OLS-calibrated expected move.',
    metrics: [
      { l: 'HOLD threshold',    v: 'conviction < 0.02 (0.05 in high_attention regime)' },
      { l: 'Size (high tier)',  v: '2.0% of equity (× 0.75 in high_attention)' },
      { l: 'Size (medium)',     v: '1.0% of equity (× 0.75 in high_attention)' },
      { l: 'Size (low)',        v: '0.5% of equity (× 0.75 in high_attention)' },
      { l: 'SL distance',       v: '1.5 × expected_move × 100 (% of entry)' },
      { l: 'TP distance',       v: '2.5 × expected_move × 100 · R:R always 1.67' }
    ]
  },

  regime_overlay: {
    tag: 'Coordinator · Stage 5', title: 'Regime Overlay', sub: 'macro_attention_zscore > 1.0',
    desc: 'Fires when macro_attention_zscore > 1.0, setting global_regime = "high_attention". Effects: position sizes scaled ×0.75; HOLD conviction floor raised to 0.05. Does NOT change direction or conviction scores. Represents an elevated retail attention regime where the USDJPY risk-on interpretation of StockTwits sentiment is less reliable.',
    metrics: [
      { l: 'Trigger',         v: 'macro_attention_zscore > 1.0' },
      { l: 'Effect on sizes', v: '× 0.75 (all tiers)' },
      { l: 'Effect on HOLD',  v: 'Raises floor to 0.05' },
      { l: 'Effect on dir.',  v: 'None' }
    ]
  },

  coord_report: {
    tag: 'Coordinator · Output', title: 'CoordinatorReport', sub: 'top_pick · conviction · SL/TP',
    desc: 'The Coordinator\'s final output packet. Produced deterministically — all numbers pre-computed before the LLM Narrator receives them. Backtest (2022–2025, 150 trades): Sharpe 1.077, max DD −0.13%, win rate 50.7%, profit factor 1.48. Top pick is GBPUSD 83.3% of days, USDJPY 16.7%.',
    metrics: [
      { l: 'top_pick',         v: 'pair to trade (GBPUSD 83.3% · USDJPY 16.7%)' },
      { l: 'overall_action',   v: '"trade" or "hold"' },
      { l: 'PairAnalysis',     v: '4 total — direction, conviction, size%, SL%, TP%, vol_est' },
      { l: 'Sharpe (2022–25)', v: '1.077' },
      { l: 'Max drawdown',     v: '−0.13%' },
      { l: 'Profit factor',    v: '1.48 · win rate 50.7%' }
    ]
  },

  llm_narrator: {
    tag: 'Coordinator · Narrator', title: 'LLM Narrator', sub: 'Prose · no invented numbers',
    desc: 'Receives narrative_context dict with all pre-computed numbers from CoordinatorReport and produces 4–6 sentences of plain-English rationale. Strict contract: the LLM narrates pre-computed numbers only — it is explicitly forbidden from deriving, modifying, or inventing any figure. Covers: what to trade and why, how much to risk, where to place SL/TP, regime context, and a one-line summary of secondary pairs.',
    metrics: [
      { l: 'Input',    v: 'narrative_context dict (all numbers pre-computed)' },
      { l: 'Output',   v: '4–6 sentences of plain-English rationale' },
      { l: 'Contract', v: 'LLM narrates only — zero invented or derived numbers' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // FINAL OUTPUT
  // ──────────────────────────────────────────────────────────────────────

  report_json: {
    tag: 'Output · Persistent', title: 'Daily JSON Report', sub: 'outputs/reports/{date}.json',
    desc: 'CoordinatorReport serialized to JSON after each daily run. If any upstream source fails to refresh, the report is still produced with a stale_inputs field listing the affected sources — the user sees a staleness warning in the dashboard.',
    metrics: [
      { l: 'Path',          v: 'outputs/reports/{date}.json' },
      { l: 'stale_inputs',  v: 'list[str] — populated when upstream source fails' }
    ]
  },

  react_dash: {
    tag: 'Output · Dashboard', title: 'React Dashboard', sub: 'Next.js + FastAPI backend',
    desc: 'Next.js frontend wired to a FastAPI Python backend. Serves agent signals from PostgreSQL/TimescaleDB Gold layer. Displays: overall action (TRADE/HOLD), top pick with direction and confidence tier, position size %, SL/TP distances, OHLCV chart with coordinator overlay, per-pair tabs, agent highlights. No broker integration — the user trades manually in MetaTrader 5.',
    metrics: [
      { l: 'Frontend',   v: 'Next.js (React)' },
      { l: 'Backend',    v: 'FastAPI (Python)' },
      { l: 'Data store', v: 'PostgreSQL + TimescaleDB (Gold layer)' },
      { l: 'Key panels', v: 'TRADE/HOLD · top_pick · conviction · SL/TP · OHLCV chart · narrative' },
      { l: 'Broker',     v: 'None — manual execution only' }
    ]
  },

  user_mt5: {
    tag: 'Output · Execution', title: 'User → MetaTrader 5', sub: 'Manual execution',
    desc: 'The user reads the Streamlit dashboard and manually executes the recommended trade in MetaTrader 5. To convert: pips = sl_pct / 100 × price / pip_size; notional = position_size_pct / 100 × account_equity.',
    metrics: [
      { l: 'SL in pips', v: 'sl_pct / 100 × current_price / pip_size' },
      { l: 'TP in pips', v: 'tp_pct / 100 × current_price / pip_size' },
      { l: 'Notional',   v: 'position_size_pct / 100 × account_equity' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // MACRO SIGNAL BUILD PIPELINE
  // ──────────────────────────────────────────────────────────────────────

  fred_api_src: {
    tag: 'Raw Source · FRED', title: 'FRED API', sub: 'Federal Reserve Economic Data',
    desc: 'St. Louis Fed API providing 20+ US macro series used as input features for the VAR+LSTM model. Fetched by FREDCollector and written to Bronze CSV.',
    metrics: [
      { l: 'Key series', v: 'DFF, CPIAUCSL, UNRATE, GDPC1, PAYEMS, BOPGSTB, STLFSI4, VIXCLS, BAMLH0A0HYM2' },
      { l: 'Frequency',  v: 'Daily / Monthly / Quarterly (mixed)' },
      { l: 'Bronze path', v: 'data/raw/fred/fred_*.csv' },
      { l: 'Collector',  v: 'FREDCollector (src/ingestion/collectors/)' }
    ]
  },

  ecb_sdw_src: {
    tag: 'Raw Source · ECB', title: 'ECB SDW API', sub: 'ECB Statistical Data Warehouse',
    desc: 'ECB Statistical Data Warehouse providing policy interest rates. Three rate types collected: DFR (Deposit Facility Rate), MRR (Main Refinancing Operations Rate), MLF (Marginal Lending Facility Rate).',
    metrics: [
      { l: 'Rates',      v: 'ECB_DFR · ECB_MRR · ECB_MLF' },
      { l: 'Frequency',  v: 'Business days' },
      { l: 'Bronze path', v: 'data/raw/ecb/ecb_policy_rates_*.csv' },
      { l: 'Collector',  v: 'ECBCollector (src/ingestion/collectors/)' }
    ]
  },

  fed_doc_web: {
    tag: 'Raw Source · Fed Documents', title: 'Fed.gov Scraper', sub: 'Press releases and speeches',
    desc: 'FedScraperCollector fetches FOMC press releases and Fed speeches from static year-based HTML archive pages (no Selenium). Documents exported as JSONL to Bronze. Used exclusively for hawk/dove tone calculation — no FinBERT is applied here.',
    metrics: [
      { l: 'Sources',    v: '/newsevents/pressreleases/ · /newsevents/speech/' },
      { l: 'Bronze path', v: 'data/raw/news/fed/*.jsonl' },
      { l: 'Collector',  v: 'FedScraperCollector' },
      { l: 'Note',       v: 'NOT in FinBERT/NewsPreprocessor path — macro tone only' }
    ]
  },

  ecb_doc_web: {
    tag: 'Raw Source · ECB Documents', title: 'ECB.europa.eu', sub: 'Statements and press conferences',
    desc: 'ECBScraperCollector fetches ECB monetary policy statements and press conference transcripts. Exported as JSONL. Used for hawk/dove tone scoring in MacroSignalBuilder — separate from the FinBERT sentiment pipeline.',
    metrics: [
      { l: 'Bronze path', v: 'data/raw/news/ecb/*.jsonl' },
      { l: 'Collector',  v: 'ECBScraperCollector' },
      { l: 'Note',       v: 'NOT in FinBERT path — macro tone feature only' }
    ]
  },

  boe_doc_web: {
    tag: 'Raw Source · BoE Documents', title: 'BoE Scraper', sub: 'MPC statements and speeches',
    desc: 'BoEScraperCollector fetches Bank of England MPC statements and speeches. Exported as JSONL. Used for hawk/dove tone in MacroSignalBuilder alongside Fed and ECB documents.',
    metrics: [
      { l: 'Bronze path', v: 'data/raw/news/boe/*.jsonl' },
      { l: 'Collector',  v: 'BoEScraperCollector' },
      { l: 'Note',       v: 'NOT in FinBERT path — macro tone feature only' }
    ]
  },

  fred_bronze_b: {
    tag: 'Bronze · FRED', title: 'FRED Bronze CSVs', sub: 'Immutable raw series data',
    desc: 'Raw FRED series stored as one CSV per series in data/raw/fred/. Schema: [date, series_id, value, source, frequency, units]. Immutable — never modified after collection.',
    metrics: [
      { l: 'Path',      v: 'data/raw/fred/fred_{SERIES}_{YYYYMMDD}.csv' },
      { l: 'Schema',    v: 'date · series_id · value · source · frequency · units' },
      { l: 'Series',    v: '20+ US indicators (rates, inflation, employment, etc.)' }
    ]
  },

  ecb_bronze_b: {
    tag: 'Bronze · ECB', title: 'ECB Bronze CSVs', sub: 'Raw ECB policy rate data',
    desc: 'ECB policy rate data stored as CSV in data/raw/ecb/. Contains PROVIDER_FM_ID (DFR/MRR_FR/MRR_MBR), TIME_PERIOD, OBS_VALUE, FREQ columns. Immutable after collection.',
    metrics: [
      { l: 'Path',    v: 'data/raw/ecb/ecb_policy_rates_*.csv' },
      { l: 'Schema',  v: 'PROVIDER_FM_ID · TIME_PERIOD · OBS_VALUE · FREQ · source' },
      { l: 'Rates',   v: 'DFR · MRR_FR · MRR_MBR' }
    ]
  },

  news_jsonl_b: {
    tag: 'Bronze · News Docs', title: 'News Bronze JSONL', sub: 'Fed + ECB + BoE raw documents',
    desc: 'Central Bronze store for all three central bank document sources. Each JSONL line: {title, content/full_text, timestamp_published, timestamp_collected, source, document_type, speaker, url}. All three scrapers write here.',
    metrics: [
      { l: 'Path',   v: 'data/raw/news/{fed|ecb|boe}/*.jsonl' },
      { l: 'Schema', v: 'title · content · timestamp_published · source · document_type · speaker · url' },
      { l: 'Sources', v: 'FedScraperCollector · ECBScraperCollector · BoEScraperCollector' }
    ]
  },

  macro_normalizer_p: {
    tag: 'Preprocessor · Macro', title: 'MacroNormalizer', sub: 'Bronze → Silver · FRED + ECB consolidated',
    desc: 'Reads all FRED Bronze CSVs and ECB Bronze CSVs, transforms to Silver schema [timestamp_utc, series_id, value, source, frequency, units], deduplicates, and consolidates all series into a single macro_all.parquet. Writes atomically via temp file. ECB rate codes are mapped: DFR→ECB_DFR, MRR_FR→ECB_MRR, MRR_MBR→ECB_MLF.',
    metrics: [
      { l: 'Input',     v: 'data/raw/fred/ + data/raw/ecb/' },
      { l: 'Output',    v: 'data/processed/macro/macro_all.parquet' },
      { l: 'Sources',   v: 'FRED (20+ series) + ECB (DFR · MRR · MLF)' },
      { l: 'Schema',    v: 'timestamp_utc · series_id · value · source · frequency · units' },
      { l: 'Class',     v: 'MacroNormalizer (src/ingestion/preprocessors/)' }
    ]
  },

  news_extractor_p: {
    tag: 'Preprocessor · News', title: 'News Text Extractor', sub: '_write_news_parquets (orchestrator)',
    desc: 'Simple JSONL→partitioned-parquet writer in CollectionOrchestrator. Reads Bronze JSONL, extracts [timestamp_utc, text (title + content[:500]), source], and writes Hive-partitioned parquets. Critically: NO FinBERT, no sentiment scoring. MacroSignalBuilder then applies its own hawk/dove keyword counts on this text.',
    metrics: [
      { l: 'Input',    v: 'data/raw/news/{fed|ecb|boe}/*.jsonl' },
      { l: 'Output',   v: 'data/processed/macro/news/{source}/year={Y}/month={M}/news_cleaned.parquet' },
      { l: 'Schema',   v: 'timestamp_utc · text · source' },
      { l: 'No ML',    v: 'No FinBERT — hawk/dove applied later in MacroSignalBuilder' },
      { l: 'Method',   v: 'CollectionOrchestrator._write_news_parquets()' }
    ]
  },

  macro_all_p: {
    tag: 'Silver · Macro', title: 'macro_all.parquet', sub: 'Consolidated FRED + ECB long-format',
    desc: 'Single consolidated Silver file containing all macro series from both FRED and ECB. Long-format: one row per (series_id, timestamp_utc). MacroSignalBuilder pivots this into a monthly wide matrix before building features.',
    metrics: [
      { l: 'Path',       v: 'data/processed/macro/macro_all.parquet' },
      { l: 'Schema',     v: 'timestamp_utc · series_id · value · source · frequency · units' },
      { l: 'Series',     v: 'DFF · ECB_DFR · ECB_MRR · ECB_MLF · CPIAUCSL · UNRATE · GDPC1 · STLFSI4 · VIXCLS · BAML + more' },
      { l: 'Pivot step', v: 'MacroSignalBuilder._load_macro_monthly() → monthly wide matrix' }
    ]
  },

  d1_ohlcv_ref: {
    tag: 'Silver · OHLCV', title: 'D1 OHLCV parquets', sub: 'From Dukascopy pipeline (NB20)',
    desc: 'Daily OHLCV parquets produced by DukascopyPreprocessor (NB20). MacroSignalBuilder reads these to compute monthly log-returns per pair — used as the target variable for VAR training and as a feedback signal in rolling inference. Shared with the Technical Agent pipeline.',
    metrics: [
      { l: 'Path',      v: 'data/processed/ohlcv/ohlcv_{PAIR}_D1_*.parquet' },
      { l: 'Pairs',     v: 'EURUSD · GBPUSD · USDJPY · AUDUSD' },
      { l: 'Use',       v: 'Monthly close → log-return target for VAR+LSTM' },
      { l: 'Source',    v: 'DukascopyPreprocessor (shared with Technical Agent)' }
    ]
  },

  var_lstm_pkl: {
    tag: 'Model Artifact · Macro', title: 'macro_hybrid_models.pkl', sub: 'VAR+LSTM × 4 pairs · NB05',
    desc: 'Serialized inference bundle produced by notebook 05. One MacroHybridArtifact per pair, each containing: feature_cols, var_top_indices, best_lag, var_fit (statsmodels VARResultsWrapper), lstm_state_dict (_ResidualLSTM hidden=32), StandardScaler, var_history_tail, resid_tail, train_cutoff. Must exist before MacroSignalBuilder can run.',
    metrics: [
      { l: 'Path',       v: 'models/production/macro/macro_hybrid_models.pkl' },
      { l: 'Pairs',      v: 'EURUSD · GBPUSD · USDJPY · AUDUSD' },
      { l: 'VAR arch',   v: 'statsmodels VAR · best_lag selected by AIC' },
      { l: 'LSTM arch',  v: '_ResidualLSTM: input=1 → LSTM(hidden=32) → Linear(1)' },
      { l: 'Training',   v: 'Notebook 05 only — no retraining in inference path' }
    ]
  },

  news_cleaned_p: {
    tag: 'Silver · News Text', title: 'news_cleaned.parquet', sub: 'Hawk/dove text · partitioned by source',
    desc: 'Partitioned Silver parquets containing cleaned document text. Schema: [timestamp_utc, text, source]. MacroSignalBuilder reads these and applies hawk/dove keyword counts to derive NEWS_FED_TONE, NEWS_ECB_TONE, NEWS_BOE_TONE, NEWS_ECB_MINUS_FED, NEWS_BOE_MINUS_FED features. Entirely separate from the FinBERT sentiment_cleaned.parquet used by the Sentiment Agent.',
    metrics: [
      { l: 'Path',       v: 'data/processed/macro/news/{source}/year={Y}/month={M}/news_cleaned.parquet' },
      { l: 'Schema',     v: 'timestamp_utc · text · source' },
      { l: 'Hawk words', v: 'inflation · tighten · hike · restrictive · hawkish · higher for longer' },
      { l: 'Dove words', v: 'cut · easing · accommodative · recession · slowdown · dovish' },
      { l: 'Output',     v: 'tone = (hawk − dove) / (1 + hawk + dove) per month per source' }
    ]
  },

  msb_node: {
    tag: 'Preprocessor · Macro Signal', title: 'MacroSignalBuilder', sub: 'VAR+LSTM forward pass · Kalman smooth',
    desc: 'Inference-only preprocessor that assembles all Silver inputs and runs the VAR+LSTM model forward pass to produce macro_signal.parquet. Never retrains. Feature matrix: rate levels/momentum/differentials, CPI/inflation YoY, real rates, risk indicators (STLFSI4, VIXCLS, BAML), news tone features (5 columns). Per-pair feature selection driven by pair identity (EUR/USD/GBP relevance). Rolling 1-step-ahead VAR then LSTM-on-residuals (teacher-forced on actual residuals). Kalman smoother fills NaN gaps in all feature columns.',
    metrics: [
      { l: 'Input 1',   v: 'macro_all.parquet → monthly pivot → derived features' },
      { l: 'Input 2',   v: 'news_cleaned.parquet → hawk/dove tone (5 features)' },
      { l: 'Input 3',   v: 'D1 OHLCV → monthly log-return (VAR feedback)' },
      { l: 'Input 4',   v: 'macro_hybrid_models.pkl (VAR+LSTM artifacts)' },
      { l: 'VAR step',  v: 'Rolling 1-step-ahead; actual y as feedback' },
      { l: 'LSTM step', v: 'ResidualLSTM on VAR residuals; teacher-forced from LOOKBACK_MONTHS=12' },
      { l: 'Output',    v: 'hybrid = var_forecast + lstm_forecast → 9-field macro_signal.parquet' },
      { l: 'Class',     v: 'MacroSignalBuilder (src/ingestion/preprocessors/)' }
    ]
  },

  macro_sig_out: {
    tag: 'Silver · Macro Signal', title: 'macro_signal.parquet', sub: 'Output of build pipeline → feeds Macro Agent',
    desc: 'Final output of the macro signal build pipeline. Monthly-frequency signal per pair. Consumed by MacroeconomicsNode (Node 1 of Macro Agent) via month-end temporal lookup. A request for 2025-02-15 maps to the 2025-01-31 signal (latest signal with timestamp_utc ≤ request date).',
    metrics: [
      { l: 'Path',         v: 'data/processed/macro/macro_signal.parquet' },
      { l: 'Pairs',        v: 'EURUSD · GBPUSD · USDJPY · AUDUSD' },
      { l: 'Columns',      v: 'module_c_direction · macro_confidence · carry_signal_score · regime_context_score · fundamental_mispricing_score · macro_surprise_score · macro_bias_score' },
      { l: 'Frequency',    v: 'Monthly (month-end timestamps)' },
      { l: 'Consumer',     v: 'MacroeconomicsNode.predict(pair, date) — month-end lookup' },
      { l: 'Feeds →',      v: 'macro_store node (Macro Agent data source)' }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // SENTIMENT DATA BUILD PIPELINES
  // ──────────────────────────────────────────────────────────────────────

  st_api_raw: {
    tag: 'Raw Source · StockTwits', title: 'Stocktwits API', sub: 'Public REST · 4 FX symbols',
    desc: 'StocktwitsCollector fetches post streams from the public Stocktwits REST API for 4 FX symbols (EURUSD, GBPUSD, USDCHF, USDJPY). Each post is pre-labeled with optional user-applied bullish/bearish tags — making this unique among sentiment sources. Rate limited: MIN_REQUEST_INTERVAL=1.5s, backoff on 429.',
    metrics: [
      { l: 'Endpoint',   v: 'api.stocktwits.com/api/2/streams/symbol/{symbol}.json' },
      { l: 'Symbols',    v: 'EURUSD · GBPUSD · USDCHF · USDJPY' },
      { l: 'Bronze path', v: 'data/raw/news/stocktwits/{symbol}_raw.jsonl' },
      { l: 'Collector',  v: 'StocktwitsCollector (incremental by cursor)' }
    ]
  },

  st_bronze: {
    tag: 'Bronze · StockTwits', title: 'StockTwits Bronze JSONL', sub: 'Immutable raw message stream',
    desc: 'Raw Stocktwits messages appended incrementally to per-symbol JSONL files. Each record: {message_id, symbol, body, timestamp_published, user_labels (bullish/bearish if set), sentiment_user if available}. Immutable — collector only appends.',
    metrics: [
      { l: 'Path',     v: 'data/raw/news/stocktwits/{symbol}_raw.jsonl' },
      { l: 'Schema',   v: 'message_id · symbol · body · timestamp_published · user sentiment label' },
      { l: 'Update',   v: 'Incremental cursor-based append; no overwrites' }
    ]
  },

  st_fintwitbert: {
    tag: 'Preprocessor · StockTwits', title: 'FinTwitBERT Preprocessor', sub: 'StephanAkkerman/FinTwitBERT-sentiment',
    desc: 'StocktwitsPreprocessor loads the FinTwitBERT model (BERT fine-tuned on financial Twitter text) and runs batch inference on all unprocessed posts. Skips already-labeled message_ids via checkpoint. Threshold=0.58: if prob_bullish ≥ 0.58 → bullish, else bearish. Text normalized: URLs→URL token, cashtags expanded, lowercased. Max length 128 tokens.',
    metrics: [
      { l: 'Model',      v: 'StephanAkkerman/FinTwitBERT-sentiment (HuggingFace)' },
      { l: 'Labels',     v: 'bullish (1) · bearish (0)' },
      { l: 'Threshold',  v: '0.58 for bullish; else bearish' },
      { l: 'Batch size', v: '32' },
      { l: 'Output',     v: 'message_id · symbol · timestamp_published · prob_bullish · prob_bearish · predicted_label · model' }
    ]
  },

  st_checkpoint: {
    tag: 'Silver · StockTwits', title: 'labels_checkpoint.jsonl', sub: 'FinTwitBERT-labeled posts',
    desc: 'JSONL checkpoint file containing all FinTwitBERT-labeled StockTwits posts. StocktwitsSignalNode reads this directly — no parquet conversion. Growing append-only file; deduplication by message_id at read time. Half-life decay (5d) and 14-day rolling window applied at inference time inside the node.',
    metrics: [
      { l: 'Path',        v: 'data/processed/sentiment/source=stocktwits/labels_checkpoint.jsonl' },
      { l: 'Schema',      v: 'message_id · symbol · timestamp_published · prob_bullish · prob_bearish · predicted_label · model' },
      { l: 'Consumer',    v: 'StocktwitsSignalNode.compute(start, end)' },
      { l: 'Format',      v: 'JSONL (not parquet) — read line-by-line at inference time' },
      { l: 'Feeds →',     v: 'st_silver_src node (Sentiment Agent input)' }
    ]
  },

  gkg_bq_raw: {
    tag: 'Raw Source · GDELT GKG', title: 'BigQuery GDELTv2 GKG', sub: 'gdelt-bq.gdeltv2.gkg_partitioned',
    desc: 'GDELTGKGCollector queries the public BigQuery GDELT v2 GKG partitioned table. Filters for articles with FX/central bank themes (ECON_CURRENCY, ECON_CENTRAL_BANK) and currency mentions (EUR/USD/GBP/JPY). Dry-run cost guard: aborts if query exceeds 5GB scanned. Monthly output files.',
    metrics: [
      { l: 'Table',      v: 'gdelt-bq.gdeltv2.gkg_partitioned' },
      { l: 'Filter',     v: 'ECON_CURRENCY OR ECON_CENTRAL_BANK AND (EUR OR USD OR GBP OR JPY)' },
      { l: 'Cost guard', v: 'Aborts if dry-run scan > 5GB' },
      { l: 'Bronze path', v: 'data/raw/gdelt_gkg/gdelt_{YYYYMM}_raw.jsonl' },
      { l: 'Collector',  v: 'GDELTGKGCollector' }
    ]
  },

  gkg_bronze: {
    tag: 'Bronze · GDELT GKG', title: 'GDELT GKG Bronze JSONL', sub: 'Monthly FX-filtered article records',
    desc: 'Monthly JSONL files of GKG records filtered for FX/central-bank relevance. Schema: {timestamp_published, url, source_domain, v2tone (CSV of 7 floats), themes, locations, organizations, source, timestamp_collected}. Deduplicated by URL hash within each day.',
    metrics: [
      { l: 'Path',     v: 'data/raw/gdelt_gkg/gdelt_{YYYYMM}_raw.jsonl' },
      { l: 'Schema',   v: 'url · source_domain · timestamp_published · v2tone · themes · locations · organizations' },
      { l: 'V2Tone',   v: 'CSV: tone,positive_score,negative_score,polarity,activity_ref_density,self_group_ref_density,word_count' }
    ]
  },

  gkg_preprocessor: {
    tag: 'Preprocessor · GDELT GKG', title: 'GDELTGKGPreprocessor', sub: 'Bronze → Silver · V2Tone parsing',
    desc: 'Reads monthly Bronze JSONL, parses V2Tone CSV into 7 float columns, cleans text fields, and writes Hive-partitioned Silver parquets. Processes month-by-month with skip-if-exists logic. Output schema follows SILVER_COLUMNS contract.',
    metrics: [
      { l: 'Input',    v: 'data/raw/gdelt_gkg/gdelt_{YYYYMM}_raw.jsonl' },
      { l: 'Output',   v: 'data/processed/sentiment/source=gdelt/year={Y}/month={M}/sentiment_cleaned.parquet' },
      { l: 'Schema',   v: 'timestamp_utc · url · source_domain · source · tone · positive_score · negative_score · polarity · activity_ref_density · self_group_ref_density · word_count · themes · locations · organizations' },
      { l: 'Class',    v: 'GDELTGKGPreprocessor' }
    ]
  },

  gkg_silver: {
    tag: 'Silver · GDELT GKG', title: 'sentiment_cleaned.parquet', sub: 'Partitioned · tone + themes + orgs',
    desc: 'Hive-partitioned Silver parquets for GDELT GKG. GDELTSignalNode reads these and computes 30-day rolling z-score on tone for each currency pair. Tier B signal: less IC than StockTwits (USDJPY) but provides macro attention signal used in composite_stress_flag.',
    metrics: [
      { l: 'Path',       v: 'data/processed/sentiment/source=gdelt/year={Y}/month={M}/sentiment_cleaned.parquet' },
      { l: 'Key field',  v: 'tone: net sentiment score (V2Tone field 1)' },
      { l: 'Node use',   v: 'GDELTSignalNode: 30d rolling z-score on tone' },
      { l: 'Tier',       v: 'B — regime overlay signal' },
      { l: 'Feeds →',    v: 'gdelt_gkg_src node (Sentiment Agent input)' }
    ]
  },

  gtrends_api_raw: {
    tag: 'Raw Source · Google Trends', title: 'Google Trends API', sub: 'pytrends · 34 keywords · 4 themes',
    desc: 'GoogleTrendsCollector uses the pytrends library to fetch weekly interest-over-time data for 34 keywords across 4 thematic groups: fx_pairs, central_banks, macro_indicators, risk_sentiment. Fetched in 8 batches of up to 5 keywords each (Google Trends limit). Rate: 45–75s random sleep between batches to avoid bot detection.',
    metrics: [
      { l: 'Library',    v: 'pytrends' },
      { l: 'Themes',     v: 'fx_pairs · central_banks · macro_indicators · risk_sentiment' },
      { l: 'Keywords',   v: '34 total in 8 batches (≤5 per batch)' },
      { l: 'Frequency',  v: 'Weekly interest-over-time (0–100 normalized)' },
      { l: 'Bronze path', v: 'data/raw/google_trends/trends_{theme}_{n}.csv' }
    ]
  },

  gtrends_bronze: {
    tag: 'Bronze · Google Trends', title: 'Google Trends Bronze CSVs', sub: '8 batch CSVs · weekly index',
    desc: '8 Bronze CSV files — one per keyword batch. Columns: date + up to 5 keyword columns (weekly interest 0–100). isPartial column dropped at collection time. Files are full-history fetches from 2021 (fetch_from from source config) and are overwritten on each collection run.',
    metrics: [
      { l: 'Path',     v: 'data/raw/google_trends/trends_{theme}_{n}.csv (8 files)' },
      { l: 'Columns',  v: 'date · {keyword_1} · ... · {keyword_5}' },
      { l: 'Values',   v: 'Weekly interest index 0–100 (Google-normalized)' },
      { l: 'Note',     v: 'Full-history re-fetch from source_config.fetch_from on every run' }
    ]
  },

  gtrends_prep: {
    tag: 'Preprocessor · Google Trends', title: 'GoogleTrendsPreprocessor', sub: '8 CSVs → outer join → single parquet',
    desc: 'Reads all 8 Bronze CSVs, prefixes column names with theme tag (e.g. fx_pairs__EURUSD), outer-joins all frames on date, sorts and deduplicates. Produces a single flat Silver parquet with date + 34 keyword columns. Weekly frequency preserved.',
    metrics: [
      { l: 'Input',    v: '8 × data/raw/google_trends/trends_*.csv' },
      { l: 'Output',   v: 'data/processed/sentiment/google_trends_weekly.parquet' },
      { l: 'Schema',   v: 'date · {theme}__{keyword} × 34 cols' },
      { l: 'Join',     v: 'Outer join on date; sort + dedup last' },
      { l: 'Class',    v: 'GoogleTrendsPreprocessor' }
    ]
  },

  gtrends_weekly: {
    tag: 'Silver · Google Trends', title: 'google_trends_weekly.parquet', sub: 'Single flat file · 34 keyword cols',
    desc: 'Single Silver parquet containing all 34 keyword columns at weekly frequency. GoogleTrendsSignalNode reads this, forward-fills to daily, computes 52-week rolling z-score on macro_attention (ECB/Fed/BoJ keyword group), and uses macro_attention_zscore > 1.0 for regime overlay in the Coordinator.',
    metrics: [
      { l: 'Path',        v: 'data/processed/sentiment/google_trends_weekly.parquet' },
      { l: 'Columns',     v: 'date · {theme}__{keyword} × 34' },
      { l: 'Node use',    v: 'GoogleTrendsSignalNode: 52w z-score → macro_attention_zscore' },
      { l: 'Key output',  v: 'macro_attention_zscore — Tier B regime signal for Coordinator' },
      { l: 'Feeds →',     v: 'gtrends_src node (Sentiment Agent input)' }
    ]
  },

  reddit_api_raw: {
    tag: 'Raw Source · Reddit', title: 'Arctic Shift API', sub: 'photon-reddit.com · r/Forex + investing',
    desc: 'RedditCollector uses the Arctic Shift historical Reddit API (arctic-shift.photon-reddit.com) to fetch posts from subreddits: r/Forex, r/investing, r/stocks. Paginated with 100-post batches. Historical collection only — this was a one-time backfill exercise to gather the 25k labeled dataset.',
    metrics: [
      { l: 'API',         v: 'arctic-shift.photon-reddit.com/api/posts/search' },
      { l: 'Subreddits',  v: 'r/Forex · r/investing · r/stocks' },
      { l: 'Bronze path', v: 'data/raw/reddit/*.jsonl' },
      { l: 'Note',        v: 'Historical backfill only — not in live scheduled pipeline' }
    ]
  },

  reddit_bronze: {
    tag: 'Bronze · Reddit', title: 'Reddit Bronze JSONL', sub: 'data/raw/reddit/ · subreddit posts',
    desc: 'Raw Reddit posts stored as JSONL. Schema: {id, subreddit, title, selftext, link_flair_text, score, created_utc, ...}. Immutable after collection. RedditPreprocessor filters to ALLOWED_CONTENT types and non-empty titles.',
    metrics: [
      { l: 'Path',    v: 'data/raw/reddit/*.jsonl' },
      { l: 'Schema',  v: 'id · subreddit · title · selftext · flair · score · created_utc' },
      { l: 'Size',    v: '~25k posts across r/Forex · r/investing · r/stocks' }
    ]
  },

  reddit_groq: {
    tag: 'Preprocessor · Reddit', title: 'RedditPreprocessor (Groq)', sub: 'gpt-oss-120b · 8-field structured labels',
    desc: 'Uses Groq API (gpt-oss-120b model) with a structured system prompt to label each Reddit post across 8 dimensions: content_type, sarcasm_irony_score, sentiment_strength, target_pair, risk_sentiment, target_clarity, stance_clarity, reasoning. Key pool with exponential backoff. Filters NOISE and sarcasm_irony_score ≥ 2 at node level.',
    metrics: [
      { l: 'Model',     v: 'gpt-oss-120b via Groq API' },
      { l: 'Labels',    v: 'content_type · sarcasm_irony_score · sentiment_strength · target_pair · risk_sentiment · target_clarity · stance_clarity · reasoning' },
      { l: 'Output',    v: 'data/processed/sentiment/source=reddit/reddit_labels_checkpoint.jsonl' },
      { l: 'Scale',     v: '~25k labeled posts (one-time exercise)' },
      { l: 'Live use',  v: 'Tier C (explainability only) — not in scheduled pipeline' }
    ]
  },

  zone_feat_out: {
    tag: 'Silver · Geopolitical', title: 'zone_features_daily.parquet', sub: 'GDELTZoneFeatureBuilder output',
    desc: 'GDELTZoneFeatureBuilder aggregates Clean Silver events into one row per calendar day. Single flat parquet. 46 columns: date + 5 node features × 5 zones + 20 directed edge weights between zone pairs. Zone features: log_count, goldstein (severity), conflict_frac, avg_tone, log_mentions. Edge weights: log1p(count) of zone→zone event flows. Used as the model\'s primary data source AND for Layer 3 graph visualization.',
    metrics: [
      { l: 'Path',          v: 'data/processed/geopolitical/zone_features_daily.parquet' },
      { l: 'Shape',         v: '1 row/day · 46 cols (1 date + 25 node feat + 20 edges)' },
      { l: 'Node features', v: '5 per zone: log_count, goldstein, conflict_frac, tone, log_mentions' },
      { l: 'Edge weights',  v: '20 directed flows (log1p of event count between zone pairs)' },
      { l: 'Coverage',      v: '2022-01-01 → present (RU-UA anchor)' },
      { l: 'Feeds →',       v: 'zone_feat_silver node (Geopolitical Agent input)' }
    ]
  },

  proc_store_out: {
    tag: 'Silver · OHLCV', title: 'ohlcv_{pair}_{tf}.parquet', sub: 'DukascopyPreprocessor output',
    desc: 'Standardized OHLCV parquet files produced by DukascopyPreprocessor (NB20). Single source of truth for all downstream agents — consumed by the Technical Agent (all 3 timeframes), MacroSignalBuilder (D1 log-returns), and OHLCV API endpoint. Midnight UTC anchor ensures alignment with monthly macro pipeline.',
    metrics: [
      { l: 'Path',      v: 'data/processed/ohlcv/ohlcv_{pair}_{tf}_{start}_{end}.parquet' },
      { l: 'Schema',    v: 'timestamp_utc, pair, timeframe, open, high, low, close, volume, source' },
      { l: 'Pairs',     v: 'EURUSD · GBPUSD · USDJPY · USDCHF' },
      { l: 'Timeframes',v: 'H1 · H4 · D1' },
      { l: 'Feeds →',   v: 'proc_store node (Technical Agent input)' }
    ]
  },

  reddit_checkpoint: {
    tag: 'Silver · Reddit', title: 'reddit_labels_checkpoint.jsonl', sub: 'Groq-labeled · Tier C signal',
    desc: 'JSONL checkpoint of all Groq-labeled Reddit posts. RedditSignalNode reads directly (no parquet). Filters to ALLOWED_CONTENT, excludes NOISE and high-sarcasm posts. IC validation: zero pair-level IC confirmed → Tier C (context/explainability only). Not included in walk-forward signal validation.',
    metrics: [
      { l: 'Path',       v: 'data/processed/sentiment/source=reddit/reddit_labels_checkpoint.jsonl' },
      { l: 'Schema',     v: 'content_type · sentiment_strength · target_pair · risk_sentiment · stance_clarity · sarcasm_irony_score · score · created_utc · subreddit' },
      { l: 'Tier',       v: 'C — explainability/context only; zero IC in pair-level validation' },
      { l: 'Consumer',   v: 'RedditSignalNode.compute(start, end) — include_context only' },
      { l: 'Feeds →',    v: 'reddit_silver node (Sentiment Agent input)' }
    ]
  },

};

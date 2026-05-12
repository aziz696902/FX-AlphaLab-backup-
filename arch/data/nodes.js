import { C } from './colors.js';

export const N = [
  // ── Technical Agent Data Build Pipeline ──────────────────────────────────
  { id: 'mt5',                group: 'tech_build', label: 'MT5 Terminal',                sub: 'Live FX · OHLCV · 4 pairs',               w: 185, h: 44, color: C.src  },
  { id: 'raw_store',          group: 'tech_build', label: 'Raw Bronze Storage',          sub: 'Bronze CSV · mt5_{pair}_{tf}_{date}.csv',  w: 195, h: 44, color: C.src  },
  { id: 'price_norm',         group: 'tech_build', label: 'DukascopyPreprocessor',       sub: 'UTC anchor · OHLC validate · dedup',       w: 210, h: 52, color: C.tech },
  { id: 'proc_store_out',     group: 'tech_build', label: 'ohlcv_{pair}_{tf}.parquet',   sub: 'data/processed/ohlcv/ · Silver',           w: 195, h: 44, color: C.tech },

  // ── Technical Agent ───────────────────────────────────────────────────
  { id: 'proc_store',         group: 'tech', label: 'Processed Storage',        sub: 'Silver Parquet · canonical ← built left',  w: 192, h: 42, color: C.src  },
  { id: 'feat_eng',           group: 'tech', label: 'Feature Engineering',      sub: '15 indicators + ATR rank',                 w: 188, h: 48, color: C.tech },
  { id: 'minmax',             group: 'tech', label: 'MinMax Scaler',            sub: '[0,1] · train-time only',                  w: 188, h: 48, color: C.tech },
  { id: 'lstm_d1',            group: 'tech', label: 'LSTM D1',                  sub: '2L · 128h · sigmoid',                      w: 110, h: 48, color: C.tech },
  { id: 'lstm_h4',            group: 'tech', label: 'LSTM H4',                  sub: '2L · 128h · sigmoid',                      w: 110, h: 48, color: C.tech },
  { id: 'lstm_h1',            group: 'tech', label: 'LSTM H1',                  sub: '2L · 128h · sigmoid',                      w: 110, h: 48, color: C.tech },
  { id: 'mtf_fusion',         group: 'tech', label: 'MTF Fusion',               sub: 'Equal weights 1/3 each',                   w: 188, h: 48, color: C.tech },
  { id: 'tech_signal',        group: 'tech', label: 'TechnicalSignal',          sub: 'direction · conf · vol_regime',            w: 180, h: 54, color: C.tech },

  // ── Macro Signal Build Pipeline ───────────────────────────────────────────
  { id: 'fred_api_src',       group: 'macro_build', label: 'FRED API',                 sub: 'St. Louis Fed · 20+ macro series',             w: 185, h: 44, color: C.src   },
  { id: 'ecb_sdw_src',        group: 'macro_build', label: 'ECB SDW API',              sub: 'DFR · MRR · MLF policy rates',                  w: 185, h: 44, color: C.src   },
  { id: 'fed_doc_web',        group: 'macro_build', label: 'Fed.gov Scraper',          sub: 'Press releases · speeches · JSONL',             w: 185, h: 44, color: C.src   },
  { id: 'ecb_doc_web',        group: 'macro_build', label: 'ECB.europa.eu',            sub: 'Statements · press conferences',                w: 185, h: 44, color: C.src   },
  { id: 'boe_doc_web',        group: 'macro_build', label: 'BoE Scraper',              sub: 'MPC statements · speeches',                     w: 185, h: 44, color: C.src   },
  { id: 'fred_bronze_b',      group: 'macro_build', label: 'FRED Bronze CSVs',         sub: 'data/raw/fred/ · fred_*.csv',                   w: 195, h: 44, color: C.src   },
  { id: 'ecb_bronze_b',       group: 'macro_build', label: 'ECB Bronze CSVs',          sub: 'data/raw/ecb/ · ecb_policy_rates_*',            w: 195, h: 44, color: C.src   },
  { id: 'news_jsonl_b',       group: 'macro_build', label: 'News Bronze JSONL',        sub: 'data/raw/news/{fed|ecb|boe}/',                  w: 195, h: 44, color: C.src   },
  { id: 'macro_normalizer_p', group: 'macro_build', label: 'MacroNormalizer',          sub: 'Bronze→Silver · FRED+ECB consolidated',         w: 210, h: 52, color: C.macro },
  { id: 'news_extractor_p',   group: 'macro_build', label: 'News Text Extractor',      sub: 'title+content[:500] · no FinBERT',              w: 210, h: 52, color: C.macro },
  { id: 'macro_all_p',        group: 'macro_build', label: 'macro_all.parquet',        sub: 'Silver · series_id long-format',                w: 195, h: 44, color: C.src   },
  { id: 'd1_ohlcv_ref',       group: 'macro_build', label: 'D1 OHLCV parquets',        sub: 'data/processed/ohlcv/ (from NB20)',             w: 195, h: 44, color: C.src   },
  { id: 'var_lstm_pkl',       group: 'macro_build', label: 'macro_hybrid_models.pkl',  sub: 'VAR+LSTM × 4 pairs · NB05',                     w: 195, h: 44, color: C.macro },
  { id: 'news_cleaned_p',     group: 'macro_build', label: 'news_cleaned.parquet',     sub: 'hawk/dove tone · {fed|ecb|boe}',                w: 195, h: 44, color: C.src   },
  { id: 'msb_node',           group: 'macro_build', label: 'MacroSignalBuilder',       sub: 'VAR+LSTM fwd pass · Kalman smooth',             w: 215, h: 60, color: C.macro },
  { id: 'macro_sig_out',      group: 'macro_build', label: 'macro_signal.parquet',     sub: '4 pairs · 9 signal cols · month-end',           w: 195, h: 44, color: C.macro },

  // ── Macro Agent ───────────────────────────────────────────────────────
  { id: 'macro_store',        group: 'macro', label: 'Macro Signals Store',      sub: 'macro_signal.parquet ← built left',        w: 192, h: 42, color: C.src   },
  { id: 'events_store',       group: 'macro', label: 'Economic Events Store',    sub: 'events CSV · surprise fields',             w: 192, h: 42, color: C.src   },
  { id: 'mkt_ctx',            group: 'macro', label: 'Market Context Stores',    sub: 'D1 OHLCV parquets + VIX CSV',             w: 192, h: 42, color: C.src   },
  { id: 'macro_node1',        group: 'macro', label: 'Node 1: Macroeconomics',   sub: 'Baseline monthly direction',               w: 210, h: 52, color: C.macro },
  { id: 'macro_node2',        group: 'macro', label: 'Node 2: Calendar Events',  sub: 'Event surprise overlay',                  w: 210, h: 52, color: C.macro },
  { id: 'macro_orch',         group: 'macro', label: 'Orchestrator',             sub: 'Fusion + dominant_driver',                 w: 210, h: 52, color: C.macro },
  { id: 'macro_signal',       group: 'macro', label: 'MacroSignal',              sub: 'direction · surprise · carry',            w: 180, h: 54, color: C.macro },

  // ── Sentiment Data Build Pipelines ────────────────────────────────────────
  { id: 'st_api_raw',         group: 'sent_build', label: 'Stocktwits API',           sub: 'api.stocktwits.com · 4 FX symbols',             w: 185, h: 44, color: C.src  },
  { id: 'st_bronze',          group: 'sent_build', label: 'StockTwits Bronze JSONL',  sub: 'data/raw/news/stocktwits/{sym}_raw',            w: 195, h: 44, color: C.src  },
  { id: 'st_fintwitbert',     group: 'sent_build', label: 'FinTwitBERT Preprocessor', sub: 'StephanAkkerman · threshold=0.58',              w: 210, h: 52, color: C.sent },
  { id: 'st_checkpoint',      group: 'sent_build', label: 'labels_checkpoint.jsonl',  sub: 'bullish/bearish · prob_bullish/bearish',        w: 195, h: 44, color: C.sent },
  { id: 'gkg_bq_raw',         group: 'sent_build', label: 'BigQuery GDELTv2 GKG',     sub: 'gdelt-bq.gdeltv2.gkg_partitioned',              w: 185, h: 44, color: C.src  },
  { id: 'gkg_bronze',         group: 'sent_build', label: 'GDELT GKG Bronze JSONL',   sub: 'data/raw/gdelt_gkg/gdelt_{YYYYMM}',             w: 195, h: 44, color: C.src  },
  { id: 'gkg_preprocessor',   group: 'sent_build', label: 'GDELTGKGPreprocessor',     sub: 'V2Tone parsing · 7 tone fields · dedup',        w: 210, h: 52, color: C.sent },
  { id: 'gkg_silver',         group: 'sent_build', label: 'sentiment_cleaned.parquet',sub: 'year=*/month=*/ · tone · themes · orgs',        w: 195, h: 44, color: C.src  },
  { id: 'gtrends_api_raw',    group: 'sent_build', label: 'Google Trends API',        sub: 'pytrends · 34 keywords · 4 themes',             w: 185, h: 44, color: C.src  },
  { id: 'gtrends_bronze',     group: 'sent_build', label: 'Google Trends Bronze CSVs',sub: 'data/raw/google_trends/trends_*.csv',           w: 195, h: 44, color: C.src  },
  { id: 'gtrends_prep',       group: 'sent_build', label: 'GoogleTrendsPreprocessor', sub: '8 CSVs → outer join → weekly-aligned',          w: 210, h: 52, color: C.sent },
  { id: 'gtrends_weekly',     group: 'sent_build', label: 'google_trends_weekly.parquet', sub: 'data/processed/sentiment/ · single file',   w: 195, h: 44, color: C.src  },
  { id: 'reddit_api_raw',     group: 'sent_build', label: 'Arctic Shift API',         sub: 'photon-reddit.com · r/Forex + more',            w: 185, h: 44, color: C.src  },
  { id: 'reddit_bronze',      group: 'sent_build', label: 'Reddit Bronze JSONL',      sub: 'data/raw/reddit/*.jsonl · posts',               w: 195, h: 44, color: C.src  },
  { id: 'reddit_groq',        group: 'sent_build', label: 'RedditPreprocessor (Groq)',sub: 'gpt-oss-120b · 8 label fields · 25k',           w: 210, h: 52, color: C.sent },
  { id: 'reddit_checkpoint',  group: 'sent_build', label: 'reddit_labels_checkpoint', sub: 'data/processed/sentiment/source=reddit/',       w: 195, h: 44, color: C.src  },

  // ── Sentiment Agent ───────────────────────────────────────────────────
  { id: 'st_silver_src',      group: 'sent', label: 'StockTwits Silver',        sub: 'labels_checkpoint.jsonl ← built left',     w: 192, h: 42, color: C.src  },
  { id: 'gdelt_gkg_src',      group: 'sent', label: 'GDELT GKG Silver',         sub: 'sentiment_cleaned.parquet ← built left',   w: 192, h: 42, color: C.src  },
  { id: 'gtrends_src',        group: 'sent', label: 'Google Trends Silver',     sub: 'google_trends_weekly.parquet ← left',      w: 192, h: 42, color: C.src  },
  { id: 'reddit_silver',      group: 'sent', label: 'Reddit Silver Parquet',    sub: 'reddit_labels_checkpoint.jsonl ← left',    w: 192, h: 42, color: C.src  },
  { id: 'st_node',            group: 'sent', label: 'StocktwitsSignalNode',     sub: 'Tier A · exp decay 5d half-life',          w: 200, h: 52, color: C.sent },
  { id: 'gdelt_sent_node',    group: 'sent', label: 'GDELTSignalNode',          sub: 'Tier B · 30d rolling z-score',             w: 200, h: 52, color: C.sent },
  { id: 'gtrends_node',       group: 'sent', label: 'GoogleTrendsSignalNode',   sub: 'Tier B · 52w rolling z-score',             w: 200, h: 52, color: C.sent },
  { id: 'reddit_node',        group: 'sent', label: 'RedditSignalNode',         sub: 'Tier C · include_context only',            w: 200, h: 52, color: C.sent },
  { id: 'sent_agg',           group: 'sent', label: 'SentimentAgent',           sub: 'composite_stress_flag · assembly',         w: 185, h: 52, color: C.sent },
  { id: 'sent_signal',        group: 'sent', label: 'SentimentSignal',          sub: 'stocktwits(A) · attention(B)',             w: 180, h: 54, color: C.sent },

  // ── GDELT Zone Features Build Pipeline ───────────────────────────────────
  { id: 'gdelt_http',         group: 'geo_build', label: 'GDELT 1.0 HTTP Feed',        sub: 'Free daily exports · no auth',            w: 185, h: 44, color: C.src  },
  { id: 'gdelt_bronze',       group: 'geo_build', label: 'GDELT Events Bronze',         sub: 'data/raw/gdelt_events/ · zone-filtered',  w: 195, h: 44, color: C.src  },
  { id: 'gdelt_clean_silver', group: 'geo_build', label: 'GDELTEventsPreprocessor',     sub: 'Bronze → Clean Silver · snake_case',      w: 210, h: 52, color: C.geo  },
  { id: 'zone_feat_out',      group: 'geo_build', label: 'zone_features_daily.parquet', sub: '1 row/day · 46 cols · 5 zones',           w: 195, h: 44, color: C.geo  },

  // ── Geopolitical Agent ────────────────────────────────────────────────
  { id: 'zone_feat_silver',   group: 'geo', label: 'Zone Features Silver',     sub: 'zone_features_daily.parquet ← built left', w: 192, h: 42, color: C.src  },
  { id: 'delta_zscore',       group: 'geo', label: 'Delta + Z-Score',          sub: 'Δgeo · 30d rolling z-score',               w: 210, h: 52, color: C.geo  },
  { id: 'gat_ensemble',       group: 'geo', label: 'GAT Ensemble × 15 Seeds',  sub: '5-zone graph · 10-dim input',              w: 210, h: 52, color: C.geo  },
  { id: 'bilateral_agg',      group: 'geo', label: 'Bilateral Aggregation',    sub: 'score[base] + score[quote]',               w: 210, h: 52, color: C.geo  },
  { id: 'geo_signal',         group: 'geo', label: 'GeopoliticalSignal',       sub: 'bilateral_risk_score · regime',            w: 180, h: 54, color: C.geo  },

  // ── Coordinator ────────────────────────────────────────────────────────
  { id: 'sig_table',          group: 'coord', label: 'Signal Table',             sub: 'signals_aligned.parquet',                  w: 280, h: 44, color: C.alpha },
  { id: 'sig_router',         group: 'coord', label: 'Signal Router',            sub: 'empirically validated IC gates',           w: 280, h: 52, color: C.alpha },
  { id: 'vol_fusion',         group: 'coord', label: 'Vol Track Fusion',         sub: 'StockTwits vs Geo · OLS calib.',           w: 280, h: 52, color: C.alpha },
  { id: 'conviction',         group: 'coord', label: 'Conviction Scoring',       sub: 'tier_weight × direction_edge',             w: 280, h: 52, color: C.alpha },
  { id: 'hold_gate',          group: 'coord', label: 'HOLD Gate + Sizing',       sub: 'SL/TP construction · R:R=1.67',            w: 280, h: 52, color: C.alpha },
  { id: 'regime_overlay',     group: 'coord', label: 'Regime Overlay',           sub: 'macro_attention_zscore > 1.0',             w: 280, h: 52, color: C.alpha },
  { id: 'coord_report',       group: 'coord', label: 'CoordinatorReport',        sub: 'top_pick · conviction · SL/TP',            w: 280, h: 52, color: C.alpha },
  { id: 'llm_narrator',       group: 'coord', label: 'LLM Narrator',             sub: 'prose narrative · no invented #',          w: 280, h: 52, color: C.alpha },

  // ── Final Output ──────────────────────────────────────────────────────
  { id: 'report_json',        group: 'output', label: 'outputs/reports/{date}.json', sub: 'stale_inputs aware',                    w: 185, h: 44, color: C.alpha },
  { id: 'react_dash',         group: 'output', label: 'React Dashboard',          sub: 'Next.js + FastAPI backend',                w: 185, h: 44, color: C.alpha },
  { id: 'user_mt5',           group: 'output', label: 'User → MT5',               sub: 'Manual execution',                         w: 185, h: 42, color: C.alpha },
];

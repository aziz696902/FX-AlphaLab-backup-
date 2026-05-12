import { C } from './colors.js';

export const E = [
  // ── Data source chain ───────────────────────────────────────────────────
  { f: 'mt5',                t: 'raw_store',          c: C.src   },
  { f: 'raw_store',          t: 'price_norm',         c: C.src   },
  { f: 'price_norm',         t: 'proc_store_out',     c: C.tech  },
  { f: 'proc_store_out',    t: 'proc_store',         c: C.tech, dsh: true },

  // ── Technical Agent ────────────────────────────────────────────────────
  { f: 'proc_store',         t: 'feat_eng',           c: C.tech  },
  { f: 'feat_eng',           t: 'minmax',             c: C.tech  },
  { f: 'minmax',             t: 'lstm_d1',            c: C.tech, dv: true },
  { f: 'minmax',             t: 'lstm_h4',            c: C.tech, dv: true },
  { f: 'minmax',             t: 'lstm_h1',            c: C.tech, dv: true },
  { f: 'lstm_d1',            t: 'mtf_fusion',         c: C.tech, dv: true },
  { f: 'lstm_h4',            t: 'mtf_fusion',         c: C.tech, dv: true },
  { f: 'lstm_h1',            t: 'mtf_fusion',         c: C.tech, dv: true },
  { f: 'mtf_fusion',         t: 'tech_signal',        c: C.tech  },

  // ── Macro Agent ────────────────────────────────────────────────────────
  { f: 'macro_store',        t: 'macro_node1',        c: C.macro },
  { f: 'events_store',       t: 'macro_node2',        c: C.macro },
  { f: 'mkt_ctx',            t: 'macro_node2',        c: C.macro },
  { f: 'macro_node1',        t: 'macro_orch',         c: C.macro },
  { f: 'macro_node2',        t: 'macro_orch',         c: C.macro },
  { f: 'macro_orch',         t: 'macro_signal',       c: C.macro },

  // ── Sentiment Agent ────────────────────────────────────────────────────
  { f: 'st_silver_src',      t: 'st_node',            c: C.sent  },
  { f: 'gdelt_gkg_src',      t: 'gdelt_sent_node',    c: C.sent  },
  { f: 'gtrends_src',        t: 'gtrends_node',       c: C.sent  },
  { f: 'reddit_silver',      t: 'reddit_node',        c: C.sent, dsh: true },
  { f: 'st_node',            t: 'sent_agg',           c: C.sent  },
  { f: 'gdelt_sent_node',    t: 'sent_agg',           c: C.sent  },
  { f: 'gtrends_node',       t: 'sent_agg',           c: C.sent  },
  { f: 'reddit_node',        t: 'sent_agg',           c: C.sent, dsh: true },
  { f: 'sent_agg',           t: 'sent_signal',        c: C.sent  },

  // ── Geopolitical Agent ─────────────────────────────────────────────────
  { f: 'gdelt_http',         t: 'gdelt_bronze',       c: C.src   },
  { f: 'gdelt_bronze',       t: 'gdelt_clean_silver', c: C.src   },
  { f: 'gdelt_clean_silver', t: 'zone_feat_out',      c: C.geo   },
  { f: 'zone_feat_out',     t: 'zone_feat_silver',   c: C.geo, dsh: true },
  { f: 'zone_feat_silver',   t: 'delta_zscore',       c: C.geo   },
  { f: 'delta_zscore',       t: 'gat_ensemble',       c: C.geo   },
  { f: 'gat_ensemble',       t: 'bilateral_agg',      c: C.geo   },
  { f: 'bilateral_agg',      t: 'geo_signal',         c: C.geo   },

  // ── Coordinator ────────────────────────────────────────────────────────
  { f: 'tech_signal',        t: 'sig_table',          c: C.tech  },
  { f: 'macro_signal',       t: 'sig_table',          c: C.macro },
  { f: 'sent_signal',        t: 'sig_table',          c: C.sent  },
  { f: 'geo_signal',         t: 'sig_table',          c: C.geo   },
  { f: 'sig_table',          t: 'sig_router',         c: C.alpha },
  { f: 'sig_router',         t: 'vol_fusion',         c: C.alpha },
  { f: 'vol_fusion',         t: 'conviction',         c: C.alpha },
  { f: 'conviction',         t: 'hold_gate',          c: C.alpha },
  { f: 'hold_gate',          t: 'regime_overlay',     c: C.alpha },
  { f: 'regime_overlay',     t: 'coord_report',       c: C.alpha },
  { f: 'coord_report',       t: 'llm_narrator',       c: C.alpha },
  { f: 'llm_narrator',       t: 'report_json',        c: C.alpha },
  { f: 'report_json',        t: 'react_dash',          c: C.alpha },
  { f: 'react_dash',         t: 'user_mt5',            c: C.alpha },

  // ── Macro Signal Build Pipeline ─────────────────────────────────────────
  { f: 'fred_api_src',       t: 'fred_bronze_b',       c: C.src   },
  { f: 'ecb_sdw_src',        t: 'ecb_bronze_b',        c: C.src   },
  { f: 'fred_bronze_b',      t: 'macro_normalizer_p',  c: C.macro },
  { f: 'ecb_bronze_b',       t: 'macro_normalizer_p',  c: C.macro },
  { f: 'macro_normalizer_p', t: 'macro_all_p',         c: C.macro },
  { f: 'fed_doc_web',        t: 'news_jsonl_b',        c: C.src   },
  { f: 'ecb_doc_web',        t: 'news_jsonl_b',        c: C.src   },
  { f: 'boe_doc_web',        t: 'news_jsonl_b',        c: C.src   },
  { f: 'news_jsonl_b',       t: 'news_extractor_p',    c: C.macro },
  { f: 'news_extractor_p',   t: 'news_cleaned_p',      c: C.macro },
  { f: 'macro_all_p',        t: 'msb_node',            c: C.macro },
  { f: 'd1_ohlcv_ref',       t: 'msb_node',            c: C.macro },
  { f: 'var_lstm_pkl',       t: 'msb_node',            c: C.macro },
  { f: 'news_cleaned_p',     t: 'msb_node',            c: C.macro },
  { f: 'msb_node',           t: 'macro_sig_out',       c: C.macro },
  { f: 'macro_sig_out',      t: 'macro_store',         c: C.macro, dsh: true },

  // ── StockTwits Build Pipeline ──────────────────────────────────────────
  { f: 'st_api_raw',         t: 'st_bronze',           c: C.src   },
  { f: 'st_bronze',          t: 'st_fintwitbert',      c: C.sent  },
  { f: 'st_fintwitbert',     t: 'st_checkpoint',       c: C.sent  },
  { f: 'st_checkpoint',      t: 'st_silver_src',       c: C.sent, dsh: true },

  // ── GDELT GKG Build Pipeline ───────────────────────────────────────────
  { f: 'gkg_bq_raw',         t: 'gkg_bronze',          c: C.src   },
  { f: 'gkg_bronze',         t: 'gkg_preprocessor',    c: C.sent  },
  { f: 'gkg_preprocessor',   t: 'gkg_silver',          c: C.sent  },
  { f: 'gkg_silver',         t: 'gdelt_gkg_src',       c: C.sent, dsh: true },

  // ── Google Trends Build Pipeline ───────────────────────────────────────
  { f: 'gtrends_api_raw',    t: 'gtrends_bronze',      c: C.src   },
  { f: 'gtrends_bronze',     t: 'gtrends_prep',        c: C.sent  },
  { f: 'gtrends_prep',       t: 'gtrends_weekly',      c: C.sent  },
  { f: 'gtrends_weekly',     t: 'gtrends_src',         c: C.sent, dsh: true },

  // ── Reddit Build Pipeline ──────────────────────────────────────────────
  { f: 'reddit_api_raw',     t: 'reddit_bronze',       c: C.src   },
  { f: 'reddit_bronze',      t: 'reddit_groq',         c: C.sent  },
  { f: 'reddit_groq',        t: 'reddit_checkpoint',   c: C.sent  },
  { f: 'reddit_checkpoint',  t: 'reddit_silver',       c: C.sent, dsh: true },
];

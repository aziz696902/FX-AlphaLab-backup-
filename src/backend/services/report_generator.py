"""Daily HTML report generator.

Reads signal data from the Gold DB, generates LLM narrative via Gemini,
builds five Plotly chart specs, renders a Jinja2 template, and saves the
result to both disk and PostgreSQL.

Entry point:
    from src.backend.services.report_generator import ReportGenerator
    gen = ReportGenerator()
    gen.generate_for_date(datetime.date(2026, 5, 10))
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from google import genai
from google.genai import types
from jinja2 import Environment, FileSystemLoader, select_autoescape

from src.shared.config import Config
from src.shared.db.models import AgentSignal, CoordinatorReportRow, CoordinatorSignalRow
from src.shared.db.session import SessionLocal
from src.shared.db.storage import upsert_daily_report

logger = logging.getLogger(__name__)

_PAIRS = ["EURUSD", "GBPUSD", "USDCHF", "USDJPY"]
_REPORT_MODEL = "gemini-3.1-flash-lite-preview"
_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

# Pentagon positions for GAT zone nodes (clockwise from top)
_ZONE_NODES = ["USD", "EUR", "GBP", "JPY", "CHF"]
_ZONE_POSITIONS: dict[str, tuple[float, float]] = {
    zone: (math.cos(math.pi / 2 - 2 * math.pi * i / 5), math.sin(math.pi / 2 - 2 * math.pi * i / 5))
    for i, zone in enumerate(_ZONE_NODES)
}

# Plotly color palette (matches report CSS)
_GREEN = "#10b981"
_RED = "#ef4444"
_AMBER = "#f59e0b"
_MUTED = "#9ca3af"
_GRID = "#e5e7eb"
_TEXT = "#374151"
_BG = "#ffffff"


# ── Data containers ────────────────────────────────────────────────────────────


@dataclass
class PairReportData:
    """All DB data needed to render one pair's report."""

    pair: str
    target_date: date
    agent: AgentSignal
    coordinator: CoordinatorSignalRow
    report_row: CoordinatorReportRow


# ── Main class ─────────────────────────────────────────────────────────────────


class ReportGenerator:
    """Generates HTML reports for all 4 pairs for a given date."""

    def __init__(self, root_dir: Path | None = None) -> None:
        self._root = root_dir or Path(__file__).resolve().parents[4]
        self._reports_dir = Config.REPORTS_DIR
        self._chroma_dir = Config.CHROMA_DIR
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATES_DIR)),
            autoescape=select_autoescape(["html"]),
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    def generate_for_date(self, target_date: date) -> dict[str, Path]:
        """Generate reports for all 4 pairs. Returns {pair: disk_path}."""
        db = SessionLocal()
        try:
            report_row = (
                db.query(CoordinatorReportRow)
                .filter(CoordinatorReportRow.date == target_date)
                .first()
            )
            if report_row is None:
                raise ValueError(f"No coordinator report found for {target_date}")

            agents = {
                r.pair: r
                for r in db.query(AgentSignal).filter(AgentSignal.date == target_date).all()
            }
            coordinators = {
                r.pair: r
                for r in db.query(CoordinatorSignalRow)
                .filter(CoordinatorSignalRow.date == target_date)
                .all()
            }
        finally:
            db.close()

        missing = [p for p in _PAIRS if p not in agents or p not in coordinators]
        if missing:
            logger.warning(
                "Missing signal data for pairs %s on %s — skipping", missing, target_date
            )

        paths: dict[str, Path] = {}
        for pair in _PAIRS:
            if pair not in agents or pair not in coordinators:
                continue
            data = PairReportData(
                pair=pair,
                target_date=target_date,
                agent=agents[pair],
                coordinator=coordinators[pair],
                report_row=report_row,
            )
            try:
                html, disk_path = self._generate_pair(data)
                paths[pair] = disk_path
                logger.info("Generated report for %s -> %s", pair, disk_path)
            except Exception:
                logger.exception("Report generation failed for %s on %s", pair, target_date)

        return paths

    # ── Per-pair generation ────────────────────────────────────────────────────

    def _generate_pair(self, data: PairReportData) -> tuple[str, Path]:
        """Generate HTML for one pair, save to disk + DB. Returns (html, disk_path)."""
        narrative = self._generate_narrative(data)
        charts = self._build_all_charts(data)
        ctx = self._build_template_context(data, narrative, charts)

        template = self._jinja.get_template("report.html.j2")
        html = template.render(**ctx)

        disk_path = self._save_to_disk(data.pair, data.target_date, html)
        upsert_daily_report(data.target_date, data.pair, html)

        return html, disk_path

    # ── LLM narrative ──────────────────────────────────────────────────────────

    def _generate_narrative(self, data: PairReportData) -> dict[str, Any]:
        """Call Gemini, parse the JSON narrative. Falls back to data-only labels on error."""
        prompt_data = self._build_narrative_prompt_data(data)
        rag_chunks = self._retrieve_rag_context(f"{data.pair} forex market {data.target_date}")

        system = (
            "You are an FX market analyst generating a professional daily report. "
            "Return ONLY a valid JSON object matching the schema in the prompt. "
            "Do NOT invent numbers. Do NOT add disclaimers. Be concise and direct. "
            "Use professional market analyst language."
        )

        schema_block = """\
JSON schema (every key required):
{
  "hero_thesis": "<1 sentence ≤20 words: the core directional call>",
  "hero_subtitle": "<1 sentence ≤25 words: actionable guidance for the trader>",
  "decision_title": "<1 clause ≤10 words: title for the decision summary section>",
  "decision_drivers": ["<≤30w>", "<≤30w>", "<≤30w>"],
  "invalidation_risk_title": "<≤8 words: what could break this call>",
  "invalidation_risk_body": "<≤40 words: explanation of the risk scenario>",
  "monitor_signals": ["<≤20w>", "<≤20w>", "<≤20w>"],
  "tech_summary": "<1–2 sentences ≤50 words>",
  "macro_summary": "<1–2 sentences ≤50 words>",
  "geo_summary": "<1–2 sentences ≤50 words>",
  "sentiment_summary": "<1–2 sentences ≤50 words>",
  "risk_assessment": "<1–2 sentences ≤50 words: overall risk posture>"
}"""

        rag_block = ""
        if rag_chunks:
            rag_block = "\n\nRELEVANT MARKET CONTEXT (from central bank & news documents):\n"
            rag_block += "\n---\n".join(rag_chunks[:5])

        user_prompt = (
            f"{schema_block}\n\nSIGNAL DATA:\n{json.dumps(prompt_data, indent=2)}{rag_block}"
        )

        try:
            client = genai.Client(api_key=Config.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=_REPORT_MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=0.55,
                    max_output_tokens=2048,
                    response_mime_type="application/json",
                ),
            )
            raw = response.text or ""
            # Strip markdown code fences if present
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as exc:
            logger.warning("Narrative LLM call failed for %s: %s — using fallback", data.pair, exc)
            return self._fallback_narrative(data)

    def _build_narrative_prompt_data(self, data: PairReportData) -> dict:
        a = data.agent
        c = data.coordinator
        r = data.report_row
        return {
            "date": str(data.target_date),
            "pair": data.pair,
            "action": c.suggested_action,
            "confidence_tier": c.confidence_tier,
            "conviction_score": round(c.conviction_score or 0, 4),
            "direction_source": c.direction_source,
            "direction_horizon": c.direction_horizon,
            "direction_ic": c.direction_ic,
            "position_size_pct": c.position_size_pct,
            "sl_pct": round(c.sl_pct or 0, 4),
            "tp_pct": round(c.tp_pct or 0, 4),
            "risk_reward": round(c.risk_reward_ratio or 0, 2),
            "is_top_pick": c.is_top_pick,
            "overall_action": r.overall_action,
            "global_regime": r.global_regime,
            "tech": {
                "direction": a.tech_direction,
                "confidence": round(a.tech_confidence or 0, 3),
                "vol_regime": a.tech_vol_regime,
                "rsi": round((a.tech_indicator_snapshot or {}).get("rsi", 0), 1),
                "bb_pct": round((a.tech_indicator_snapshot or {}).get("bb_pct", 0), 3),
                "macd_hist": (a.tech_indicator_snapshot or {}).get("macd_hist"),
                "above_ema200": (a.tech_indicator_snapshot or {}).get("above_ema200"),
                "timeframe_votes": a.tech_timeframe_votes,
            },
            "macro": {
                "direction": a.macro_direction,
                "confidence": round(a.macro_confidence or 0, 3),
                "dominant_driver": a.macro_dominant_driver,
                "carry": round(a.macro_carry_score or 0, 3),
                "regime": round(a.macro_regime_score or 0, 3),
                "fundamental": round(a.macro_fundamental_score or 0, 3),
                "surprise": round(a.macro_surprise_score or 0, 3),
                "bias": round(a.macro_bias_score or 0, 3),
            },
            "geo": {
                "bilateral_risk": round(a.geo_bilateral_risk or 0, 4),
                "risk_regime": a.geo_risk_regime,
                "base_zone": (a.geo_base_zone_explanation or {}).get("zone"),
                "base_driver": (a.geo_base_zone_explanation or {}).get("dominant_driver"),
                "quote_zone": (a.geo_quote_zone_explanation or {}).get("zone"),
                "quote_driver": (a.geo_quote_zone_explanation or {}).get("dominant_driver"),
            },
            "sentiment": {
                "composite_stress": a.composite_stress_flag,
                "stress_sources": a.sentiment_stress_sources or [],
                "gdelt_tone_z": a.gdelt_tone_zscore,
                "gdelt_attention_z": a.gdelt_attention_zscore,
                "macro_attention_z": a.macro_attention_zscore,
                "stocktwits_vol": a.usdjpy_stocktwits_vol_signal,
            },
            "narrative_context": r.narrative_context,
        }

    @staticmethod
    def _fallback_narrative(data: PairReportData) -> dict:
        c = data.coordinator
        action = c.suggested_action or "FLAT"
        return {
            "hero_thesis": f"{data.pair} {action} signal from {c.direction_source or 'model'} — {c.confidence_tier or 'low'} confidence.",
            "hero_subtitle": f"Trade parameters: SL {c.sl_pct:.2f}%, TP {c.tp_pct:.2f}%, R:R {c.risk_reward_ratio:.2f}.",
            "decision_title": f"{action} bias on {data.pair}",
            "decision_drivers": [
                f"Primary signal: {c.direction_source or 'model'} with {c.confidence_tier or 'low'} confidence.",
                f"Macro regime: {data.report_row.global_regime or 'normal'}.",
                f"Geopolitical risk: {data.agent.geo_risk_regime or 'unknown'}.",
            ],
            "invalidation_risk_title": "Signal reversal on new data",
            "invalidation_risk_body": "A change in macro regime or geopolitical escalation could invalidate this call.",
            "monitor_signals": [
                "Macro regime shift",
                "Geopolitical escalation",
                "Sentiment reversal",
            ],
            "tech_summary": f"Technical direction {data.agent.tech_direction}, confidence {data.agent.tech_confidence:.1%}.",
            "macro_summary": f"Macro leans {data.agent.macro_direction}, dominant driver: {data.agent.macro_dominant_driver}.",
            "geo_summary": f"Bilateral risk {data.agent.geo_bilateral_risk:.3f}, regime {data.agent.geo_risk_regime}.",
            "sentiment_summary": "Sentiment composite stress flag "
            + ("active." if data.agent.composite_stress_flag else "inactive."),
            "risk_assessment": f"Overall {data.report_row.global_regime or 'normal'} regime. Position size {data.coordinator.position_size_pct:.1f}% of equity.",
        }

    # ── Chart builders ─────────────────────────────────────────────────────────

    def _build_all_charts(self, data: PairReportData) -> dict[str, tuple[str, str]]:
        """Return {chart_name: (data_json, layout_json)} for all 5 charts."""
        return {
            "ohlcv": self._build_ohlcv_chart(data.pair, data.target_date),
            "macro": self._build_macro_chart(data.agent),
            "gat": self._build_gat_chart(data.agent, data.pair),
            "zone": self._build_zone_chart(data.agent),
            "sentiment": self._build_sentiment_chart(data.agent),
        }

    def _build_ohlcv_chart(self, pair: str, target_date: date) -> tuple[str, str]:
        """OHLCV candlestick + RSI(14) + MACD subplots."""
        try:
            from src.agents.technical.features import load_pair

            pair_m = pair + "m"
            df = load_pair(pair_m, "D1")
            cutoff = pd.Timestamp(target_date, tz="UTC") - pd.Timedelta(days=90)
            df = df[df.index >= cutoff].copy()

            # Indicators
            df["ema200"] = df["close"].ewm(span=200, adjust=False).mean()
            df["bb_mid"] = df["close"].rolling(20).mean()
            df["bb_std"] = df["close"].rolling(20).std()
            df["bb_upper"] = df["bb_mid"] + 2 * df["bb_std"]
            df["bb_lower"] = df["bb_mid"] - 2 * df["bb_std"]

            delta = df["close"].diff()
            gain = delta.clip(lower=0).ewm(com=13, adjust=False).mean()
            loss = (-delta.clip(upper=0)).ewm(com=13, adjust=False).mean()
            df["rsi"] = 100 - 100 / (1 + gain / loss.replace(0, np.nan))

            ema12 = df["close"].ewm(span=12, adjust=False).mean()
            ema26 = df["close"].ewm(span=26, adjust=False).mean()
            df["macd"] = ema12 - ema26
            df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
            df["macd_hist"] = df["macd"] - df["macd_signal"]

            ts = [t.isoformat() for t in df.index]

            def _clean(series: pd.Series) -> list:
                return [
                    None if (v is None or (isinstance(v, float) and math.isnan(v))) else round(v, 6)
                    for v in series
                ]

            macd_hist = _clean(df["macd_hist"])
            macd_colors = [_GREEN if (v or 0) >= 0 else _RED for v in macd_hist]

            chart_data = [
                # Row 1: candlestick
                {
                    "type": "candlestick",
                    "x": ts,
                    "open": _clean(df["open"]),
                    "high": _clean(df["high"]),
                    "low": _clean(df["low"]),
                    "close": _clean(df["close"]),
                    "name": pair,
                    "increasing": {"line": {"color": _GREEN}},
                    "decreasing": {"line": {"color": _RED}},
                    "xaxis": "x",
                    "yaxis": "y",
                },
                # EMA200
                {
                    "type": "scatter",
                    "mode": "lines",
                    "x": ts,
                    "y": _clean(df["ema200"]),
                    "name": "EMA200",
                    "line": {"color": "#6366f1", "width": 1, "dash": "dash"},
                    "xaxis": "x",
                    "yaxis": "y",
                },
                # BB Upper
                {
                    "type": "scatter",
                    "mode": "lines",
                    "x": ts,
                    "y": _clean(df["bb_upper"]),
                    "name": "BB Upper",
                    "line": {"color": _MUTED, "width": 1, "dash": "dot"},
                    "xaxis": "x",
                    "yaxis": "y",
                },
                # BB Lower
                {
                    "type": "scatter",
                    "mode": "lines",
                    "x": ts,
                    "y": _clean(df["bb_lower"]),
                    "name": "BB Lower",
                    "line": {"color": _MUTED, "width": 1, "dash": "dot"},
                    "fill": "tonexty",
                    "fillcolor": "rgba(156,163,175,0.05)",
                    "xaxis": "x",
                    "yaxis": "y",
                },
                # Row 2: RSI
                {
                    "type": "scatter",
                    "mode": "lines",
                    "x": ts,
                    "y": _clean(df["rsi"]),
                    "name": "RSI(14)",
                    "line": {"color": "#f59e0b", "width": 1.5},
                    "xaxis": "x",
                    "yaxis": "y2",
                },
                # Row 3: MACD histogram
                {
                    "type": "bar",
                    "x": ts,
                    "y": macd_hist,
                    "name": "MACD hist",
                    "marker": {"color": macd_colors},
                    "xaxis": "x",
                    "yaxis": "y3",
                },
                # MACD signal
                {
                    "type": "scatter",
                    "mode": "lines",
                    "x": ts,
                    "y": _clean(df["macd_signal"]),
                    "name": "MACD signal",
                    "line": {"color": "#6366f1", "width": 1},
                    "xaxis": "x",
                    "yaxis": "y3",
                },
            ]

            layout = {
                "paper_bgcolor": _BG,
                "plot_bgcolor": _BG,
                "font": {"family": "Inter, system-ui, sans-serif", "size": 11, "color": _TEXT},
                "showlegend": False,
                "margin": {"l": 50, "r": 20, "t": 10, "b": 30},
                "xaxis": {
                    "type": "date",
                    "gridcolor": _GRID,
                    "showgrid": True,
                    "rangeslider": {"visible": False},
                    "domain": [0, 1],
                },
                "yaxis": {
                    "domain": [0.42, 1.0],
                    "gridcolor": _GRID,
                    "showgrid": True,
                    "title": {"text": "Price"},
                },
                "yaxis2": {
                    "domain": [0.22, 0.40],
                    "gridcolor": _GRID,
                    "showgrid": True,
                    "title": {"text": "RSI"},
                    "range": [0, 100],
                },
                "yaxis3": {
                    "domain": [0.0, 0.20],
                    "gridcolor": _GRID,
                    "showgrid": True,
                    "title": {"text": "MACD"},
                },
                "shapes": [
                    # RSI 70 line
                    {
                        "type": "line",
                        "xref": "paper",
                        "yref": "y2",
                        "x0": 0,
                        "x1": 1,
                        "y0": 70,
                        "y1": 70,
                        "line": {"color": _RED, "width": 0.7, "dash": "dot"},
                    },
                    # RSI 30 line
                    {
                        "type": "line",
                        "xref": "paper",
                        "yref": "y2",
                        "x0": 0,
                        "x1": 1,
                        "y0": 30,
                        "y1": 30,
                        "line": {"color": _GREEN, "width": 0.7, "dash": "dot"},
                    },
                    # MACD zero line
                    {
                        "type": "line",
                        "xref": "paper",
                        "yref": "y3",
                        "x0": 0,
                        "x1": 1,
                        "y0": 0,
                        "y1": 0,
                        "line": {"color": _MUTED, "width": 0.7},
                    },
                ],
            }
            return json.dumps(chart_data), json.dumps(layout)

        except Exception as exc:
            logger.warning("OHLCV chart failed for %s: %s", pair, exc)
            return self._empty_chart(f"{pair} OHLCV data unavailable")

    def _build_macro_chart(self, agent: AgentSignal) -> tuple[str, str]:
        """Horizontal bar chart of macro sub-scores."""
        scores = {
            "Carry": agent.macro_carry_score,
            "Regime": agent.macro_regime_score,
            "Fundamental": agent.macro_fundamental_score,
            "Surprise": agent.macro_surprise_score,
            "CB Bias": agent.macro_bias_score,
        }
        labels = list(scores.keys())
        values = [round(v or 0, 4) for v in scores.values()]
        colors = [_GREEN if v >= 0 else _RED for v in values]

        chart_data = [
            {
                "type": "bar",
                "orientation": "h",
                "x": values,
                "y": labels,
                "marker": {"color": colors},
                "text": [f"{v:+.4f}" for v in values],
                "textposition": "outside",
            }
        ]

        x_abs_max = max(abs(v) for v in values) if values else 0.5
        x_pad = x_abs_max * 1.35 or 0.5

        layout = {
            "paper_bgcolor": _BG,
            "plot_bgcolor": _BG,
            "font": {"family": "Inter, system-ui, sans-serif", "size": 12, "color": _TEXT},
            "showlegend": False,
            "margin": {"l": 100, "r": 80, "t": 20, "b": 30},
            "xaxis": {
                "gridcolor": _GRID,
                "showgrid": True,
                "zeroline": True,
                "zerolinecolor": _MUTED,
                "zerolinewidth": 1.5,
                "range": [-x_pad, x_pad],
            },
            "yaxis": {"gridcolor": _GRID, "showgrid": False},
            "shapes": [
                {
                    "type": "line",
                    "xref": "x",
                    "yref": "paper",
                    "x0": 0,
                    "x1": 0,
                    "y0": 0,
                    "y1": 1,
                    "line": {"color": _MUTED, "width": 1.5},
                },
            ],
        }
        return json.dumps(chart_data), json.dumps(layout)

    def _build_gat_chart(self, agent: AgentSignal, pair: str) -> tuple[str, str]:
        """Force-directed GAT currency network.

        Nodes = 5 currency zones on a pentagon layout, sized by risk score.
        Edges = top-10 directed attention weights, opacity by strength.
        Base and quote zone nodes are highlighted.
        """
        if not agent.geo_graph:
            return self._empty_chart("GAT graph data unavailable")

        zone_risk: dict[str, float] = agent.geo_graph.get("zone_risk_scores", {})
        edge_weights: dict[str, float] = agent.geo_graph.get("edge_weights", {})

        # Determine base/quote zones for highlighting
        base_zone = (agent.geo_base_zone_explanation or {}).get("zone", "")
        quote_zone = (agent.geo_quote_zone_explanation or {}).get("zone", "")

        # Top-10 edges by weight
        sorted_edges = sorted(edge_weights.items(), key=lambda kv: kv[1], reverse=True)[:10]
        max_weight = sorted_edges[0][1] if sorted_edges else 1.0

        traces: list[dict] = []

        # Draw edges as line segments
        for edge_key, weight in sorted_edges:
            if "→" not in edge_key:
                continue
            src_zone, tgt_zone = edge_key.split("→", 1)
            if src_zone not in _ZONE_POSITIONS or tgt_zone not in _ZONE_POSITIONS:
                continue
            sx, sy = _ZONE_POSITIONS[src_zone]
            tx, ty = _ZONE_POSITIONS[tgt_zone]
            opacity = 0.15 + 0.65 * (weight / max_weight)
            traces.append(
                {
                    "type": "scatter",
                    "mode": "lines",
                    "x": [sx, tx, None],
                    "y": [sy, ty, None],
                    "line": {
                        "color": f"rgba(99,102,241,{opacity:.2f})",
                        "width": 1 + 2 * (weight / max_weight),
                    },
                    "hoverinfo": "none",
                    "showlegend": False,
                }
            )

        # Draw arrowheads as small triangles at target nodes
        for edge_key, weight in sorted_edges:
            if "→" not in edge_key:
                continue
            src_zone, tgt_zone = edge_key.split("→", 1)
            if src_zone not in _ZONE_POSITIONS or tgt_zone not in _ZONE_POSITIONS:
                continue
            sx, sy = _ZONE_POSITIONS[src_zone]
            tx, ty = _ZONE_POSITIONS[tgt_zone]
            # Place arrowhead 80% along the edge
            ax = sx + 0.8 * (tx - sx)
            ay = sy + 0.8 * (ty - sy)
            opacity = 0.2 + 0.5 * (weight / max_weight)
            traces.append(
                {
                    "type": "scatter",
                    "mode": "markers",
                    "x": [ax],
                    "y": [ay],
                    "marker": {
                        "symbol": "triangle-up",
                        "size": 6,
                        "color": f"rgba(99,102,241,{opacity:.2f})",
                        "angle": math.degrees(math.atan2(ty - sy, tx - sx)) - 90,
                    },
                    "hoverinfo": "none",
                    "showlegend": False,
                }
            )

        # Draw nodes
        node_x, node_y, node_text, node_sizes, node_colors, node_borders = [], [], [], [], [], []
        for zone in _ZONE_NODES:
            x, y = _ZONE_POSITIONS[zone]
            risk = zone_risk.get(zone, 0.0)
            node_x.append(x)
            node_y.append(y)
            node_text.append(f"<b>{zone}</b><br>Risk: {risk:.3f}")
            node_sizes.append(40 + 70 * risk)
            # Color: low risk = green, high risk = red
            r_int = int(risk * 239 + (1 - risk) * 16)
            g_int = int(risk * 68 + (1 - risk) * 185)
            b_int = int(risk * 68 + (1 - risk) * 129)
            node_colors.append(f"rgb({r_int},{g_int},{b_int})")
            # Bold border for base/quote zones
            if zone == base_zone or zone == quote_zone:
                node_borders.append({"color": "#f59e0b", "width": 3})
            else:
                node_borders.append({"color": "#ffffff", "width": 2})

        traces.append(
            {
                "type": "scatter",
                "mode": "markers+text",
                "x": node_x,
                "y": node_y,
                "text": [z for z in _ZONE_NODES],
                "textposition": "middle center",
                "textfont": {
                    "size": 13,
                    "color": "#ffffff",
                    "family": "Inter, system-ui, sans-serif",
                },
                "marker": {
                    "size": node_sizes,
                    "color": node_colors,
                    "line": node_borders,
                    "sizemode": "diameter",
                },
                "hovertext": node_text,
                "hoverinfo": "text",
                "showlegend": False,
            }
        )

        layout = {
            "paper_bgcolor": _BG,
            "plot_bgcolor": _BG,
            "font": {"family": "Inter, system-ui, sans-serif", "size": 11, "color": _TEXT},
            "showlegend": False,
            "margin": {"l": 20, "r": 20, "t": 20, "b": 20},
            "xaxis": {
                "showgrid": False,
                "zeroline": False,
                "showticklabels": False,
                "range": [-1.4, 1.4],
            },
            "yaxis": {
                "showgrid": False,
                "zeroline": False,
                "showticklabels": False,
                "range": [-1.4, 1.4],
                "scaleanchor": "x",
                "scaleratio": 1,
            },
            "annotations": [
                {
                    "text": f"Base: {base_zone} · Quote: {quote_zone} · Bilateral risk: {agent.geo_bilateral_risk:.3f}",
                    "xref": "paper",
                    "yref": "paper",
                    "x": 0.5,
                    "y": -0.02,
                    "showarrow": False,
                    "font": {"size": 10, "color": _MUTED},
                }
            ],
        }
        return json.dumps(traces), json.dumps(layout)

    def _build_zone_chart(self, agent: AgentSignal) -> tuple[str, str]:
        """Grouped horizontal bar: top-5 feature z-scores for base and quote zones."""
        base_expl = agent.geo_base_zone_explanation or {}
        quote_expl = agent.geo_quote_zone_explanation or {}
        base_zone = base_expl.get("zone", "Base")
        quote_zone = quote_expl.get("zone", "Quote")

        base_fz: dict[str, float] = base_expl.get("feature_zscores", {})
        quote_fz: dict[str, float] = quote_expl.get("feature_zscores", {})

        # Top 5 features by absolute z-score from base zone
        all_features = sorted(
            set(list(base_fz.keys()) + list(quote_fz.keys())),
            key=lambda f: abs(base_fz.get(f, 0)) + abs(quote_fz.get(f, 0)),
            reverse=True,
        )[:5]

        base_vals = [round(base_fz.get(f, 0), 3) for f in all_features]
        quote_vals = [round(quote_fz.get(f, 0), 3) for f in all_features]

        chart_data = [
            {
                "type": "bar",
                "orientation": "h",
                "name": base_zone,
                "x": base_vals,
                "y": all_features,
                "marker": {
                    "color": [_GREEN if v >= 0 else _RED for v in base_vals],
                    "opacity": 0.85,
                },
                "offsetgroup": "a",
            },
            {
                "type": "bar",
                "orientation": "h",
                "name": quote_zone,
                "x": quote_vals,
                "y": all_features,
                "marker": {
                    "color": [_GREEN if v >= 0 else _RED for v in quote_vals],
                    "opacity": 0.5,
                },
                "offsetgroup": "b",
            },
        ]

        x_abs_max = max(abs(v) for v in base_vals + quote_vals) if (base_vals + quote_vals) else 2.0
        x_pad = x_abs_max * 1.25 or 2.0

        layout = {
            "paper_bgcolor": _BG,
            "plot_bgcolor": _BG,
            "font": {"family": "Inter, system-ui, sans-serif", "size": 11, "color": _TEXT},
            "barmode": "group",
            "showlegend": True,
            "legend": {"orientation": "h", "x": 0.5, "xanchor": "center", "y": 1.05},
            "margin": {"l": 110, "r": 60, "t": 30, "b": 30},
            "xaxis": {
                "gridcolor": _GRID,
                "showgrid": True,
                "zeroline": True,
                "zerolinecolor": _MUTED,
                "zerolinewidth": 1.5,
                "range": [-x_pad, x_pad],
                "title": {"text": "z-score (σ)"},
            },
            "yaxis": {"gridcolor": _GRID, "showgrid": False},
        }
        return json.dumps(chart_data), json.dumps(layout)

    def _build_sentiment_chart(self, agent: AgentSignal) -> tuple[str, str]:
        """Bar chart of sentiment z-scores."""
        labels, values, colors = [], [], []

        def _add(label: str, val: float | None) -> None:
            if val is not None:
                labels.append(label)
                values.append(round(val, 3))
                colors.append(_GREEN if val >= 0 else _RED)

        _add("GDELT Tone σ", agent.gdelt_tone_zscore)
        _add("GDELT Attention σ", agent.gdelt_attention_zscore)
        _add("Macro Attention σ", agent.macro_attention_zscore)

        if not labels:
            return self._empty_chart("Sentiment data unavailable")

        chart_data = [
            {
                "type": "bar",
                "x": labels,
                "y": values,
                "marker": {"color": colors},
                "text": [f"{v:+.3f}σ" for v in values],
                "textposition": "outside",
            }
        ]

        y_abs_max = max(abs(v) for v in values) if values else 2.0
        y_pad = y_abs_max * 1.4 or 2.0

        layout = {
            "paper_bgcolor": _BG,
            "plot_bgcolor": _BG,
            "font": {"family": "Inter, system-ui, sans-serif", "size": 12, "color": _TEXT},
            "showlegend": False,
            "margin": {"l": 40, "r": 40, "t": 20, "b": 60},
            "xaxis": {"gridcolor": _GRID, "showgrid": False},
            "yaxis": {
                "gridcolor": _GRID,
                "showgrid": True,
                "zeroline": True,
                "zerolinecolor": _MUTED,
                "zerolinewidth": 1.5,
                "range": [-y_pad, y_pad],
                "title": {"text": "z-score (σ)"},
            },
            "shapes": [
                {
                    "type": "line",
                    "xref": "paper",
                    "yref": "y",
                    "x0": 0,
                    "x1": 1,
                    "y0": 0,
                    "y1": 0,
                    "line": {"color": _MUTED, "width": 1},
                },
            ],
        }
        return json.dumps(chart_data), json.dumps(layout)

    @staticmethod
    def _empty_chart(message: str) -> tuple[str, str]:
        """Return a minimal placeholder chart with a centred message."""
        chart_data = [
            {
                "type": "scatter",
                "mode": "text",
                "x": [0],
                "y": [0],
                "text": [message],
                "textfont": {"size": 13, "color": _MUTED},
            }
        ]
        layout = {
            "paper_bgcolor": _BG,
            "plot_bgcolor": _BG,
            "showlegend": False,
            "margin": {"l": 10, "r": 10, "t": 10, "b": 10},
            "xaxis": {"showgrid": False, "zeroline": False, "showticklabels": False},
            "yaxis": {"showgrid": False, "zeroline": False, "showticklabels": False},
        }
        return json.dumps(chart_data), json.dumps(layout)

    # ── Template context ───────────────────────────────────────────────────────

    def _build_template_context(
        self,
        data: PairReportData,
        narrative: dict[str, Any],
        charts: dict[str, tuple[str, str]],
    ) -> dict[str, Any]:
        a = data.agent
        c = data.coordinator
        r = data.report_row

        action = c.suggested_action or "FLAT"
        confidence_pct = f"{int((c.conviction_score or 0) * 100)}%"  # conviction → display
        tier = c.confidence_tier or "none"
        # Confidence display from tier
        tier_label_map = {"high": "78%", "medium": "62%", "low": "45%", "none": "—"}
        confidence_display = tier_label_map.get(tier, confidence_pct)

        risk_map = {"high": "High", "medium": "Medium", "low": "Low", "none": "Minimal"}
        risk_level = risk_map.get(tier, "Medium")

        tech_dir = a.tech_direction
        tech_label_map = {1: "LONG", 0: "SHORT"}
        tech_direction_label = (
            tech_label_map.get(tech_dir, "NEUTRAL") if tech_dir is not None else "NEUTRAL"
        )

        macro_dir = a.macro_direction or ""
        macro_dir_label = (
            "BULLISH"
            if macro_dir == "up"
            else "BEARISH" if macro_dir == "down" else macro_dir.upper() or "NEUTRAL"
        )

        geo_regime = (a.geo_risk_regime or "").upper()

        # Card CSS classes
        def _bull_bear_cls(is_bull: bool | None) -> str:
            if is_bull is None:
                return "agent-card--neutral"
            return "agent-card--bull" if is_bull else "agent-card--bear"

        tech_card_class = _bull_bear_cls(tech_dir == 1 if tech_dir is not None else None)
        macro_card_class = _bull_bear_cls(macro_dir == "up" if macro_dir else None)
        geo_card_class = _bull_bear_cls(a.geo_risk_regime == "low" if a.geo_risk_regime else None)
        sentiment_card_class = _bull_bear_cls(
            not a.composite_stress_flag if a.composite_stress_flag is not None else None
        )

        # Spot price from OHLCV (latest close)
        spot_price, daily_move_pct = self._get_latest_price(data.pair)

        # Timeframe votes for display
        tf_votes_raw = a.tech_timeframe_votes or {}
        tf_votes = [(tf, tf_votes_raw.get(tf, 0)) for tf in ["D1", "H4", "H1"]]

        # Snapshot indicators
        tech_snap = a.tech_indicator_snapshot or {}

        # Ranked pairs from narrative_context
        nc = r.narrative_context or {}
        all_pairs_ranked = nc.get("all_pairs", [])

        ranked_pairs_ctx = []
        for p_data in all_pairs_ranked:
            ranked_pairs_ctx.append(
                {
                    "pair": p_data.get("pair", ""),
                    "action": p_data.get("action", "—"),
                    "conviction": p_data.get("conviction", 0.0),
                    "tier": p_data.get("confidence", "none"),
                    "ic": p_data.get("direction_ic") if "direction_ic" in p_data else None,
                    "horizon": p_data.get("horizon", "—"),
                    "sl_pct": c.sl_pct if p_data.get("pair") == data.pair else 0.0,
                    "tp_pct": c.tp_pct if p_data.get("pair") == data.pair else 0.0,
                    "rr": c.risk_reward_ratio if p_data.get("pair") == data.pair else 0.0,
                    "is_top_pick": p_data.get("pair") == r.top_pick,
                }
            )

        # Geo top events
        geo_top_events = a.geo_top_events or []

        ctx = {
            # Meta
            "pair": data.pair,
            "pair_lower": data.pair.lower(),
            "date_display": (
                f"{data.target_date.day} {data.target_date.strftime('%b %Y')}"
                if hasattr(data.target_date, "strftime")
                else str(data.target_date)
            ),
            "date_iso": str(data.target_date),
            "generated_at": datetime.now(timezone.utc).strftime("%H:%M"),
            "all_pairs_list": _PAIRS,
            # Action / trade parameters
            "action": action,
            "confidence_pct": confidence_display,
            "confidence_tier": tier,
            "risk_level": risk_level,
            "horizon": c.direction_horizon or "—",
            "risk_reward": f"{c.risk_reward_ratio:.2f}" if c.risk_reward_ratio else "—",
            "conviction_score": f"{c.conviction_score:.4f}" if c.conviction_score else "—",
            "position_size_pct": f"{c.position_size_pct:.1f}" if c.position_size_pct else "—",
            "sl_pct": f"{c.sl_pct:.4f}" if c.sl_pct else "—",
            "tp_pct": f"{c.tp_pct:.4f}" if c.tp_pct else "—",
            "direction_ic": f"{c.direction_ic:.3f}" if c.direction_ic else "n/a",
            "direction_source": c.direction_source or "—",
            "vol_source": c.vol_source or "—",
            "vol_pct": f"{c.estimated_vol_3d * 100:.3f}%" if c.estimated_vol_3d else "—",
            "global_regime": r.global_regime or "normal",
            # Spot / price
            "spot_price": spot_price,
            "daily_move_pct": daily_move_pct,
            # Hero image
            "hero_image_src": f"/reports/assets/generated_images/{data.pair.lower()}-hero-dynamic.jpeg",
            # Narrative (from LLM)
            "hero_thesis": narrative.get("hero_thesis", ""),
            "hero_subtitle": narrative.get("hero_subtitle", ""),
            "decision_title": narrative.get("decision_title", f"{action} signal on {data.pair}"),
            "decision_drivers": narrative.get("decision_drivers", ["—", "—", "—"]),
            "invalidation_risk_title": narrative.get("invalidation_risk_title", "Signal reversal"),
            "invalidation_risk_body": narrative.get("invalidation_risk_body", ""),
            "monitor_signals": narrative.get("monitor_signals", []),
            "tech_summary": narrative.get("tech_summary", ""),
            "macro_summary": narrative.get("macro_summary", ""),
            "geo_summary": narrative.get("geo_summary", ""),
            "sentiment_summary": narrative.get("sentiment_summary", ""),
            "risk_assessment": narrative.get("risk_assessment", ""),
            # Technical agent
            "tech_direction_label": tech_direction_label,
            "tech_confidence_pct": f"{int((a.tech_confidence or 0) * 100)}%",
            "tech_vol_regime": a.tech_vol_regime or "—",
            "tech_rsi": f"{tech_snap.get('rsi', 0):.1f}",
            "tech_bb_pct": f"{tech_snap.get('bb_pct', 0):.3f}",
            "tech_above_ema200": "YES" if tech_snap.get("above_ema200") else "NO",
            "tech_atr_rank": f"{tech_snap.get('atr_pct_rank', 0):.3f}",
            "tech_tf_votes": tf_votes,
            "tech_card_class": tech_card_class,
            # Macro agent
            "macro_direction_label": macro_dir_label,
            "macro_confidence_pct": f"{int((a.macro_confidence or 0) * 100)}%",
            "macro_dominant_driver": a.macro_dominant_driver or "—",
            "macro_carry_score": (
                f"{a.macro_carry_score:+.4f}" if a.macro_carry_score is not None else "—"
            ),
            "macro_regime_score": (
                f"{a.macro_regime_score:+.4f}" if a.macro_regime_score is not None else "—"
            ),
            "macro_fundamental_score": (
                f"{a.macro_fundamental_score:+.4f}"
                if a.macro_fundamental_score is not None
                else "—"
            ),
            "macro_surprise_score": (
                f"{a.macro_surprise_score:+.4f}" if a.macro_surprise_score is not None else "—"
            ),
            "macro_bias_score": (
                f"{a.macro_bias_score:+.4f}" if a.macro_bias_score is not None else "—"
            ),
            "macro_card_class": macro_card_class,
            # Geo agent
            "geo_regime_label": geo_regime or "—",
            "geo_bilateral_risk": (
                f"{a.geo_bilateral_risk:.4f}" if a.geo_bilateral_risk is not None else "—"
            ),
            "geo_base_zone": (a.geo_base_zone_explanation or {}).get("zone", "—"),
            "geo_base_driver": (a.geo_base_zone_explanation or {}).get("dominant_driver", "—"),
            "geo_quote_zone": (a.geo_quote_zone_explanation or {}).get("zone", "—"),
            "geo_quote_driver": (a.geo_quote_zone_explanation or {}).get("dominant_driver", "—"),
            "geo_top_events": geo_top_events,
            "geo_card_class": geo_card_class,
            # Sentiment agent
            "sentiment_stress_label": "STRESSED" if a.composite_stress_flag else "NORMAL",
            "composite_stress": a.composite_stress_flag,
            "stress_sources": a.sentiment_stress_sources or [],
            "gdelt_tone_z": a.gdelt_tone_zscore,
            "gdelt_attention_z": a.gdelt_attention_zscore,
            "macro_attention_z": a.macro_attention_zscore,
            "stocktwits_vol_signal": a.usdjpy_stocktwits_vol_signal,
            "sentiment_card_class": sentiment_card_class,
            # Expert appendix
            "ranked_pairs": ranked_pairs_ctx,
            "nc_overall_action": nc.get("overall_action", "trade"),
            "nc_top_pick": nc.get("top_pick", r.top_pick or "—"),
            "nc_global_regime": nc.get("global_regime", r.global_regime or "normal"),
            "nc_hold_reason": nc.get("hold_reason"),
            "nc_top_recommendation": nc.get("top_recommendation", {}),
            "nc_all_pairs": nc.get("all_pairs", []),
            "narrative_context_json": (
                json.dumps(r.narrative_context, indent=2) if r.narrative_context else "{}"
            ),
            # Charts
            "ohlcv_data_json": charts["ohlcv"][0],
            "ohlcv_layout_json": charts["ohlcv"][1],
            "macro_data_json": charts["macro"][0],
            "macro_layout_json": charts["macro"][1],
            "gat_data_json": charts["gat"][0],
            "gat_layout_json": charts["gat"][1],
            "zone_data_json": charts["zone"][0],
            "zone_layout_json": charts["zone"][1],
            "sentiment_data_json": charts["sentiment"][0],
            "sentiment_layout_json": charts["sentiment"][1],
        }
        return ctx

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _get_latest_price(self, pair: str) -> tuple[str, str]:
        """Return (spot_price_str, daily_move_pct_str) from Silver OHLCV."""
        try:
            from src.agents.technical.features import load_pair

            df = load_pair(pair + "m", "D1")
            close = df["close"].iloc[-1]
            prev = df["close"].iloc[-2] if len(df) >= 2 else close
            move = (close - prev) / prev * 100
            sign = "+" if move >= 0 else ""
            return f"{close:.5f}", f"{sign}{move:.2f}%"
        except Exception:
            return "—", "—"

    def _retrieve_rag_context(self, query: str, top_k: int = 5) -> list[str]:
        """Synchronous ChromaDB retrieval without the async wrapper."""
        try:
            from src.rag.embedder import embed_query
            from src.rag.indexer import get_collection

            collection = get_collection(self._chroma_dir)
            if collection.count() == 0:
                return []

            query_embedding = embed_query(query)
            result = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count()),
                include=["documents", "metadatas", "distances"],
            )

            chunks = []
            docs = result.get("documents", [[]])[0]
            metas = result.get("metadatas", [[]])[0]
            distances = result.get("distances", [[]])[0]
            for doc, meta, dist in zip(docs, metas, distances):
                score = max(0.0, 1.0 - dist)
                source = f"{meta.get('source', '?')} | {meta.get('date', '?')}"
                chunks.append(f"[{source}] (score={score:.3f})\n{doc[:400]}")
            return chunks
        except Exception as exc:
            logger.warning("RAG retrieval failed: %s", exc)
            return []

    def _save_to_disk(self, pair: str, target_date: date, html: str) -> Path:
        """Save full standalone HTML document to disk. Returns saved path."""
        date_str = str(target_date)
        report_dir = self._reports_dir / date_str
        report_dir.mkdir(parents=True, exist_ok=True)
        disk_path = report_dir / f"{pair}.html"

        # Wrap in a complete HTML document for standalone offline viewing
        standalone = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{pair} Deep Dive Report — {date_str} | FX-AlphaLab</title>
  <link rel="stylesheet" href="/reports/static/report.css" />
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js" defer></script>
</head>
<body>
{html}
</body>
</html>"""
        disk_path.write_text(standalone, encoding="utf-8")
        return disk_path

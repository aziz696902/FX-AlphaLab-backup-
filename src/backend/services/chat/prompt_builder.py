"""Builds the system prompt from the structured inference context.

The system prompt is injected into every Gemini request via system_instruction.
It contains the full agent output snapshot so the LLM can answer questions
grounded in real data without hallucinating numbers.
"""

from __future__ import annotations

import json

from src.backend.services.chat.context_builder import InferenceContext

_PERSONA = """\
You are Alpha Analyst, an expert FX market analyst AI embedded in the FX-AlphaLab trading dashboard.
You have real-time access to the outputs of a five-domain quantitative analysis system:

  1. Technical Agent  — price action, momentum indicators, volatility regime, multi-timeframe votes
  2. Macro Agent      — carry, regime, fundamental mispricing, macro bias, economic calendar surprises
  3. Sentiment Agent  — StockTwits volatility signal (USDJPY), GDELT news tone, Google Trends attention
  4. Geopolitical Agent — GDELT events graph, bilateral zone risk scores, dominant geopolitical drivers
  5. Coordinator      — signal fusion across all agents, confidence tier, trade parameters (size, SL, TP)

RULES:
- Never invent or modify any number from the data. Use values exactly as provided, or state "not available".
- Be direct, precise, and concise. Use professional trader language.
- When asked about a specific pair or agent, reference the exact data provided below.
- If data for a field is None/null/missing, say so explicitly rather than guessing.
- Format prices to 5 decimal places, percentages to 2 decimal places, z-scores to 3 decimal places.
- You may offer interpretation and context, but always anchor it to the provided quantitative data.
"""


def build_system_prompt(ctx: InferenceContext) -> str:
    """Render a complete system prompt from the current inference context."""
    sections: list[str] = [_PERSONA, ""]

    _append_report(sections, ctx)
    _append_coordinator_signals(sections, ctx)
    _append_agent_signals(sections, ctx)
    _append_mt5(sections, ctx)

    return "\n".join(sections)


# ── Section renderers ─────────────────────────────────────────────────────────


def _append_report(sections: list[str], ctx: InferenceContext) -> None:
    if ctx.report is None:
        sections.append("=== INFERENCE CONTEXT ===")
        sections.append("No coordinator report available yet. Inference has not been run today.")
        sections.append("")
        return

    r = ctx.report
    sections.append(f"=== TODAY'S REPORT (date: {r['date']}) ===")
    sections.append(f"Overall action : {(r.get('overall_action') or 'unknown').upper()}")
    sections.append(f"Global regime  : {r.get('global_regime') or 'unknown'}")
    if r.get("top_pick"):
        sections.append(f"Top pick       : {r['top_pick']}")
    if r.get("hold_reason"):
        sections.append(f"Hold reason    : {r['hold_reason']}")
    sections.append("")


def _append_coordinator_signals(sections: list[str], ctx: InferenceContext) -> None:
    if not ctx.coordinator_signals:
        return

    sections.append("=== COORDINATOR SIGNALS (per pair) ===")
    for s in ctx.coordinator_signals:
        pick_marker = " ★ TOP PICK" if s.get("is_top_pick") else ""
        flat = f" ({s['flat_reason']})" if s.get("flat_reason") else ""
        ic = f"{s['direction_ic']:.4f}" if s.get("direction_ic") is not None else "N/A"
        sections.append(
            f"  {s['pair']}{pick_marker}: {s.get('suggested_action', '?')}{flat}"
            f" | tier={s.get('confidence_tier', '?')}"
            f" | conviction={s.get('conviction_score') or 0:.4f}"
            f" | horizon={s.get('direction_horizon', '?')}"
            f" | IC={ic}"
            f" | source={s.get('direction_source', '?')}"
            f" | size={s.get('position_size_pct') or 0:.1f}%"
            f" | SL={s.get('sl_pct') or 0:.3f}%"
            f" | TP={s.get('tp_pct') or 0:.3f}%"
            f" | RR={s.get('risk_reward_ratio') or 0:.2f}"
            f" | vol_src={s.get('vol_source', '?')}"
            f" | regime={s.get('regime', '?')}"
        )
    sections.append("")


def _append_agent_signals(sections: list[str], ctx: InferenceContext) -> None:
    if not ctx.agent_signals:
        return

    sections.append("=== AGENT SIGNALS (per pair) ===")
    for s in ctx.agent_signals:
        sections.append(f"--- {s['pair']} ---")

        t = s["tech"]
        dir_label = (
            "UP(1)"
            if t.get("direction") == 1
            else ("DOWN(0)" if t.get("direction") == 0 else "N/A")
        )
        sections.append(
            f"  Technical : direction={dir_label}"
            f" | confidence={t.get('confidence') or 0:.3f}"
            f" | vol_regime={t.get('vol_regime') or 'N/A'}"
        )
        if t.get("indicator_snapshot"):
            ind = t["indicator_snapshot"]
            sections.append(
                f"    Indicators: RSI={ind.get('rsi') or 0:.1f}"
                f" | MACD_hist={ind.get('macd_hist') or 0:.5f}"
                f" | BB_pct={ind.get('bb_pct') or 0:.3f}"
                f" | above_EMA200={ind.get('above_ema200')}"
                f" | ATR_pct_rank={ind.get('atr_pct_rank') or 0:.3f}"
            )
        if t.get("timeframe_votes"):
            sections.append(f"    TF votes: {t['timeframe_votes']}")

        m = s["macro"]
        sections.append(
            f"  Macro     : direction={m.get('direction') or 'N/A'}"
            f" | confidence={m.get('confidence') or 0:.3f}"
            f" | dominant_driver={m.get('dominant_driver') or 'N/A'}"
            f" | carry={m.get('carry_score') or 0:.3f}"
            f" | regime={m.get('regime_score') or 0:.3f}"
            f" | fundamental={m.get('fundamental_score') or 0:.3f}"
            f" | bias={m.get('bias_score') or 0:.3f}"
        )
        if m.get("top_calendar_events"):
            sections.append(f"    Top calendar events: {json.dumps(m['top_calendar_events'])}")

        g = s["geo"]
        sections.append(
            f"  Geo       : bilateral_risk={g.get('bilateral_risk') or 0:.4f}"
            f" | risk_regime={g.get('risk_regime') or 'N/A'}"
        )
        if g.get("base_zone"):
            bz = g["base_zone"]
            sections.append(
                f"    Base zone : zone={bz.get('zone')}"
                f" | risk={bz.get('risk_score') or 0:.4f}"
                f" | driver={bz.get('dominant_driver')}"
            )
        if g.get("quote_zone"):
            qz = g["quote_zone"]
            sections.append(
                f"    Quote zone: zone={qz.get('zone')}"
                f" | risk={qz.get('risk_score') or 0:.4f}"
                f" | driver={qz.get('dominant_driver')}"
            )
        if g.get("top_events"):
            sections.append(f"    Top geo events: {json.dumps(g['top_events'][:3])}")

        sn = s["sentiment"]
        gdelt_tone = (
            f"{sn.get('gdelt_tone_zscore') or 0:.3f}"
            if sn.get("gdelt_tone_zscore") is not None
            else "N/A"
        )
        macro_att = (
            f"{sn.get('macro_attention_zscore') or 0:.3f}"
            if sn.get("macro_attention_zscore") is not None
            else "N/A"
        )
        sections.append(
            f"  Sentiment : stress_flag={sn.get('composite_stress_flag')}"
            f" | gdelt_tone_z={gdelt_tone}"
            f" | macro_attention_z={macro_att}"
        )
        if sn.get("usdjpy_vol_signal") is not None:
            sections.append(f"    USDJPY StockTwits vol signal: {sn['usdjpy_vol_signal']:.4f}")
        if sn.get("stress_sources"):
            sections.append(f"    Stress sources: {sn['stress_sources']}")

    sections.append("")


def _append_mt5(sections: list[str], ctx: InferenceContext) -> None:
    if not ctx.mt5.account and not ctx.mt5.positions:
        return

    if ctx.mt5.account:
        a = ctx.mt5.account
        sections.append("=== MT5 ACCOUNT ===")
        sections.append(
            f"  Balance={a.get('balance', 0):.2f}"
            f" | Equity={a.get('equity', 0):.2f}"
            f" | Free_margin={a.get('margin_free', 0):.2f}"
            f" | Margin_level={a.get('margin_level', 0):.1f}%"
            f" | Open_PnL={a.get('profit', 0):.2f}"
        )
        sections.append("")

    if ctx.mt5.positions:
        sections.append("=== OPEN POSITIONS ===")
        for p in ctx.mt5.positions:
            sections.append(
                f"  {p.get('symbol')} {p.get('side')} {p.get('volume')} lots"
                f" @ {p.get('open_price', 0):.5f}"
                f" | current={p.get('current_price', 0):.5f}"
                f" | PnL={p.get('profit', 0):.2f}"
                f" | SL={p.get('sl', 0):.5f}"
                f" | TP={p.get('tp', 0):.5f}"
            )
        sections.append("")

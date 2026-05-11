"""Builds the structured inference context fed to the chat LLM.

Reads the latest coordinator report and all per-pair agent signals from the
Gold layer, and accepts optional live MT5 state injected by the router.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from src.shared.db.models import AgentSignal, CoordinatorReportRow, CoordinatorSignalRow

logger = logging.getLogger(__name__)


@dataclass
class MT5State:
    """Live MT5 account and position snapshot. Empty when MT5 is unavailable."""

    positions: list[dict] = field(default_factory=list)
    account: dict | None = None


@dataclass
class InferenceContext:
    """All data available to the chat LLM for the current session."""

    report: dict | None
    agent_signals: list[dict]
    coordinator_signals: list[dict]
    mt5: MT5State


def build_context(db: Session, mt5_state: MT5State | None = None) -> InferenceContext:
    """Fetch the latest agent outputs from the DB and compose the context payload.

    Queries are scoped to the most recent coordinator report date so that
    agent_signals and coordinator_signals are always aligned with the report.
    """
    report_row = db.query(CoordinatorReportRow).order_by(CoordinatorReportRow.date.desc()).first()

    if report_row is None:
        logger.warning("No coordinator report found — chat will run without inference context")
        return InferenceContext(
            report=None,
            agent_signals=[],
            coordinator_signals=[],
            mt5=mt5_state or MT5State(),
        )

    report = {
        "date": str(report_row.date),
        "top_pick": report_row.top_pick,
        "overall_action": report_row.overall_action,
        "hold_reason": report_row.hold_reason,
        "global_regime": report_row.global_regime,
        "narrative_context": report_row.narrative_context,
    }

    agent_rows = db.query(AgentSignal).filter(AgentSignal.date == report_row.date).all()
    coord_rows = (
        db.query(CoordinatorSignalRow).filter(CoordinatorSignalRow.date == report_row.date).all()
    )

    agent_signals = [_serialize_agent_signal(r) for r in agent_rows]
    coordinator_signals = [_serialize_coordinator_signal(r) for r in coord_rows]

    return InferenceContext(
        report=report,
        agent_signals=agent_signals,
        coordinator_signals=coordinator_signals,
        mt5=mt5_state or MT5State(),
    )


def _serialize_agent_signal(r: AgentSignal) -> dict:
    return {
        "pair": r.pair,
        "tech": {
            "direction": r.tech_direction,
            "confidence": r.tech_confidence,
            "vol_regime": r.tech_vol_regime,
            "indicator_snapshot": r.tech_indicator_snapshot,
            "timeframe_votes": r.tech_timeframe_votes,
        },
        "geo": {
            "bilateral_risk": r.geo_bilateral_risk,
            "risk_regime": r.geo_risk_regime,
            "top_events": r.geo_top_events,
            "base_zone": r.geo_base_zone_explanation,
            "quote_zone": r.geo_quote_zone_explanation,
        },
        "macro": {
            "direction": r.macro_direction,
            "confidence": r.macro_confidence,
            "carry_score": r.macro_carry_score,
            "regime_score": r.macro_regime_score,
            "fundamental_score": r.macro_fundamental_score,
            "bias_score": r.macro_bias_score,
            "dominant_driver": r.macro_dominant_driver,
            "top_calendar_events": r.macro_top_calendar_events,
        },
        "sentiment": {
            "usdjpy_vol_signal": r.usdjpy_stocktwits_vol_signal,
            "gdelt_tone_zscore": r.gdelt_tone_zscore,
            "gdelt_attention_zscore": r.gdelt_attention_zscore,
            "macro_attention_zscore": r.macro_attention_zscore,
            "composite_stress_flag": r.composite_stress_flag,
            "stress_sources": r.sentiment_stress_sources,
        },
    }


def _serialize_coordinator_signal(r: CoordinatorSignalRow) -> dict:
    return {
        "pair": r.pair,
        "suggested_action": r.suggested_action,
        "confidence_tier": r.confidence_tier,
        "direction": r.direction,
        "direction_source": r.direction_source,
        "direction_horizon": r.direction_horizon,
        "direction_ic": r.direction_ic,
        "conviction_score": r.conviction_score,
        "position_size_pct": r.position_size_pct,
        "sl_pct": r.sl_pct,
        "tp_pct": r.tp_pct,
        "risk_reward_ratio": r.risk_reward_ratio,
        "estimated_vol_3d": r.estimated_vol_3d,
        "vol_signal": r.vol_signal,
        "vol_source": r.vol_source,
        "regime": r.regime,
        "flat_reason": r.flat_reason,
        "is_top_pick": r.is_top_pick,
        "overall_action": r.overall_action,
    }

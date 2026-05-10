"""Router for display-only OHLCV candlestick data.

Data source priority:
1. MT5 (when connected) — live, always current
2. Dukascopy Silver parquet (fallback when MT5 unavailable)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from src.backend.schemas.ohlcv import OHLCVBar
from src.ingestion.preprocessors.dukascopy_preprocessor import _TF_RULE, DukascopyPreprocessor
from src.live.mt5_connection import mt5_connection
from src.shared.config import Config

router = APIRouter(prefix="/ohlcv", tags=["ohlcv"])

_VALID_INSTRUMENTS = set(DukascopyPreprocessor.DEFAULT_INSTRUMENTS)
# M1 is MT5-only (no Silver fallback); others have Silver fallback via _TF_RULE
_VALID_TIMEFRAMES = set(_TF_RULE) | {"M1"}
_DAYS_CAP: dict[str, int] = {"M1": 1, "M15": 90, "H1": 365, "H4": 365, "D1": 365}

# Approximate bars per day per timeframe (used to convert days → bar count for MT5)
_BARS_PER_DAY: dict[str, int] = {"M1": 1440, "M15": 96, "H1": 24, "H4": 6, "D1": 1}


def _mt5_tf_constant(tf: str) -> int:
    """Map canonical timeframe string to MT5 TIMEFRAME_* constant."""
    try:
        import MetaTrader5 as mt5  # noqa: N813
    except ImportError:
        raise HTTPException(status_code=503, detail="MT5 module not available")

    mapping = {
        "M1": mt5.TIMEFRAME_M1,
        "M15": mt5.TIMEFRAME_M15,
        "H1": mt5.TIMEFRAME_H1,
        "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1,
    }
    if tf not in mapping:
        raise HTTPException(status_code=422, detail=f"Unsupported timeframe for MT5: {tf}")
    return mapping[tf]


async def _fetch_from_mt5(instrument: str, tf: str, days: int) -> list[OHLCVBar]:
    """Fetch OHLCV bars directly from MT5."""
    count = days * _BARS_PER_DAY[tf] + 10  # small buffer
    mt5_tf = _mt5_tf_constant(tf)
    rates = await mt5_connection.get_rates(instrument, mt5_tf, count=count)

    if not rates:
        raise HTTPException(status_code=404, detail=f"No MT5 data for {instrument} {tf}")

    start_dt = datetime.now(timezone.utc) - timedelta(days=days)
    bars = [
        OHLCVBar(
            timestamp_utc=datetime.fromtimestamp(r.time_utc, tz=timezone.utc),
            open=r.open,
            high=r.high,
            low=r.low,
            close=r.close,
            volume=float(r.tick_volume),
        )
        for r in rates
        if datetime.fromtimestamp(r.time_utc, tz=timezone.utc) >= start_dt
    ]

    if not bars:
        raise HTTPException(
            status_code=404, detail=f"No MT5 data for {instrument} in last {days} days"
        )

    return bars


def _fetch_from_silver(instrument: str, tf: str, days: int) -> list[OHLCVBar]:
    """Fallback: read from Dukascopy Silver parquet."""
    silver_path = (
        Config.DATA_DIR / "processed" / "ohlcv" / f"ohlcv_{instrument}_{tf}_latest.parquet"
    )
    if not silver_path.exists():
        raise HTTPException(status_code=404, detail=f"No Silver data for {instrument} {tf}")

    df = pd.read_parquet(silver_path)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {instrument} {tf}")

    df = df.reset_index()
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
    start_dt = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=days)
    df = df[df["timestamp_utc"] >= start_dt]

    if df.empty:
        raise HTTPException(
            status_code=404, detail=f"No Silver data for {instrument} in last {days} days"
        )

    return [OHLCVBar(**row) for row in df.to_dict("records")]


@router.get("/{instrument}", response_model=list[OHLCVBar])
async def get_ohlcv(
    instrument: str,
    tf: str = Query(default="H1"),
    days: int = Query(default=30, ge=1),
) -> list[OHLCVBar]:
    """Return OHLCV bars for display. Uses MT5 when connected, Silver parquet as fallback."""
    if instrument not in _VALID_INSTRUMENTS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid instrument '{instrument}'. Must be one of: {sorted(_VALID_INSTRUMENTS)}",
        )
    if tf not in _VALID_TIMEFRAMES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid timeframe '{tf}'. Must be one of: {sorted(_VALID_TIMEFRAMES)}",
        )

    days = min(days, _DAYS_CAP[tf])

    if mt5_connection._initialized:
        return await _fetch_from_mt5(instrument, tf, days)

    return _fetch_from_silver(instrument, tf, days)

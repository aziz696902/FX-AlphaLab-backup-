"""Load GDELT GKG rows from Silver parquet files and format them as text chunks.

Since the Silver layer has no headline field, each row is rendered as a
structured metadata string (date, tone, themes, locations).
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

_GDELT_SILVER_ROOT = ("processed", "sentiment", "source=gdelt")


def load_gdelt_gkg(data_dir: Path, cutoff_date: date) -> list[dict]:
    """Return GDELT GKG rows as formatted text dicts, filtered by cutoff_date.

    Args:
        data_dir:    Project data/ root (Config.DATA_DIR).
        cutoff_date: Inclusive lower bound.

    Returns:
        List of dicts with keys: text, url, date (YYYY-MM-DD str), source="gdelt".
    """
    silver_root = data_dir
    for part in _GDELT_SILVER_ROOT:
        silver_root = silver_root / part

    if not silver_root.exists():
        logger.warning("GDELT GKG Silver dir not found: %s", silver_root)
        return []

    parquet_files = list(silver_root.glob("**/sentiment_cleaned.parquet"))
    if not parquet_files:
        return []

    frames: list[pd.DataFrame] = []
    for pq_path in parquet_files:
        try:
            df = pd.read_parquet(pq_path)
            frames.append(df)
        except Exception as exc:
            logger.warning("Failed to read %s: %s", pq_path, exc)

    if not frames:
        return []

    df = pd.concat(frames, ignore_index=True)
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True, errors="coerce")
    df = df.dropna(subset=["timestamp_utc"])
    df = df[df["timestamp_utc"].dt.date >= cutoff_date]

    docs: list[dict] = []
    for _, row in df.iterrows():
        text = _format_row(row)
        if not text:
            continue
        docs.append(
            {
                "text": text,
                "url": str(row.get("url", "")),
                "date": row["timestamp_utc"].date().isoformat(),
                "source": "gdelt",
            }
        )

    logger.info("Loaded %d GDELT GKG rows (cutoff=%s)", len(docs), cutoff_date)
    return docs


def _join_field(value, max_items: int) -> str:
    """Safely convert a list/array/str field to a comma-separated preview string."""
    if value is None:
        return ""
    try:
        # Handles numpy arrays, pandas arrays, plain lists
        items = list(value)
    except TypeError:
        items = [str(value)]
    items = [str(i) for i in items if i is not None and str(i).strip()]
    return ", ".join(items[:max_items])


def _format_row(row: pd.Series) -> str:
    parts: list[str] = []
    date_str = row["timestamp_utc"].strftime("%Y-%m-%d")
    tone = row.get("tone")
    tone_str = f"{tone:.2f}" if pd.notna(tone) else "N/A"
    parts.append(f"[GDELT GKG] {date_str} | tone={tone_str}")

    domain = row.get("source_domain", "")
    if domain and pd.notna(domain):
        parts[0] += f" | source={domain}"

    themes = row.get("themes")
    theme_preview = _join_field(themes, 5)
    if theme_preview:
        parts.append(f"Themes: {theme_preview}")

    locations = row.get("locations")
    loc_preview = _join_field(locations, 5)
    if loc_preview:
        parts.append(f"Locations: {loc_preview}")

    orgs = row.get("organizations")
    org_preview = _join_field(orgs, 3)
    if org_preview:
        parts.append(f"Organizations: {org_preview}")

    return " | ".join(parts)

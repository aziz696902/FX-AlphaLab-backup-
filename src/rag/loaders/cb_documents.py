"""Load CB documents (Fed / ECB / BoE) from Bronze JSONL files.

Reads raw JSONL written by the scraper collectors and returns a flat list
of document dicts filtered to the requested date window.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_CB_SOURCES = ("fed", "ecb", "boe")


def load_cb_documents(data_dir: Path, cutoff_date: date) -> list[dict]:
    """Return all CB documents published on or after cutoff_date.

    Args:
        data_dir:    Project data/ root (Config.DATA_DIR).
        cutoff_date: Inclusive lower bound; docs older than this are skipped.

    Returns:
        List of dicts with keys: url, title, content, document_type,
        speaker, date (YYYY-MM-DD str), source (fed/ecb/boe).
    """
    docs: list[dict] = []
    for source in _CB_SOURCES:
        bronze_dir = data_dir / "raw" / "news" / source
        if not bronze_dir.exists():
            continue
        for jsonl_path in bronze_dir.glob("*.jsonl"):
            docs.extend(_read_jsonl(jsonl_path, source, cutoff_date))
    logger.info("Loaded %d CB documents (cutoff=%s)", len(docs), cutoff_date)
    return docs


def _read_jsonl(path: Path, source: str, cutoff_date: date) -> list[dict]:
    results: list[dict] = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                doc = json.loads(line)
            except json.JSONDecodeError:
                continue
            raw_ts = doc.get("timestamp_published", "")
            try:
                pub_date = _parse_date(raw_ts)
            except ValueError:
                continue
            if pub_date < cutoff_date:
                continue
            content = doc.get("content", "").strip()
            if not content:
                continue
            results.append(
                {
                    "url": doc.get("url", ""),
                    "title": doc.get("title", ""),
                    "content": content,
                    "document_type": doc.get("document_type", ""),
                    "speaker": doc.get("speaker"),
                    "date": pub_date.isoformat(),
                    "source": source,
                }
            )
    return results


def _parse_date(ts: str) -> date:
    """Parse ISO 8601 timestamp (with or without trailing Z) to date."""
    ts = ts.rstrip("Z").replace("+00:00", "")
    if "T" in ts:
        return datetime.fromisoformat(ts).replace(tzinfo=timezone.utc).date()
    return date.fromisoformat(ts[:10])

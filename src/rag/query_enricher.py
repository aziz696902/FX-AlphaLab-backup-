"""Parse natural-language temporal and source signals into ChromaDB where clauses.

Supports date-relative phrases ("last week", "yesterday", "recent") and
source names ("fed", "ecb", "boe", "central bank", "gdelt").
Returns a ChromaDB-compatible where dict or None when no signals are found.
"""

from __future__ import annotations

import re
from datetime import date, timedelta

_SOURCE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bfed\b|federal reserve", re.I), "fed"),
    (re.compile(r"\becb\b|european central bank", re.I), "ecb"),
    (re.compile(r"\bboe\b|bank of england", re.I), "boe"),
    (re.compile(r"\bgdelt\b", re.I), "gdelt"),
    (re.compile(r"\bcentral bank\b", re.I), None),  # ambiguous → no source filter
]

_TEMPORAL_PATTERNS: list[tuple[re.Pattern, int]] = [
    (re.compile(r"\byesterday\b", re.I), 1),
    (re.compile(r"\blast\s+week\b", re.I), 7),
    (re.compile(r"\blast\s+month\b", re.I), 30),
    (re.compile(r"\brecent\b|\blatest\b|\btoday\b", re.I), 3),
    (re.compile(r"\blast\s+(\d+)\s+days?\b", re.I), None),  # dynamic
]


def enrich(query: str, today: date | None = None) -> dict | None:
    """Return a ChromaDB where clause derived from query signals, or None."""
    today = today or date.today()
    source = _detect_source(query)
    date_filter = _detect_date_filter(query, today)

    clauses: list[dict] = []
    if source:
        clauses.append({"source": {"$eq": source}})
    if date_filter:
        clauses.append({"date": {"$gte": date_filter}})

    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _detect_source(query: str) -> str | None:
    for pattern, source in _SOURCE_PATTERNS:
        if pattern.search(query):
            return source  # None for "central bank" — handled below
    return None


def _detect_date_filter(query: str, today: date) -> str | None:
    # Check dynamic "last N days" pattern first
    m = re.search(r"\blast\s+(\d+)\s+days?\b", query, re.I)
    if m:
        delta = int(m.group(1))
        return (today - timedelta(days=delta)).isoformat()

    for pattern, days in _TEMPORAL_PATTERNS:
        if days is None:
            continue  # dynamic pattern handled above
        if pattern.search(query):
            return (today - timedelta(days=days)).isoformat()

    return None

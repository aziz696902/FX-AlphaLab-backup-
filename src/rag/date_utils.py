"""Date helpers for RAG metadata and filters."""

from __future__ import annotations

from datetime import date


def date_to_int(value: date) -> int:
    """Return YYYYMMDD as an int for numeric date comparisons."""
    return int(value.strftime("%Y%m%d"))


def date_str_to_int(value: str) -> int | None:
    """Parse YYYY-MM-DD or YYYYMMDD to an int; return None if invalid."""
    if not value:
        return None
    raw = value.strip()
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        raw = raw[:10].replace("-", "")
    else:
        raw = "".join(ch for ch in raw if ch.isdigit())
    if len(raw) != 8:
        return None
    try:
        return int(raw)
    except ValueError:
        return None

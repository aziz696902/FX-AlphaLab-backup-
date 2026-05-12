"""Router for coordinator_reports and HTML deep-dive reports."""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from src.backend.dependencies import get_db
from src.backend.schemas.reports import CoordinatorReportResponse
from src.shared.db.models import CoordinatorReportRow
from src.shared.db.storage import get_latest_report_html, get_report_html_by_date

router = APIRouter(prefix="/reports", tags=["reports"])

_VALID_PAIRS = {"EURUSD", "GBPUSD", "USDCHF", "USDJPY"}


@router.get("/latest", response_model=CoordinatorReportResponse)
def get_latest_report(db: Session = Depends(get_db)) -> CoordinatorReportRow:
    """Return the most recent CoordinatorReport by date."""
    try:
        row = db.query(CoordinatorReportRow).order_by(CoordinatorReportRow.date.desc()).first()
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if row is None:
        raise HTTPException(status_code=404, detail="No reports found")
    return row


@router.get("/{date}", response_model=CoordinatorReportResponse)
def get_report_by_date(
    date: datetime.date,
    db: Session = Depends(get_db),
) -> CoordinatorReportRow:
    """Return the CoordinatorReport for a specific date (YYYY-MM-DD)."""
    try:
        row = db.query(CoordinatorReportRow).filter(CoordinatorReportRow.date == date).first()
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if row is None:
        raise HTTPException(status_code=404, detail=f"No report for {date}")
    return row


# ── HTML Deep-Dive Report endpoints ──────────────────────────────────────────


@router.get("/html/{pair}/latest", response_class=HTMLResponse)
def get_latest_html_report(pair: str) -> HTMLResponse:
    """Return the most recent generated HTML report for a pair.

    The HTML is the inner <div class="report-shell"> fragment — the frontend
    injects it via innerHTML so it inherits the existing CSS and Plotly loader.
    """
    pair = pair.upper()
    if pair not in _VALID_PAIRS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid pair. Must be one of: {', '.join(sorted(_VALID_PAIRS))}",
        )
    result = get_latest_report_html(pair)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No report generated for {pair} yet. Run the inference pipeline first.",
        )
    html, report_date = result
    return HTMLResponse(content=html, headers={"X-Report-Date": str(report_date)})


@router.get("/html/{pair}/{date}", response_class=HTMLResponse)
def get_html_report_by_date(pair: str, date: datetime.date) -> HTMLResponse:
    """Return the generated HTML report for a specific (pair, date)."""
    pair = pair.upper()
    if pair not in _VALID_PAIRS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid pair. Must be one of: {', '.join(sorted(_VALID_PAIRS))}",
        )
    html = get_report_html_by_date(pair, date)
    if html is None:
        raise HTTPException(
            status_code=404,
            detail=f"No report for {pair} on {date}.",
        )
    return HTMLResponse(content=html, headers={"X-Report-Date": str(date)})

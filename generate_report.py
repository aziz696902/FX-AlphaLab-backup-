"""Standalone report generation script.

Reads signal data from the Gold DB, generates LLM narrative + Plotly charts,
renders the Jinja2 template, saves HTML to disk and PostgreSQL.

Usage:
    python generate_report.py                    # latest date in DB
    python generate_report.py --date 2026-05-10  # specific date
    python generate_report.py --pair GBPUSD      # one pair only (latest date)
    python generate_report.py --date 2026-05-10 --pair EURUSD
"""

from __future__ import annotations

import argparse
import datetime
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    stream=sys.stdout,
)

parser = argparse.ArgumentParser(description="Generate daily HTML reports from signal data.")
parser.add_argument(
    "--date", type=str, help="Target date in YYYY-MM-DD format (default: latest in DB)"
)
parser.add_argument("--pair", type=str, help="Generate for one pair only (default: all 4 pairs)")
args = parser.parse_args()

# Resolve target date
from src.shared.db.models import CoordinatorReportRow  # noqa: E402
from src.shared.db.session import SessionLocal  # noqa: E402

db = SessionLocal()
try:
    if args.date:
        target_date = datetime.date.fromisoformat(args.date)
        row = (
            db.query(CoordinatorReportRow).filter(CoordinatorReportRow.date == target_date).first()
        )
        if row is None:
            print(f"Error: no coordinator report found for {target_date}.")
            print("Available dates:")
            rows = (
                db.query(CoordinatorReportRow)
                .order_by(CoordinatorReportRow.date.desc())
                .limit(5)
                .all()
            )
            for r in rows:
                print(f"  {r.date}  top_pick={r.top_pick}  action={r.overall_action}")
            sys.exit(1)
    else:
        row = db.query(CoordinatorReportRow).order_by(CoordinatorReportRow.date.desc()).first()
        if row is None:
            print(
                "Error: no coordinator reports in the database. Run the inference pipeline first."
            )
            sys.exit(1)
        target_date = row.date
        print(f"No --date specified, using latest: {target_date}")
finally:
    db.close()

from src.backend.services.report_generator import ReportGenerator  # noqa: E402

gen = ReportGenerator()

if args.pair:
    pair = args.pair.upper()
    valid = {"EURUSD", "GBPUSD", "USDCHF", "USDJPY"}
    if pair not in valid:
        print(f"Error: invalid pair '{pair}'. Must be one of: {', '.join(sorted(valid))}")
        sys.exit(1)
    # Generate just this pair by calling generate_for_date and filtering
    # We patch _PAIRS temporarily — cleaner approach: call generate_for_date and ignore others
    from src.backend.services import report_generator as _rg_mod

    orig_pairs = _rg_mod._PAIRS
    _rg_mod._PAIRS = [pair]
    try:
        paths = gen.generate_for_date(target_date)
    finally:
        _rg_mod._PAIRS = orig_pairs
else:
    paths = gen.generate_for_date(target_date)

if not paths:
    print("No reports generated — check logs above for errors.")
    sys.exit(1)

print(f"\nReports generated for {target_date}:")
for pair_name, path in paths.items():
    print(f"  {pair_name} -> {path}")

print("\nFrontend: http://localhost:3000/reports/EURUSD  (or other pair)")
print("API:      GET http://localhost:8000/reports/html/EURUSD/latest")

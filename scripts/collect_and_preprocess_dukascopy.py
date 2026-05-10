#!/usr/bin/env python
"""Collect Dukascopy data up to current moment and preprocess to Silver layer.

Usage:
    python scripts/collect_and_preprocess_dukascopy.py [--backfill] [--lookback DAYS]

Options:
    --backfill          Re-download all dates (default: only missing files)
    --lookback DAYS     Days back from today (default: 1460/4 years)
"""

import sys
from datetime import datetime, timezone

from src.ingestion.collectors.dukascopy_collector import DukascopyCollector
from src.ingestion.preprocessors.dukascopy_preprocessor import DukascopyPreprocessor
from src.shared.config import Config


def main():
    """Collect Bronze and preprocess to Silver."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Collect Dukascopy data and preprocess to Silver layer"
    )
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Re-download all dates (default: only missing files)",
    )
    parser.add_argument(
        "--lookback",
        type=int,
        default=1460,  # ~4 years
        help="Days back from today (default: 1460)",
    )
    args = parser.parse_args()

    # Current moment in UTC
    now = datetime.now(timezone.utc)
    end_date = now

    # Calculate start date
    from datetime import timedelta

    start_date = end_date - timedelta(days=args.lookback)

    print(f"\n{'='*70}")
    print("FX-AlphaLab: Dukascopy Collection & Preprocessing Pipeline")
    print(f"{'='*70}")
    print(f"Current Time (UTC): {now.isoformat()}")
    print(f"Collection Range:   {start_date.date()} → {end_date.date()}")
    print(f"Backfill Mode:      {args.backfill}")
    print(f"{'='*70}\n")

    # ── Step 1: Collect Bronze data ────────────────────────────────────────
    print("📥 STEP 1: Collecting Bronze data from Dukascopy...\n")

    collector = DukascopyCollector()

    # Health check
    if not collector.health_check():
        print("❌ ERROR: Dukascopy feed is unreachable. Exiting.")
        return 1

    print("✓ Dukascopy feed is reachable\n")

    # Collect
    try:
        results = collector.collect(
            start_date=start_date,
            end_date=end_date,
            backfill=args.backfill,
        )
        print("\n✓ Bronze collection complete:")
        for instrument, rows in results.items():
            status = "✓" if rows > 0 else "⊘"
            print(f"  {status} {instrument}: {rows:,} rows")
    except Exception as e:
        print(f"\n❌ Collection failed: {e}")
        return 1

    # ── Step 2: Preprocess to Silver data ──────────────────────────────────
    print(f"\n{'─'*70}")
    print("⚙️  STEP 2: Preprocessing to Silver layer...\n")

    preprocessor = DukascopyPreprocessor()

    try:
        pp_results = preprocessor.preprocess(
            end_date=end_date,
            backfill=args.backfill,
        )
        print("\n✓ Preprocessing complete:")
        for key, df in pp_results.items():
            last_ts = str(df.index[-1]) if len(df) > 0 else "N/A"
            print(f"  {key:20} {len(df):>8,} rows  |  Last: {last_ts}")
    except Exception as e:
        print(f"\n❌ Preprocessing failed: {e}")
        return 1

    # ── Summary ────────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print("✓ Dukascopy collection and preprocessing complete!")
    print(f"{'='*70}\n")
    print(f"Bronze layer:  {Config.DATA_DIR / 'raw' / 'dukascopy'}")
    print(f"Silver layer:  {Config.DATA_DIR / 'processed' / 'ohlcv'}")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())

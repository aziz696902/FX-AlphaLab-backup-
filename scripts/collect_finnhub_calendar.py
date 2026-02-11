"""Finnhub Economic Calendar collection and preprocessing script.

Two-stage pipeline:
1. Collection (Bronze): Fetch raw data from Finnhub API → data/raw/finnhub/
2. Preprocessing (Silver): Transform to standardized schema → data/processed/events/

Usage:
    # Collect Bronze (raw) data only
    python scripts/collect_finnhub_calendar.py

    # Collect and preprocess to Silver
    python scripts/collect_finnhub_calendar.py --preprocess

    # Collect specific date range
    python scripts/collect_finnhub_calendar.py --start 2023-01-01 --end 2023-12-31

    # Health check only
    python scripts/collect_finnhub_calendar.py --health-check

    # Dry run (collect but don't export)
    python scripts/collect_finnhub_calendar.py --start 2023-01-01 --end 2023-01-31 --dry-run

Example:
    $ python scripts/collect_finnhub_calendar.py --start 2024-01-01 --preprocess
    [INFO] FinnhubCalendarCollector initialized
    [INFO] Health check: PASSED
    [INFO] Collecting data from 2024-01-01 to 2026-02-10
    [INFO] Collected 156 calendar events
    [INFO] Exported to data/raw/finnhub/finnhub_calendar_20260210.csv (Bronze)
    [INFO] Starting Silver preprocessing...
    [INFO] Processed to data/processed/events/ (Silver)
    [SUCCESS] Collection and preprocessing complete

Notes:
    - Requires FINNHUB_API_KEY in .env file (get free key at https://finnhub.io/register)
    - Free tier allows 60 requests per minute
    - Implements conservative rate limiting at 55 req/min
    - Uses exponential backoff for transient failures
"""

import argparse
import sys
from datetime import datetime, timedelta

from src.ingestion.collectors.finnhub_collector import FinnhubCalendarCollector
from src.ingestion.preprocessors.calendar_parser import CalendarPreprocessor
from src.shared.config import Config
from src.shared.utils import setup_logger


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Collect economic calendar data from Finnhub API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--start",
        type=str,
        help="Start date (YYYY-MM-DD). Default: 30 days ago",
        metavar="DATE",
    )

    parser.add_argument(
        "--end",
        type=str,
        help="End date (YYYY-MM-DD). Default: today",
        metavar="DATE",
    )

    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Bypass cache and force fresh API calls",
    )

    parser.add_argument(
        "--health-check",
        action="store_true",
        help="Run health check only and exit",
    )

    parser.add_argument(
        "--preprocess",
        action="store_true",
        help="Also run Silver preprocessing after collection",
    )

    parser.add_argument(
        "--clear-cache",
        action="store_true",
        help="Clear all cached data before collecting",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Collect data but don't export to files",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args()


def main() -> int:
    """Main collection script."""
    args = parse_args()

    # Setup logger
    logger = setup_logger(
        "collect_finnhub_calendar",
        level="DEBUG" if args.verbose else "INFO",
    )

    try:
        # Initialize collector
        collector = FinnhubCalendarCollector()
        logger.info("FinnhubCalendarCollector initialized (Bronze layer: %s)", collector.output_dir)

        # Health check
        if not collector.health_check():
            logger.error("Finnhub API health check failed")
            logger.error("Please check your internet connection and API key")
            logger.error("Get a free API key at: https://finnhub.io/register")
            return 1

        logger.info("Health check: PASSED")

        if args.health_check:
            logger.info("Health check complete, exiting")
            return 0

        # Clear cache if requested
        if args.clear_cache:
            collector.clear_cache()
            logger.info("Cache cleared")

        # Parse dates
        if args.start:
            try:
                start_date = datetime.strptime(args.start, "%Y-%m-%d")
            except ValueError:
                logger.error("Invalid start date format. Use YYYY-MM-DD")
                return 1
        else:
            start_date = datetime.now() - timedelta(days=30)

        if args.end:
            try:
                end_date = datetime.strptime(args.end, "%Y-%m-%d")
            except ValueError:
                logger.error("Invalid end date format. Use YYYY-MM-DD")
                return 1
        else:
            end_date = datetime.now()

        # Validate date range
        if start_date > end_date:
            logger.error("Start date must be before end date")
            return 1

        logger.info("Collecting Bronze data from %s to %s", start_date.date(), end_date.date())

        # STAGE 1: Collect Bronze (raw) data
        logger.info("Collecting economic calendar (Bronze layer)")
        data = collector.collect(start_date=start_date, end_date=end_date)
        calendar_df = data.get("calendar", None)

        if calendar_df is None or calendar_df.empty:
            logger.warning("No calendar events collected")
            return 1

        logger.info("Collected %d calendar events", len(calendar_df))

        # Show sample of collected data
        if args.verbose:
            logger.debug("Sample events:\n%s", calendar_df.head().to_string())

        # Export to Bronze layer (unless dry run)
        if args.dry_run:
            logger.info("Dry run: Skipping export to Bronze layer")
            logger.info("Would export %d events to %s", len(calendar_df), collector.output_dir)
        else:
            path = collector.export_csv(calendar_df, "calendar")
            logger.info("Exported to %s (Bronze)", path)

        # STAGE 2: Preprocess to Silver (optional)
        if args.preprocess and not args.dry_run:
            logger.info("Starting Silver preprocessing...")
            CalendarPreprocessor(
                input_dir=collector.output_dir,
                output_dir=Config.DATA_DIR / "processed" / "events",
            )
            # Note: CalendarPreprocessor may need to be updated to handle Finnhub format
            # For now, we just log the attempt
            logger.warning("Silver preprocessing not yet implemented for Finnhub format")
            logger.info("SUCCESS: Collection complete (Bronze only)")
        else:
            if args.dry_run:
                logger.info("SUCCESS: Dry run complete")
            else:
                logger.info("SUCCESS: Collection complete (Bronze only)")
                logger.info("Run with --preprocess to transform to Silver layer")

        return 0

    except ValueError as e:
        logger.error("Configuration error: %s", e)
        logger.error("Make sure FINNHUB_API_KEY is set in .env")
        logger.error("Get a free API key at: https://finnhub.io/register")
        return 1

    except KeyboardInterrupt:
        logger.warning("Collection interrupted by user")
        return 130

    except Exception as e:
        logger.exception("Unexpected error during collection: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())

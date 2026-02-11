"""Data collectors for various sources."""

from src.ingestion.collectors.base_collector import BaseCollector
from src.ingestion.collectors.calendar_collector import EconomicCalendarCollector
from src.ingestion.collectors.ecb_collector import ECBCollector
from src.ingestion.collectors.finnhub_collector import FinnhubCalendarCollector
from src.ingestion.collectors.fred_collector import FREDCollector
from src.ingestion.collectors.mt5_collector import MT5Collector

__all__ = [
    "BaseCollector",
    "EconomicCalendarCollector",
    "ECBCollector",
    "FinnhubCalendarCollector",
    "FREDCollector",
    "MT5Collector",
]

"""Finnhub Economic Calendar Collector - Bronze Layer (Raw Data Collection).

Collects economic calendar events from Finnhub API:
    - Central bank announcements
    - Economic indicators (GDP, CPI, employment, etc.)
    - All events with impact levels (low, medium, high)

This collector handles ONLY the Bronze layer (§3.1):
- Fetches raw data from Finnhub API
- Preserves all source fields (time, event, country, impact, actual, estimate, prev, unit)
- Adds `source="finnhub"` column
- Exports to data/raw/finnhub/

For Silver layer transformation (UTC timestamps, schema normalization),
use CalendarParser preprocessor.

Implements rate limiting (60 req/min free tier, implemented at 55 req/min)
and comprehensive error handling with exponential backoff.

API Documentation: https://finnhub.io/docs/api/economic-calendar
Get API Key: https://finnhub.io/register
Free Tier: 60 API calls per minute

Example:
    >>> from pathlib import Path
    >>> from datetime import datetime
    >>> from src.ingestion.collectors.finnhub_collector import FinnhubCalendarCollector
    >>>
    >>> collector = FinnhubCalendarCollector()
    >>> # Collect raw data
    >>> data = collector.collect(start_date=datetime(2023, 1, 1), end_date=datetime(2023, 12, 31))
    >>> # Export to Bronze layer
    >>> for dataset_name, df in data.items():
    >>>     collector.export_csv(df, dataset_name)
"""

import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import requests

from src.ingestion.collectors.base_collector import BaseCollector
from src.shared.config import Config


class FinnhubCalendarCollector(BaseCollector):
    """Collector for Finnhub Economic Calendar events - Bronze Layer (Raw Data).

    Uses the Finnhub REST API to fetch economic calendar events.
    Raw data stored in data/raw/finnhub/ following §3.1 Bronze contract.

    Features:
        - Automatic rate limiting (55 req/min conservative)
        - Exponential backoff for transient failures
        - Local JSON caching to avoid redundant API calls
        - Comprehensive error handling and logging
        - Preserves all Finnhub response fields

    Rate Limits:
        Finnhub free tier allows 60 requests per minute. This collector
        implements conservative throttling at 55 req/min with automatic
        retry logic on rate limit errors.

    API Response Schema:
        - time: Event time (Unix timestamp or ISO format)
        - event: Event name/description
        - country: Country code (e.g., "US", "EU", "JP")
        - impact: Impact level (e.g., "High", "Medium", "Low")
        - actual: Actual value
        - estimate: Forecast/estimated value
        - prev: Previous value
        - unit: Unit of measurement

    Note:
        This collector handles ONLY Bronze layer (raw collection).
        For Silver layer (UTC timestamps, schema normalization), use CalendarParser.

    References:
        - API Docs: https://finnhub.io/docs/api/economic-calendar
        - Free API Key: https://finnhub.io/register
    """

    SOURCE_NAME = "finnhub"

    # Rate limiting: 55 req/min = ~1.09 seconds between requests (conservative)
    MIN_REQUEST_INTERVAL = 60.0 / 55.0  # ~1.09 seconds
    CACHE_EXPIRY_DAYS = 1  # cache data for 1 day

    # API endpoint
    BASE_URL = "https://finnhub.io/api/v1/calendar/economic"

    def __init__(
        self,
        api_key: str | None = None,
        output_dir: Path | None = None,
        cache_dir: Path | None = None,
        log_file: Path | None = None,
    ) -> None:
        """Initialize the Finnhub calendar collector.

        Args:
            api_key: Finnhub API key (defaults to Config.FINNHUB_API_KEY).
            output_dir: Directory for Bronze CSV exports (defaults to data/raw/finnhub).
            cache_dir: Directory for JSON cache (defaults to data/cache/finnhub).
            log_file: Optional path for file-based logging.

        Raises:
            ValueError: If api_key is not provided and not in Config.
        """
        super().__init__(
            output_dir=output_dir or Config.DATA_DIR / "raw" / "finnhub",
            log_file=log_file or Config.LOGS_DIR / "collectors" / "finnhub_collector.log",
        )

        self._api_key = api_key or Config.FINNHUB_API_KEY
        if not self._api_key or self._api_key == "your_finnhub_api_key_here":
            raise ValueError(
                "Finnhub API key is required. Set FINNHUB_API_KEY in .env or pass api_key parameter. "
                "Get a free key at https://finnhub.io/register"
            )

        self._cache_dir = cache_dir or Config.DATA_DIR / "cache" / "finnhub"
        self._cache_dir.mkdir(parents=True, exist_ok=True)

        self._last_request_time: float = 0.0
        self._session = requests.Session()

        self.logger.info(
            "FinnhubCalendarCollector initialized, output_dir=%s, cache_dir=%s",
            self.output_dir,
            self._cache_dir,
        )

    # ------------------------------------------------------------------
    # BaseCollector interface
    # ------------------------------------------------------------------

    def collect(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        use_cache: bool = True,
    ) -> dict[str, pd.DataFrame]:
        """Collect economic calendar events from Finnhub (Bronze - raw data).

        Fetches economic calendar events for the specified date range.
        Returns data in Bronze format preserving all Finnhub fields.

        Args:
            start_date: Start of the collection window (default: 30 days ago).
            end_date: End of the collection window (default: today).
            use_cache: If True, check cache before making API call.

        Returns:
            Dictionary with single entry "calendar" containing DataFrame with columns:
            [time, event, country, impact, actual, estimate, prev, unit, source]

        Raises:
            ValueError: If start_date is after end_date.
            requests.RequestException: If API request fails after retries.

        Example:
            >>> collector = FinnhubCalendarCollector()
            >>> data = collector.collect(start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31))
            >>> calendar_df = data["calendar"]
            >>> print(calendar_df.columns)
            Index(['time', 'event', 'country', 'impact', 'actual', 'estimate', 'prev',
                   'unit', 'source'])
        """
        start = start_date or datetime.now() - timedelta(days=30)
        end = end_date or datetime.now()

        if start > end:
            raise ValueError(f"start_date ({start.date()}) must be before end_date ({end.date()})")

        self.logger.info("Collecting Finnhub calendar from %s to %s", start.date(), end.date())

        # Check cache first (if enabled)
        if use_cache:
            cached_df = self._load_from_cache(start, end)
            if cached_df is not None:
                self.logger.info("Loaded calendar data from cache: %d events", len(cached_df))
                return {"calendar": cached_df}

        # Fetch from API with retry logic
        df = self._fetch_calendar(start, end)

        if df.empty:
            self.logger.warning("No calendar events returned from Finnhub")
            return {"calendar": df}

        # Cache the result (if enabled)
        if use_cache:
            self._save_to_cache(df, start, end)

        self.logger.info("Collected %d calendar events", len(df))
        return {"calendar": df}

    def health_check(self) -> bool:
        """Verify Finnhub API is reachable.

        Makes a minimal API call to verify connectivity and authentication.

        Returns:
            True if API responds successfully, False otherwise.

        Example:
            >>> collector = FinnhubCalendarCollector()
            >>> if collector.health_check():
            ...     print("Finnhub API is available")
        """
        try:
            # Make a minimal request (1 day range) to verify connectivity
            today = datetime.now()
            yesterday = today - timedelta(days=1)

            params = {
                "from": yesterday.strftime("%Y-%m-%d"),
                "to": today.strftime("%Y-%m-%d"),
                "token": self._api_key,
            }

            self._throttle_request()
            response = self._session.get(self.BASE_URL, params=params, timeout=30)

            # Check if response is valid (200 OK and JSON parseable)
            if response.status_code == 200:
                _ = response.json()  # Verify JSON is parseable
                return True
            elif response.status_code == 401:
                self.logger.error("Finnhub health check failed: Invalid API key (401)")
                return False
            elif response.status_code == 429:
                self.logger.error("Finnhub health check failed: Rate limit exceeded (429)")
                return False
            else:
                self.logger.error("Finnhub health check failed: HTTP %s", response.status_code)
                return False

        except requests.RequestException as e:
            self.logger.error("Finnhub health check failed: %s", e)
            return False
        except Exception as e:
            self.logger.error("Finnhub health check failed unexpectedly: %s", e)
            return False

    # ------------------------------------------------------------------
    # Export methods
    # ------------------------------------------------------------------

    def export_to_csv(
        self,
        data: pd.DataFrame | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> Path:
        """Collect and export calendar data to Bronze CSV (convenience method).

        This is a convenience method that combines collection and export.
        If data is provided, it exports directly. Otherwise, it collects first.

        Args:
            data: Pre-collected DataFrame (if None, will collect).
            start_date: Start date for collection if data is None.
            end_date: End date for collection if data is None.

        Returns:
            Path to the exported file.

        Raises:
            ValueError: If data is None and collection fails.

        Example:
            >>> collector = FinnhubCalendarCollector()
            >>> path = collector.export_to_csv(start_date=datetime(2023, 1, 1))
            >>> print(path)
            .../data/raw/finnhub/finnhub_calendar_20260210.csv
        """
        if data is None:
            start = start_date or datetime.now() - timedelta(days=30)
            end = end_date or datetime.now()
            collected = self.collect(start_date=start, end_date=end)
            data = collected.get("calendar", pd.DataFrame())

        return self.export_csv(data, "calendar")

    # ------------------------------------------------------------------
    # Internal methods
    # ------------------------------------------------------------------

    def _fetch_calendar(
        self,
        start_date: datetime,
        end_date: datetime,
        max_retries: int = 3,
    ) -> pd.DataFrame:
        """Fetch calendar data from Finnhub API with retry logic.

        Args:
            start_date: Start date for data retrieval.
            end_date: End date for data retrieval.
            max_retries: Maximum number of retry attempts for transient failures.

        Returns:
            DataFrame with raw Finnhub calendar data.

        Raises:
            requests.RequestException: If API request fails after retries.
            ValueError: If API returns invalid data format.
        """
        params = {
            "from": start_date.strftime("%Y-%m-%d"),
            "to": end_date.strftime("%Y-%m-%d"),
            "token": self._api_key,
        }

        for attempt in range(max_retries):
            try:
                self._throttle_request()

                self.logger.debug(
                    "Fetching calendar: %s to %s (attempt %d/%d)",
                    start_date.date(),
                    end_date.date(),
                    attempt + 1,
                    max_retries,
                )

                response = self._session.get(
                    self.BASE_URL,
                    params=params,
                    timeout=Config.REQUEST_TIMEOUT,
                )

                # Handle rate limiting
                if response.status_code == 429:
                    wait_time = 2**attempt  # Exponential backoff
                    self.logger.warning(
                        "Rate limit hit (429), waiting %d seconds before retry...", wait_time
                    )
                    time.sleep(wait_time)
                    continue

                # Handle authentication errors
                if response.status_code == 401:
                    self.logger.error("Authentication failed (401): Invalid API key")
                    raise ValueError("Invalid Finnhub API key. Check FINNHUB_API_KEY in .env")

                # Handle server errors - retry
                if response.status_code >= 500:
                    self.logger.warning(
                        "Server error (attempt %d/%d): HTTP %d",
                        attempt + 1,
                        max_retries,
                        response.status_code,
                    )
                    if attempt < max_retries - 1:
                        wait_time = 2**attempt
                        time.sleep(wait_time)
                        continue
                    else:
                        raise requests.HTTPError(
                            f"Server error after {max_retries} retries: HTTP {response.status_code}"
                        )

                # Handle other HTTP errors
                response.raise_for_status()

                # Parse response
                data = response.json()

                # Finnhub returns a dict with "economicCalendar" key containing list of events
                if isinstance(data, dict) and "economicCalendar" in data:
                    events = data["economicCalendar"]
                elif isinstance(data, list):
                    events = data
                else:
                    self.logger.warning("Unexpected API response format: %s", type(data))
                    return pd.DataFrame()

                if not events:
                    return pd.DataFrame()

                # Convert to DataFrame preserving all Finnhub fields
                df = pd.DataFrame(events)

                # Ensure all expected columns exist (fill missing with None)
                expected_columns = [
                    "time",
                    "event",
                    "country",
                    "impact",
                    "actual",
                    "estimate",
                    "prev",
                    "unit",
                ]
                for col in expected_columns:
                    if col not in df.columns:
                        df[col] = None

                # Add source column (Bronze layer requirement)
                df["source"] = self.SOURCE_NAME

                # Reorder columns for consistency
                df = df[expected_columns + ["source"]]

                return df

            except requests.exceptions.Timeout:
                self.logger.warning("Request timeout (attempt %d/%d)", attempt + 1, max_retries)
                if attempt < max_retries - 1:
                    wait_time = 2**attempt
                    time.sleep(wait_time)
                else:
                    raise

            except requests.exceptions.ConnectionError as e:
                self.logger.warning(
                    "Connection error (attempt %d/%d): %s", attempt + 1, max_retries, e
                )
                if attempt < max_retries - 1:
                    wait_time = 2**attempt
                    time.sleep(wait_time)
                else:
                    raise

            except requests.HTTPError:
                # Re-raise other HTTP errors
                raise

        # If we exhausted retries
        raise requests.RequestException(f"Failed to fetch calendar after {max_retries} attempts")

    def _throttle_request(self) -> None:
        """Ensure minimum interval between API requests to respect rate limits.

        Implements conservative throttling at 55 req/min (below 60 req/min free tier).
        """
        elapsed = time.time() - self._last_request_time
        if elapsed < self.MIN_REQUEST_INTERVAL:
            sleep_time = self.MIN_REQUEST_INTERVAL - elapsed
            self.logger.debug("Throttling request: sleeping %.2f seconds", sleep_time)
            time.sleep(sleep_time)
        self._last_request_time = time.time()

    # ------------------------------------------------------------------
    # Caching
    # ------------------------------------------------------------------

    def _get_cache_path(self, start_date: datetime, end_date: datetime) -> Path:
        """Generate cache file path for a date range.

        Args:
            start_date: Start date of cached data.
            end_date: End date of cached data.

        Returns:
            Path to cache file.
        """
        date_range = f"{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"
        return self._cache_dir / f"calendar_{date_range}.json"

    def _load_from_cache(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> pd.DataFrame | None:
        """Load calendar data from cache if valid.

        Args:
            start_date: Requested start date.
            end_date: Requested end date.

        Returns:
            Cached DataFrame if valid and covers requested range, None otherwise.
        """
        cache_path = self._get_cache_path(start_date, end_date)

        if not cache_path.exists():
            return None

        try:
            # Check cache age
            cache_age = datetime.now().timestamp() - cache_path.stat().st_mtime
            if cache_age > (self.CACHE_EXPIRY_DAYS * 86400):
                self.logger.debug("Cache expired: %s", cache_path.name)
                return None

            # Load cache
            with open(cache_path, encoding="utf-8") as f:
                cache_data = json.load(f)

            # Verify cache covers requested date range
            cache_start = datetime.fromisoformat(cache_data["start_date"])
            cache_end = datetime.fromisoformat(cache_data["end_date"])

            if cache_start <= start_date and cache_end >= end_date:
                df = pd.DataFrame(cache_data["data"])
                self.logger.debug("Loaded from cache: %s (%d records)", cache_path.name, len(df))
                return df

            return None

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            self.logger.warning("Invalid cache file %s: %s", cache_path.name, e)
            return None

    def _save_to_cache(
        self,
        df: pd.DataFrame,
        start_date: datetime,
        end_date: datetime,
    ) -> None:
        """Save calendar data to cache.

        Args:
            df: DataFrame to cache.
            start_date: Start date of cached data.
            end_date: End date of cached data.
        """
        cache_path = self._get_cache_path(start_date, end_date)

        try:
            cache_data = {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "cached_at": datetime.now().isoformat(),
                "data": df.to_dict(orient="records"),
            }

            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(cache_data, f, indent=2)

            self.logger.debug("Cached calendar data: %s (%d records)", cache_path.name, len(df))

        except Exception as e:
            self.logger.warning("Failed to cache calendar data: %s", e)

    def clear_cache(self) -> None:
        """Clear all cached calendar data.

        Example:
            >>> collector = FinnhubCalendarCollector()
            >>> collector.clear_cache()
        """
        cache_files = list(self._cache_dir.glob("calendar_*.json"))
        for cache_file in cache_files:
            cache_file.unlink()
        self.logger.info("Cleared %d cache files", len(cache_files))

    # ------------------------------------------------------------------
    # Utility methods
    # ------------------------------------------------------------------

    def get_rate_limit_status(self) -> dict[str, Any]:
        """Get current rate limiting status.

        Returns:
            Dictionary with rate limit information:
            - min_interval: Minimum seconds between requests
            - last_request: Timestamp of last request
            - time_since_last: Seconds since last request

        Example:
            >>> collector = FinnhubCalendarCollector()
            >>> status = collector.get_rate_limit_status()
            >>> print(status["min_interval"])
            1.0909090909090908
        """
        return {
            "min_interval": self.MIN_REQUEST_INTERVAL,
            "last_request": self._last_request_time,
            "time_since_last": time.time() - self._last_request_time,
        }

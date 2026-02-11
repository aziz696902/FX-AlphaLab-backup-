"""Unit tests for Finnhub Economic Calendar Collector.

Tests cover:
    - Initialization with/without API key
    - Health check (success/failure)
    - Data collection with mocked API responses
    - Rate limiting behavior
    - Caching functionality
    - Error handling and retry logic
    - CSV export functionality
    - Date validation
"""

from datetime import datetime
from unittest.mock import Mock, patch

import pandas as pd
import pytest
import requests

from src.ingestion.collectors.finnhub_collector import FinnhubCalendarCollector

# ---------------------------------------------------------------------------
# Sample Data
# ---------------------------------------------------------------------------


def make_sample_calendar_events(
    start_date: datetime, end_date: datetime, count: int = 10
) -> list[dict]:
    """Create sample Finnhub calendar events."""
    events = []
    date_range = pd.date_range(start=start_date, end=end_date, periods=count)

    sample_events = [
        {
            "time": "2023-01-05 08:30:00",
            "event": "Non-Farm Payrolls",
            "country": "US",
            "impact": "High",
            "actual": "223K",
            "estimate": "200K",
            "prev": "256K",
            "unit": "K",
        },
        {
            "time": "2023-01-05 08:30:00",
            "event": "Unemployment Rate",
            "country": "US",
            "impact": "High",
            "actual": "3.5%",
            "estimate": "3.7%",
            "prev": "3.5%",
            "unit": "%",
        },
        {
            "time": "2023-01-06 08:30:00",
            "event": "Average Hourly Earnings",
            "country": "US",
            "impact": "Medium",
            "actual": "0.3%",
            "estimate": "0.4%",
            "prev": "0.4%",
            "unit": "%",
        },
        {
            "time": "2023-01-12 08:30:00",
            "event": "CPI m/m",
            "country": "US",
            "impact": "High",
            "actual": "0.1%",
            "estimate": "0.0%",
            "prev": "0.1%",
            "unit": "%",
        },
        {
            "time": "2023-01-12 08:30:00",
            "event": "Core CPI m/m",
            "country": "US",
            "impact": "High",
            "actual": "0.3%",
            "estimate": "0.3%",
            "prev": "0.2%",
            "unit": "%",
        },
    ]

    for i in range(count):
        event = sample_events[i % len(sample_events)].copy()
        event["time"] = date_range[i].strftime("%Y-%m-%d %H:%M:%S")
        events.append(event)

    return events


SAMPLE_API_RESPONSE = {
    "economicCalendar": [
        {
            "time": "2023-01-05 08:30:00",
            "event": "Non-Farm Payrolls",
            "country": "US",
            "impact": "High",
            "actual": "223K",
            "estimate": "200K",
            "prev": "256K",
            "unit": "K",
        },
        {
            "time": "2023-01-05 08:30:00",
            "event": "Unemployment Rate",
            "country": "US",
            "impact": "High",
            "actual": "3.5%",
            "estimate": "3.7%",
            "prev": "3.5%",
            "unit": "%",
        },
    ]
}


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------


class TestFinnhubCollectorInit:
    """Test FinnhubCalendarCollector initialization."""

    def test_init_with_api_key(self, tmp_path):
        """Test initialization with explicit API key."""
        collector = FinnhubCalendarCollector(api_key="test_key_12345", output_dir=tmp_path)
        assert collector._api_key == "test_key_12345"
        assert collector.output_dir == tmp_path
        assert collector._cache_dir.exists()

    def test_init_without_api_key_raises(self, tmp_path, monkeypatch):
        """Test that initialization fails without API key."""
        monkeypatch.setattr("src.shared.config.Config.FINNHUB_API_KEY", None)
        with pytest.raises(ValueError, match="Finnhub API key is required"):
            FinnhubCalendarCollector(output_dir=tmp_path)

    def test_init_with_placeholder_api_key_raises(self, tmp_path, monkeypatch):
        """Test that placeholder API key is rejected."""
        monkeypatch.setattr("src.shared.config.Config.FINNHUB_API_KEY", "your_finnhub_api_key_here")
        with pytest.raises(ValueError, match="Finnhub API key is required"):
            FinnhubCalendarCollector(output_dir=tmp_path)

    def test_default_output_dir(self, tmp_path, monkeypatch):
        """Test default output directory is data/raw/finnhub."""
        monkeypatch.setattr("src.shared.config.Config.DATA_DIR", tmp_path)
        monkeypatch.setattr("src.shared.config.Config.FINNHUB_API_KEY", "test_key")
        collector = FinnhubCalendarCollector()
        # Bronze layer: data/raw/finnhub
        assert collector.output_dir == tmp_path / "raw" / "finnhub"
        assert collector._cache_dir == tmp_path / "cache" / "finnhub"

    def test_custom_cache_dir(self, tmp_path):
        """Test custom cache directory."""
        cache_dir = tmp_path / "custom_cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )
        assert collector._cache_dir == cache_dir
        assert cache_dir.exists()

    def test_source_name(self, tmp_path):
        """Test SOURCE_NAME class attribute."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)
        assert collector.SOURCE_NAME == "finnhub"


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------


class TestHealthCheck:
    """Test health_check method."""

    def test_health_check_success(self, tmp_path):
        """Test successful health check."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"economicCalendar": []}

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response):
            assert collector.health_check() is True

    def test_health_check_failure_401(self, tmp_path):
        """Test health check with invalid API key."""
        mock_response = Mock()
        mock_response.status_code = 401

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response):
            assert collector.health_check() is False

    def test_health_check_failure_429(self, tmp_path):
        """Test health check with rate limit error."""
        mock_response = Mock()
        mock_response.status_code = 429

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response):
            assert collector.health_check() is False

    def test_health_check_network_error(self, tmp_path):
        """Test health check with network error."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(
            collector._session, "get", side_effect=requests.RequestException("Network error")
        ):
            assert collector.health_check() is False


# ---------------------------------------------------------------------------
# Data Collection
# ---------------------------------------------------------------------------


class TestCollect:
    """Test collect method."""

    def test_collect_success(self, tmp_path):
        """Test successful data collection."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response):
            start = datetime(2023, 1, 1)
            end = datetime(2023, 1, 31)
            data = collector.collect(start_date=start, end_date=end)

        assert "calendar" in data
        df = data["calendar"]
        assert not df.empty
        assert len(df) == 2

        # Verify Bronze schema
        expected_columns = [
            "time",
            "event",
            "country",
            "impact",
            "actual",
            "estimate",
            "prev",
            "unit",
            "source",
        ]
        assert list(df.columns) == expected_columns

        # Verify source column
        assert all(df["source"] == "finnhub")

        # Verify data preservation
        assert df["event"].iloc[0] == "Non-Farm Payrolls"
        assert df["country"].iloc[0] == "US"
        assert df["impact"].iloc[0] == "High"

    def test_collect_empty_response(self, tmp_path):
        """Test collection with empty API response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"economicCalendar": []}
        mock_response.raise_for_status = Mock()

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        with patch.object(collector._session, "get", return_value=mock_response):
            start = datetime(2023, 1, 1)
            end = datetime(2023, 1, 31)
            data = collector.collect(start_date=start, end_date=end, use_cache=False)

        assert "calendar" in data
        assert data["calendar"].empty

    def test_collect_list_response(self, tmp_path):
        """Test collection when API returns list instead of dict."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE["economicCalendar"]
        mock_response.raise_for_status = Mock()

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response):
            start = datetime(2023, 1, 1)
            end = datetime(2023, 1, 31)
            data = collector.collect(start_date=start, end_date=end)

        assert "calendar" in data
        df = data["calendar"]
        assert len(df) == 2

    def test_collect_default_dates(self, tmp_path):
        """Test collection with default date range (30 days)."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response) as mock_get:
            data = collector.collect()

            # Verify API was called
            assert mock_get.called
            call_args = mock_get.call_args
            assert "params" in call_args.kwargs
            params = call_args.kwargs["params"]
            assert "from" in params
            assert "to" in params

        assert "calendar" in data

    def test_collect_preserves_all_fields(self, tmp_path):
        """Test that all Finnhub fields are preserved in Bronze layer."""
        # Event with all possible fields
        full_event = {
            "time": "2023-01-15 14:00:00",
            "event": "FOMC Statement",
            "country": "US",
            "impact": "High",
            "actual": "5.25%",
            "estimate": "5.25%",
            "prev": "5.00%",
            "unit": "%",
        }

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"economicCalendar": [full_event]}
        mock_response.raise_for_status = Mock()

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        with patch.object(collector._session, "get", return_value=mock_response):
            data = collector.collect(
                start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31), use_cache=False
            )

        df = data["calendar"]
        assert len(df) == 1
        row = df.iloc[0]

        # Verify all fields preserved
        assert row["time"] == "2023-01-15 14:00:00"
        assert row["event"] == "FOMC Statement"
        assert row["country"] == "US"
        assert row["impact"] == "High"
        assert row["actual"] == "5.25%"
        assert row["estimate"] == "5.25%"
        assert row["prev"] == "5.00%"
        assert row["unit"] == "%"
        assert row["source"] == "finnhub"


# ---------------------------------------------------------------------------
# Error Handling & Retry Logic
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Test error handling and retry logic."""

    def test_retry_on_429_rate_limit(self, tmp_path):
        """Test retry on rate limit error (429)."""
        # First call fails with 429, second succeeds
        mock_response_429 = Mock()
        mock_response_429.status_code = 429

        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = SAMPLE_API_RESPONSE
        mock_response_200.raise_for_status = Mock()

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        with patch.object(
            collector._session, "get", side_effect=[mock_response_429, mock_response_200]
        ):
            with patch("time.sleep") as mock_sleep:  # Speed up test
                data = collector.collect(
                    start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31), use_cache=False
                )

                # Should have slept (exponential backoff)
                assert mock_sleep.called

        assert "calendar" in data
        assert len(data["calendar"]) == 2

    def test_retry_on_timeout(self, tmp_path):
        """Test retry on request timeout."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        # First call times out, second succeeds
        with patch.object(
            collector._session,
            "get",
            side_effect=[requests.exceptions.Timeout("Connection timeout"), mock_response],
        ):
            with patch("time.sleep"):  # Speed up test
                data = collector.collect(
                    start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31)
                )

        assert "calendar" in data
        assert len(data["calendar"]) == 2

    def test_retry_on_connection_error(self, tmp_path):
        """Test retry on connection error."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        # First call fails with connection error, second succeeds
        with patch.object(
            collector._session,
            "get",
            side_effect=[requests.exceptions.ConnectionError("Connection refused"), mock_response],
        ):
            with patch("time.sleep"):  # Speed up test
                data = collector.collect(
                    start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31)
                )

        assert "calendar" in data
        assert len(data["calendar"]) == 2

    def test_fail_on_401_auth_error(self, tmp_path):
        """Test that 401 errors are not retried (invalid API key)."""
        mock_response = Mock()
        mock_response.status_code = 401

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        with patch.object(collector._session, "get", return_value=mock_response):
            with pytest.raises(ValueError, match="Invalid Finnhub API key"):
                collector.collect(
                    start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31), use_cache=False
                )

    def test_exhaust_retries(self, tmp_path):
        """Test that exhausted retries raise exception."""
        mock_response = Mock()
        mock_response.status_code = 500

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        # All calls fail with 500
        with patch.object(collector._session, "get", return_value=mock_response):
            with patch("time.sleep"):  # Speed up test
                with pytest.raises(requests.HTTPError):
                    collector.collect(
                        start_date=datetime(2023, 1, 1),
                        end_date=datetime(2023, 1, 31),
                        use_cache=False,
                    )


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------


class TestCaching:
    """Test caching functionality."""

    def test_cache_saves_and_loads(self, tmp_path):
        """Test that cache saves and loads correctly."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        with patch.object(collector._session, "get", return_value=mock_response) as mock_get:
            start = datetime(2023, 1, 1)
            end = datetime(2023, 1, 31)

            # First call - should hit API
            data1 = collector.collect(start_date=start, end_date=end)
            assert mock_get.call_count == 1

            # Verify cache file exists
            cache_files = list(cache_dir.glob("calendar_*.json"))
            assert len(cache_files) == 1

            # Second call - should use cache
            data2 = collector.collect(start_date=start, end_date=end)
            assert mock_get.call_count == 1  # No additional API call

        # DataFrames should be equivalent
        pd.testing.assert_frame_equal(data1["calendar"], data2["calendar"])

    def test_clear_cache(self, tmp_path):
        """Test clearing cache."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        # Create cache
        with patch.object(collector._session, "get", return_value=mock_response):
            collector.collect(start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31))

        cache_files = list(cache_dir.glob("calendar_*.json"))
        assert len(cache_files) == 1

        # Clear cache
        collector.clear_cache()

        cache_files = list(cache_dir.glob("calendar_*.json"))
        assert len(cache_files) == 0


# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------


class TestCSVExport:
    """Test CSV export functionality."""

    def test_export_csv(self, tmp_path):
        """Test export_csv method from BaseCollector."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        # Create sample data
        df = pd.DataFrame(
            {
                "time": ["2023-01-01 08:30:00"],
                "event": ["Test Event"],
                "country": ["US"],
                "impact": ["High"],
                "actual": ["5.0%"],
                "estimate": ["4.5%"],
                "prev": ["4.8%"],
                "unit": ["%"],
                "source": ["finnhub"],
            }
        )

        path = collector.export_csv(df, "calendar")

        assert path.exists()
        assert path.suffix == ".csv"
        assert "finnhub_calendar_" in path.name

        # Verify file content
        df_read = pd.read_csv(path)
        assert len(df_read) == 1
        assert df_read["event"].iloc[0] == "Test Event"

    def test_export_csv_empty_raises(self, tmp_path):
        """Test that exporting empty DataFrame raises ValueError."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        empty_df = pd.DataFrame()

        with pytest.raises(ValueError, match="Cannot export empty DataFrame"):
            collector.export_csv(empty_df, "calendar")

    def test_export_to_csv_convenience(self, tmp_path):
        """Test export_to_csv convenience method."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response):
            start = datetime(2023, 1, 1)
            end = datetime(2023, 1, 31)
            path = collector.export_to_csv(start_date=start, end_date=end)

        assert path.exists()
        assert path.suffix == ".csv"
        assert "finnhub_calendar_" in path.name

        # Verify content
        df = pd.read_csv(path)
        assert len(df) == 2

    def test_export_to_csv_with_data(self, tmp_path):
        """Test export_to_csv with pre-collected data."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        df = pd.DataFrame(
            {
                "time": ["2023-01-01 08:30:00"],
                "event": ["Test Event"],
                "country": ["US"],
                "impact": ["High"],
                "actual": ["5.0%"],
                "estimate": ["4.5%"],
                "prev": ["4.8%"],
                "unit": ["%"],
                "source": ["finnhub"],
            }
        )

        path = collector.export_to_csv(data=df)

        assert path.exists()
        df_read = pd.read_csv(path)
        assert len(df_read) == 1


# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------


class TestRateLimiting:
    """Test rate limiting functionality."""

    def test_rate_limit_config(self, tmp_path):
        """Test rate limiting configuration."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        # Should be ~1.09 seconds (60/55)
        assert collector.MIN_REQUEST_INTERVAL == 60.0 / 55.0

    def test_get_rate_limit_status(self, tmp_path):
        """Test rate limit status method."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        status = collector.get_rate_limit_status()

        assert "min_interval" in status
        assert "last_request" in status
        assert "time_since_last" in status
        assert status["min_interval"] == 60.0 / 55.0

    @patch("time.time")
    @patch("time.sleep")
    def test_throttle_respects_rate_limit(self, mock_sleep, mock_time, tmp_path):
        """Test that throttling respects rate limit."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        # Simulate rapid consecutive calls
        mock_time.side_effect = [0.0, 0.5, 1.0, 1.5, 2.0]  # Time values
        collector._last_request_time = 0.0

        # Make requests
        collector._throttle_request()
        collector._throttle_request()

        # Should have slept for the difference between min_interval and elapsed time
        assert mock_sleep.called


# ---------------------------------------------------------------------------
# Date Validation
# ---------------------------------------------------------------------------


class TestDateValidation:
    """Test date range validation."""

    def test_collect_invalid_date_range(self, tmp_path):
        """Test collect() rejects start_date after end_date."""
        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        start = datetime(2023, 12, 31)
        end = datetime(2023, 1, 1)

        with pytest.raises(ValueError, match="must be before"):
            collector.collect(start_date=start, end_date=end)

    def test_collect_same_date(self, tmp_path):
        """Test collect() allows same start and end date."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        collector = FinnhubCalendarCollector(api_key="test_key", output_dir=tmp_path)

        with patch.object(collector._session, "get", return_value=mock_response):
            # Same date should work
            date = datetime(2023, 1, 15)
            data = collector.collect(start_date=date, end_date=date)
            assert "calendar" in data


# ---------------------------------------------------------------------------
# Integration-like tests
# ---------------------------------------------------------------------------


class TestIntegration:
    """Integration-like tests with realistic scenarios."""

    def test_typical_workflow(self, tmp_path):
        """Test a typical collection workflow."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        with patch.object(collector._session, "get", return_value=mock_response):
            # 1. Health check
            assert collector.health_check()

            # 2. Collect data
            start = datetime(2023, 1, 1)
            end = datetime(2023, 1, 31)
            data = collector.collect(start_date=start, end_date=end)

            assert "calendar" in data
            assert not data["calendar"].empty

            # 3. Export to CSV
            path = collector.export_csv(data["calendar"], "calendar")
            assert path.exists()

            # 4. Verify file (Bronze format)
            df = pd.read_csv(path)
            assert not df.empty
            assert "time" in df.columns
            assert "event" in df.columns
            assert "source" in df.columns
            assert all(df["source"] == "finnhub")

    def test_workflow_with_cache(self, tmp_path):
        """Test workflow with caching enabled."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_API_RESPONSE
        mock_response.raise_for_status = Mock()

        cache_dir = tmp_path / "cache"
        collector = FinnhubCalendarCollector(
            api_key="test_key", output_dir=tmp_path, cache_dir=cache_dir
        )

        with patch.object(collector._session, "get", return_value=mock_response) as mock_get:
            # First collection - hits API
            data1 = collector.collect(
                start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31)
            )
            assert mock_get.call_count == 1

            # Export to CSV
            collector.export_csv(data1["calendar"], "calendar")

            # Clear cache and reset
            mock_get.reset_mock()

            # Second collection with cache - should not hit API
            # (But we cleared cache, so it will hit API again)
            # Actually, let's verify cache works
            data2 = collector.collect(
                start_date=datetime(2023, 1, 1), end_date=datetime(2023, 1, 31)
            )
            assert mock_get.call_count == 0  # Uses cache, no API call

            # Data should be the same
            pd.testing.assert_frame_equal(data1["calendar"], data2["calendar"])

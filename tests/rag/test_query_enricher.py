"""Tests for src/rag/query_enricher.py."""

from datetime import date

from src.rag.query_enricher import enrich

TODAY = date(2026, 5, 11)


class TestEnrich:
    def test_no_signals_returns_none(self):
        assert enrich("What is the EURUSD outlook?", today=TODAY) is None

    def test_fed_source_filter(self):
        result = enrich("What did the Fed say about inflation?", today=TODAY)
        assert result == {"source": {"$eq": "fed"}}

    def test_ecb_source_filter(self):
        result = enrich("ECB statement on rates", today=TODAY)
        assert result == {"source": {"$eq": "ecb"}}

    def test_boe_source_filter(self):
        result = enrich("BoE minutes last week", today=TODAY)
        assert result is not None
        where_str = str(result)
        assert "boe" in where_str

    def test_gdelt_source_filter(self):
        result = enrich("GDELT news on geopolitical risk", today=TODAY)
        assert result == {"source": {"$eq": "gdelt"}}

    def test_yesterday_date_filter(self):
        result = enrich("What happened yesterday?", today=TODAY)
        assert result == {"date": {"$gte": "2026-05-10"}}

    def test_last_week_date_filter(self):
        result = enrich("Fed news last week", today=TODAY)
        assert result is not None
        where_str = str(result)
        assert "2026-05-04" in where_str

    def test_recent_date_filter(self):
        result = enrich("Recent market commentary", today=TODAY)
        assert result is not None
        where_str = str(result)
        assert "date" in where_str

    def test_last_n_days_dynamic(self):
        result = enrich("ECB news last 5 days", today=TODAY)
        assert result is not None
        where_str = str(result)
        assert "2026-05-06" in where_str
        assert "ecb" in where_str

    def test_combined_source_and_date_uses_and(self):
        result = enrich("Fed statement yesterday", today=TODAY)
        assert result is not None
        assert "$and" in result

    def test_case_insensitive_source(self):
        result = enrich("FEDERAL RESERVE outlook", today=TODAY)
        assert result == {"source": {"$eq": "fed"}}

    def test_european_central_bank_matches_ecb(self):
        result = enrich("European Central Bank minutes", today=TODAY)
        assert result == {"source": {"$eq": "ecb"}}

    def test_bank_of_england_matches_boe(self):
        result = enrich("Bank of England decision", today=TODAY)
        assert result == {"source": {"$eq": "boe"}}

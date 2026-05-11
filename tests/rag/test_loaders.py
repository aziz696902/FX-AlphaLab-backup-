"""Tests for src/rag/loaders/cb_documents.py and gdelt_gkg.py."""

import json
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from src.rag.loaders.cb_documents import _parse_date, load_cb_documents
from src.rag.loaders.gdelt_gkg import load_gdelt_gkg


class TestParseDateHelper:
    def test_iso_with_z(self):
        assert _parse_date("2026-05-01T10:00:00Z") == date(2026, 5, 1)

    def test_iso_without_z(self):
        assert _parse_date("2026-05-01T10:00:00") == date(2026, 5, 1)

    def test_date_only(self):
        assert _parse_date("2026-05-01") == date(2026, 5, 1)


class TestLoadCbDocuments:
    def _write_jsonl(self, path: Path, docs: list[dict]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            for doc in docs:
                fh.write(json.dumps(doc) + "\n")

    def test_returns_empty_when_no_dir(self, tmp_path):
        result = load_cb_documents(tmp_path, date(2026, 1, 1))
        assert result == []

    def test_loads_recent_docs(self, tmp_path):
        today = date.today()
        doc = {
            "url": "https://fed.gov/doc",
            "title": "Test",
            "content": "Federal reserve statement content.",
            "document_type": "statements",
            "speaker": None,
            "timestamp_published": today.isoformat() + "T12:00:00Z",
        }
        self._write_jsonl(tmp_path / "raw" / "news" / "fed" / "fed_2026.jsonl", [doc])
        result = load_cb_documents(tmp_path, today - timedelta(days=7))
        assert len(result) == 1
        assert result[0]["source"] == "fed"
        assert result[0]["content"] == doc["content"]

    def test_filters_old_docs(self, tmp_path):
        old_doc = {
            "url": "https://fed.gov/old",
            "title": "Old",
            "content": "Old content.",
            "document_type": "statements",
            "speaker": None,
            "timestamp_published": "2020-01-01T00:00:00Z",
        }
        self._write_jsonl(tmp_path / "raw" / "news" / "fed" / "fed_old.jsonl", [old_doc])
        result = load_cb_documents(tmp_path, date(2026, 1, 1))
        assert result == []

    def test_skips_docs_with_no_content(self, tmp_path):
        doc = {
            "url": "https://fed.gov/empty",
            "title": "Empty",
            "content": "",
            "document_type": "statements",
            "speaker": None,
            "timestamp_published": date.today().isoformat() + "T12:00:00Z",
        }
        self._write_jsonl(tmp_path / "raw" / "news" / "fed" / "fed_empty.jsonl", [doc])
        result = load_cb_documents(tmp_path, date.today() - timedelta(days=7))
        assert result == []

    def test_loads_from_multiple_sources(self, tmp_path):
        today = date.today().isoformat() + "T12:00:00Z"
        for source in ("fed", "ecb", "boe"):
            doc = {
                "url": f"https://{source}.gov/doc",
                "title": f"{source} doc",
                "content": f"{source} content here.",
                "document_type": "statements",
                "speaker": None,
                "timestamp_published": today,
            }
            self._write_jsonl(tmp_path / "raw" / "news" / source / f"{source}.jsonl", [doc])
        result = load_cb_documents(tmp_path, date.today() - timedelta(days=7))
        sources = {r["source"] for r in result}
        assert sources == {"fed", "ecb", "boe"}


class TestLoadGdeltGkg:
    def _write_parquet(self, path: Path, df: pd.DataFrame) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(path, index=False)

    def test_returns_empty_when_no_dir(self, tmp_path):
        result = load_gdelt_gkg(tmp_path, date(2026, 1, 1))
        assert result == []

    def test_loads_recent_rows(self, tmp_path):
        today = pd.Timestamp.utcnow()
        df = pd.DataFrame(
            {
                "timestamp_utc": [today],
                "url": ["https://reuters.com/a"],
                "source_domain": ["reuters.com"],
                "source": ["gdelt"],
                "tone": [-2.5],
                "positive_score": [1.0],
                "negative_score": [3.5],
                "polarity": [-2.5],
                "activity_ref_density": [0.5],
                "self_group_ref_density": [0.1],
                "word_count": [100],
                "themes": [["ECON_INFLATION"]],
                "locations": [["United States"]],
                "organizations": [["Federal Reserve"]],
            }
        )
        silver_path = (
            tmp_path
            / "processed"
            / "sentiment"
            / "source=gdelt"
            / f"year={today.year}"
            / f"month={today.month:02d}"
            / "sentiment_cleaned.parquet"
        )
        self._write_parquet(silver_path, df)
        result = load_gdelt_gkg(tmp_path, date.today() - timedelta(days=7))
        assert len(result) == 1
        assert result[0]["source"] == "gdelt"
        assert "GDELT GKG" in result[0]["text"]

    def test_filters_old_rows(self, tmp_path):
        old_ts = pd.Timestamp("2020-01-01", tz="UTC")
        df = pd.DataFrame(
            {
                "timestamp_utc": [old_ts],
                "url": ["https://old.com"],
                "source_domain": ["old.com"],
                "source": ["gdelt"],
                "tone": [0.0],
                "positive_score": [0.0],
                "negative_score": [0.0],
                "polarity": [0.0],
                "activity_ref_density": [0.0],
                "self_group_ref_density": [0.0],
                "word_count": [0],
                "themes": [[]],
                "locations": [[]],
                "organizations": [[]],
            }
        )
        silver_path = (
            tmp_path
            / "processed"
            / "sentiment"
            / "source=gdelt"
            / "year=2020"
            / "month=01"
            / "sentiment_cleaned.parquet"
        )
        self._write_parquet(silver_path, df)
        result = load_gdelt_gkg(tmp_path, date(2026, 1, 1))
        assert result == []

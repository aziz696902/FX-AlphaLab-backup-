"""Tests for src/rag/chunker.py."""

from src.rag.chunker import Chunk, _make_id, chunk_cb_document, chunk_gdelt_row


def _make_doc(**kwargs) -> dict:
    defaults = {
        "url": "https://example.com/doc",
        "title": "Test Doc",
        "content": "Hello world.",
        "document_type": "statements",
        "speaker": None,
        "date": "2026-05-01",
        "source": "fed",
    }
    return {**defaults, **kwargs}


class TestChunkCbDocument:
    def test_returns_at_least_one_chunk(self):
        doc = _make_doc(content="Short content.")
        chunks = chunk_cb_document(doc)
        assert len(chunks) >= 1

    def test_chunk_id_is_stable(self):
        doc = _make_doc()
        c1 = chunk_cb_document(doc)
        c2 = chunk_cb_document(doc)
        assert [c.id for c in c1] == [c.id for c in c2]

    def test_chunk_id_length(self):
        doc = _make_doc()
        for chunk in chunk_cb_document(doc):
            assert len(chunk.id) == 40

    def test_metadata_fields_present(self):
        doc = _make_doc(speaker="Jerome Powell")
        chunks = chunk_cb_document(doc)
        for chunk in chunks:
            assert chunk.metadata["source"] == "fed"
            assert chunk.metadata["date"] == "2026-05-01"
            assert chunk.metadata["speaker"] == "Jerome Powell"

    def test_long_content_splits_into_multiple_chunks(self):
        long_content = "A" * 900 + "\n\n" + "B" * 900
        doc = _make_doc(content=long_content)
        chunks = chunk_cb_document(doc)
        assert len(chunks) > 1

    def test_paragraph_split_on_double_newline(self):
        doc = _make_doc(content="Para one.\n\nPara two.")
        chunks = chunk_cb_document(doc)
        texts = [c.text for c in chunks]
        assert any("Para one." in t for t in texts)
        assert any("Para two." in t for t in texts)

    def test_fallback_on_empty_paragraphs(self):
        doc = _make_doc(content="x" * 200)
        chunks = chunk_cb_document(doc)
        assert len(chunks) >= 1

    def test_different_docs_have_different_ids(self):
        doc1 = _make_doc(url="https://fed.gov/a")
        doc2 = _make_doc(url="https://fed.gov/b")
        ids1 = {c.id for c in chunk_cb_document(doc1)}
        ids2 = {c.id for c in chunk_cb_document(doc2)}
        assert ids1.isdisjoint(ids2)


class TestChunkGdeltRow:
    def _gdelt_row(self, **kwargs) -> dict:
        defaults = {
            "text": "[GDELT GKG] 2026-05-01 | tone=-2.50 | source=reuters.com",
            "url": "https://reuters.com/article",
            "date": "2026-05-01",
            "source": "gdelt",
        }
        return {**defaults, **kwargs}

    def test_returns_single_chunk(self):
        row = self._gdelt_row()
        chunk = chunk_gdelt_row(row)
        assert isinstance(chunk, Chunk)

    def test_text_preserved(self):
        row = self._gdelt_row()
        chunk = chunk_gdelt_row(row)
        assert chunk.text == row["text"]

    def test_metadata_source_is_gdelt(self):
        row = self._gdelt_row()
        chunk = chunk_gdelt_row(row)
        assert chunk.metadata["source"] == "gdelt"


class TestMakeId:
    def test_deterministic(self):
        assert _make_id("fed", "https://x.com", 0) == _make_id("fed", "https://x.com", 0)

    def test_different_index_gives_different_id(self):
        assert _make_id("fed", "https://x.com", 0) != _make_id("fed", "https://x.com", 1)

    def test_length_is_40(self):
        assert len(_make_id("fed", "https://x.com", 0)) == 40

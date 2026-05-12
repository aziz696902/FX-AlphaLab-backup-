"""Document chunker for RAG indexing.

Splits CB documents into paragraph-level chunks and wraps GDELT rows
as single-chunk dicts with stable sha256-based IDs.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from src.rag.date_utils import date_str_to_int

_MAX_CHUNK_CHARS = 800
_OVERLAP_CHARS = 100


@dataclass(frozen=True)
class Chunk:
    id: str  # sha256[:40] of "{source}:{url}:{chunk_idx}"
    text: str
    metadata: dict


def chunk_cb_document(doc: dict) -> list[Chunk]:
    """Split a CB document dict into paragraph-level chunks."""
    content = doc["content"]
    paragraphs = _split_paragraphs(content)
    chunks: list[Chunk] = []
    idx = 0
    for para in paragraphs:
        para = para.strip()
        if len(para) < 50:  # skip very short fragments
            continue
        # Hard-split paragraphs that exceed the max size
        for segment in _hard_split(para):
            chunks.append(_make_chunk(doc, segment, idx))
            idx += 1
    # Fallback: if nothing survived, emit a single truncated chunk
    if not chunks:
        chunks.append(_make_chunk(doc, content[:_MAX_CHUNK_CHARS], 0))
    return chunks


def chunk_gdelt_row(doc: dict) -> Chunk:
    """Wrap a GDELT GKG row as a single Chunk."""
    return _make_chunk(doc, doc["text"], 0, text_key="text")


def _make_chunk(doc: dict, text: str, idx: int, text_key: str = "content") -> Chunk:
    url = doc.get("url", "")
    source = doc.get("source", "")
    date_str = doc.get("date", "")
    date_int = date_str_to_int(date_str)
    chunk_id = _make_id(source, url, idx)
    metadata = {
        "source": source,
        "url": url,
        "date": date_str,
        "chunk_idx": idx,
        "document_type": doc.get("document_type", ""),
        "speaker": doc.get("speaker") or "",
        "title": doc.get("title", ""),
    }
    if date_int is not None:
        metadata["date_int"] = date_int
    return Chunk(id=chunk_id, text=text, metadata=metadata)


def _make_id(source: str, url: str, chunk_idx: int) -> str:
    raw = f"{source}:{url}:{chunk_idx}"
    return hashlib.sha256(raw.encode()).hexdigest()[:40]


def _split_paragraphs(text: str) -> list[str]:
    """Split on double newlines first, then single newlines."""
    if "\n\n" in text:
        return text.split("\n\n")
    return text.split("\n")


def _hard_split(text: str) -> list[str]:
    """Split a long paragraph into ≤_MAX_CHUNK_CHARS segments."""
    if len(text) <= _MAX_CHUNK_CHARS:
        return [text]
    segments: list[str] = []
    start = 0
    while start < len(text):
        end = start + _MAX_CHUNK_CHARS
        segments.append(text[start:end])
        start = end - _OVERLAP_CHARS  # small overlap
    return segments

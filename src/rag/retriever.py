"""RAG retriever interface.

All retriever implementations must satisfy this Protocol.
The `NoOpRetriever` in stub.py is wired by default; swap it for a real
implementation (e.g. ChromaRetriever) when the RAG pipeline is ready.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class RetrievedChunk:
    """A single retrieved document chunk with full provenance."""

    content: str
    source: str  # human-readable origin, e.g. "ecb_minutes_2024_09.pdf"
    doc_id: str  # stable identifier for dedup and click-through
    score: float  # similarity score (higher = more relevant)


@runtime_checkable
class Retriever(Protocol):
    async def retrieve(self, query: str, top_k: int = 5) -> list[RetrievedChunk]:
        """Return up to top_k relevant chunks for the given query.

        Args:
            query:  Natural-language query from the user message.
            top_k:  Maximum number of chunks to return.

        Returns:
            Ordered list of RetrievedChunk, most relevant first.
            Empty list if nothing is retrieved (not an error).
        """
        ...

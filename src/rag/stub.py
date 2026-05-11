"""No-op RAG retriever — wired by default until a real implementation is available."""

from __future__ import annotations

from src.rag.retriever import RetrievedChunk


class NoOpRetriever:
    """Satisfies the Retriever protocol; always returns an empty chunk list.

    Replace this with ChromaRetriever (or equivalent) once the document
    and post ingestion pipelines are built.  The chat service and any other
    consumer depend only on the Retriever Protocol, so swapping is a one-line
    change in the wiring layer (routers/chat.py).
    """

    async def retrieve(self, query: str, top_k: int = 5) -> list[RetrievedChunk]:
        return []

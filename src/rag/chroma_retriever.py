"""ChromaDB-backed retriever implementing the Retriever protocol.

All synchronous ChromaDB and embedding calls are wrapped in
asyncio.to_thread() so the event loop is never blocked.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import chromadb

from src.rag.embedder import embed_query
from src.rag.indexer import get_collection
from src.rag.query_enricher import enrich
from src.rag.retriever import RetrievedChunk

logger = logging.getLogger(__name__)


class ChromaRetriever:
    """Production retriever backed by a persistent ChromaDB collection."""

    def __init__(self, chroma_dir: Path) -> None:
        self._chroma_dir = chroma_dir
        self._collection: chromadb.Collection | None = None

    def _get_collection(self) -> chromadb.Collection:
        if self._collection is None:
            self._collection = get_collection(self._chroma_dir)
        return self._collection

    async def retrieve(self, query: str, top_k: int = 5) -> list[RetrievedChunk]:
        """Return up to top_k relevant chunks for the query.

        Enriches the query for temporal/source metadata filtering,
        embeds it, then queries ChromaDB — all in a thread pool.
        """
        where = enrich(query)

        def _sync_retrieve() -> list[RetrievedChunk]:
            collection = self._get_collection()
            if collection.count() == 0:
                return []

            query_embedding = embed_query(query)

            kwargs: dict = {
                "query_embeddings": [query_embedding],
                "n_results": min(top_k, collection.count()),
                "include": ["documents", "metadatas", "distances"],
            }
            if where:
                kwargs["where"] = where

            try:
                result = collection.query(**kwargs)
            except Exception as exc:
                logger.warning("ChromaDB query failed: %s", exc)
                return []

            chunks: list[RetrievedChunk] = []
            ids = result.get("ids", [[]])[0]
            docs = result.get("documents", [[]])[0]
            metas = result.get("metadatas", [[]])[0]
            distances = result.get("distances", [[]])[0]

            for chunk_id, doc, meta, dist in zip(ids, docs, metas, distances):
                # Cosine distance → similarity score (1 - distance)
                score = max(0.0, 1.0 - dist)
                source_label = f"{meta.get('source', '?')} | {meta.get('date', '?')}"
                if meta.get("title"):
                    source_label += f" | {meta['title'][:60]}"
                chunks.append(
                    RetrievedChunk(
                        content=doc,
                        source=source_label,
                        doc_id=chunk_id,
                        score=score,
                    )
                )
            return chunks

        return await asyncio.to_thread(_sync_retrieve)

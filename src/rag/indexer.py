"""Build and maintain the ChromaDB RAG index.

Entry point: build_index().  Call this on startup and after new data lands.
Performs a full upsert of the rolling 30-day window and evicts stale chunks.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from pathlib import Path

import chromadb

from src.rag.chunker import Chunk, chunk_cb_document, chunk_gdelt_row
from src.rag.embedder import embed_documents
from src.rag.loaders.cb_documents import load_cb_documents
from src.rag.loaders.gdelt_gkg import load_gdelt_gkg

logger = logging.getLogger(__name__)

COLLECTION_NAME = "fx_rag"
_EMBED_BATCH = 64  # chunks per embedding call


def get_collection(chroma_dir: Path) -> chromadb.Collection:
    """Return the persistent ChromaDB collection, creating it if needed."""
    client = chromadb.PersistentClient(path=str(chroma_dir))
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def build_index(
    data_dir: Path,
    chroma_dir: Path,
    days: int = 30,
) -> dict[str, int]:
    """Rebuild the rolling-window index.

    Args:
        data_dir:  Project data/ root (Config.DATA_DIR).
        chroma_dir: Persistent ChromaDB directory (Config.CHROMA_DIR).
        days:      Rolling window size in days.

    Returns:
        Dict with counts: {"upserted": N, "evicted": N, "total": N}.
    """
    today = date.today()
    cutoff = today - timedelta(days=days)

    logger.info("Building RAG index (cutoff=%s, chroma=%s)", cutoff, chroma_dir)
    chroma_dir.mkdir(parents=True, exist_ok=True)
    collection = get_collection(chroma_dir)

    # --- Load and chunk ---
    cb_docs = load_cb_documents(data_dir, cutoff)
    gkg_rows = load_gdelt_gkg(data_dir, cutoff)

    chunks: list[Chunk] = []
    for doc in cb_docs:
        chunks.extend(chunk_cb_document(doc))
    for row in gkg_rows:
        chunks.append(chunk_gdelt_row(row))

    # Deduplicate by ID (same doc can appear in multiple JSONL backfill files)
    seen: set[str] = set()
    unique_chunks: list[Chunk] = []
    for c in chunks:
        if c.id not in seen:
            seen.add(c.id)
            unique_chunks.append(c)
    chunks = unique_chunks

    logger.info("Total chunks to index: %d (after dedup)", len(chunks))

    # --- Embed and upsert in batches ---
    upserted = 0
    for i in range(0, len(chunks), _EMBED_BATCH):
        batch = chunks[i : i + _EMBED_BATCH]
        texts = [c.text for c in batch]
        embeddings = embed_documents(texts)
        collection.upsert(
            ids=[c.id for c in batch],
            embeddings=embeddings,
            documents=texts,
            metadatas=[c.metadata for c in batch],
        )
        upserted += len(batch)
        logger.debug("Upserted %d / %d chunks", upserted, len(chunks))

    # --- Evict stale chunks (date < cutoff) ---
    evicted = _evict_stale(collection, cutoff)

    total = collection.count()
    logger.info("Index built: upserted=%d evicted=%d total=%d", upserted, evicted, total)
    return {"upserted": upserted, "evicted": evicted, "total": total}


def _evict_stale(collection: chromadb.Collection, cutoff: date) -> int:
    """Delete chunks whose metadata date is older than cutoff."""
    try:
        result = collection.get(where={"date": {"$lt": cutoff.isoformat()}})
        stale_ids = result.get("ids", [])
        if stale_ids:
            collection.delete(ids=stale_ids)
        return len(stale_ids)
    except Exception as exc:
        logger.warning("Stale eviction failed: %s", exc)
        return 0

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
from src.rag.date_utils import date_str_to_int, date_to_int
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
    evict: bool = True,
) -> dict[str, int]:
    """Rebuild the rolling-window index.

    Args:
        data_dir:  Project data/ root (Config.DATA_DIR).
        chroma_dir: Persistent ChromaDB directory (Config.CHROMA_DIR).
        days:      Rolling window size in days.
        evict:     Whether to delete chunks older than the cutoff (default True).

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

    # Interleave by source so quota is shared proportionally across all sources.
    # Without this, ECB (heaviest) exhausts quota before Fed/BoE/GDELT are touched.
    buckets: dict[str, list[Chunk]] = {}
    for c in unique_chunks:
        buckets.setdefault(c.metadata["source"], []).append(c)
    chunks = []
    while any(buckets.values()):
        for src in list(buckets.keys()):
            if buckets[src]:
                chunks.append(buckets[src].pop(0))

    logger.info(
        "Total chunks to index: %d (after dedup, interleaved across %d sources)",
        len(chunks),
        len(buckets),
    )

    # --- Skip already-indexed chunks ---
    chunks = _filter_new_chunks(collection, chunks)
    logger.info("New chunks to embed: %d", len(chunks))

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
        logger.info("Upserted %d / %d new chunks", upserted, len(chunks))

    # --- Evict stale chunks (date < cutoff) ---
    evicted = _evict_stale(collection, cutoff) if evict else 0

    total = collection.count()
    logger.info("Index built: upserted=%d evicted=%d total=%d", upserted, evicted, total)
    return {"upserted": upserted, "evicted": evicted, "total": total}


def backfill_date_int(chroma_dir: Path, batch_size: int = 500) -> int:
    """Backfill date_int metadata for existing chunks without re-embedding."""
    collection = get_collection(chroma_dir)
    if collection.count() == 0:
        return 0

    result = collection.get(include=["metadatas"])
    ids = result.get("ids", [])
    metas = result.get("metadatas", [])

    updates_ids: list[str] = []
    updates_metas: list[dict] = []

    for id_, meta in zip(ids, metas):
        if not isinstance(meta, dict):
            continue
        date_int = meta.get("date_int")
        if isinstance(date_int, int):
            continue
        if isinstance(date_int, float) and date_int.is_integer():
            date_int = int(date_int)
        else:
            date_int = date_str_to_int(str(meta.get("date", "")))
        if date_int is None:
            continue
        new_meta = dict(meta)
        new_meta["date_int"] = date_int
        updates_ids.append(id_)
        updates_metas.append(new_meta)

    if not updates_ids:
        return 0

    updated = 0
    for i in range(0, len(updates_ids), batch_size):
        batch_ids = updates_ids[i : i + batch_size]
        batch_metas = updates_metas[i : i + batch_size]
        collection.update(ids=batch_ids, metadatas=batch_metas)
        updated += len(batch_ids)

    logger.info("Backfilled date_int on %d chunks", updated)
    return updated


def date_int_healthcheck(chroma_dir: Path, sample_size: int = 5) -> dict[str, int | list[str]]:
    """Inspect ChromaDB metadata for date_int coverage and validity."""
    collection = get_collection(chroma_dir)
    if collection.count() == 0:
        return {
            "total": 0,
            "missing_date_int": 0,
            "invalid_date": 0,
            "min_date_int": 0,
            "max_date_int": 0,
            "sample_missing_ids": [],
        }

    result = collection.get(include=["metadatas"])
    ids = result.get("ids", [])
    metas = result.get("metadatas", [])

    missing_date_int = 0
    invalid_date = 0
    min_date_int = None
    max_date_int = None
    sample_missing_ids: list[str] = []

    for id_, meta in zip(ids, metas):
        if not isinstance(meta, dict):
            continue
        date_int = meta.get("date_int")
        if isinstance(date_int, float) and date_int.is_integer():
            date_int = int(date_int)
        if not isinstance(date_int, int):
            parsed = date_str_to_int(str(meta.get("date", "")))
            if parsed is None:
                invalid_date += 1
                if len(sample_missing_ids) < sample_size:
                    sample_missing_ids.append(id_)
                continue
            missing_date_int += 1
            if len(sample_missing_ids) < sample_size:
                sample_missing_ids.append(id_)
            date_int = parsed

        if min_date_int is None or date_int < min_date_int:
            min_date_int = date_int
        if max_date_int is None or date_int > max_date_int:
            max_date_int = date_int

    return {
        "total": len(ids),
        "missing_date_int": missing_date_int,
        "invalid_date": invalid_date,
        "min_date_int": min_date_int or 0,
        "max_date_int": max_date_int or 0,
        "sample_missing_ids": sample_missing_ids,
    }


def _filter_new_chunks(collection: chromadb.Collection, chunks: list[Chunk]) -> list[Chunk]:
    """Return only chunks whose IDs are not already in ChromaDB."""
    if not chunks or collection.count() == 0:
        return chunks
    all_ids = [c.id for c in chunks]
    # Query in batches — ChromaDB get() can handle large ID lists but we stay safe
    existing: set[str] = set()
    id_check_batch = 500
    for i in range(0, len(all_ids), id_check_batch):
        result = collection.get(ids=all_ids[i : i + id_check_batch], include=[])
        existing.update(result.get("ids", []))
    return [c for c in chunks if c.id not in existing]


def _evict_stale(collection: chromadb.Collection, cutoff: date) -> int:
    """Delete chunks whose metadata date is older than cutoff."""
    try:
        result = collection.get(include=["metadatas"])
        cutoff_int = date_to_int(cutoff)
        stale_ids: list[str] = []
        for id_, meta in zip(result["ids"], result["metadatas"]):
            if not isinstance(meta, dict):
                continue
            meta_date_int = meta.get("date_int")
            if isinstance(meta_date_int, float) and meta_date_int.is_integer():
                meta_date_int = int(meta_date_int)
            if not isinstance(meta_date_int, int):
                meta_date_int = date_str_to_int(str(meta.get("date", "")))
            if meta_date_int is None:
                continue
            if meta_date_int < cutoff_int:
                stale_ids.append(id_)
        if stale_ids:
            collection.delete(ids=stale_ids)
        return len(stale_ids)
    except Exception as exc:
        logger.warning("Stale eviction failed: %s", exc)
        return 0

"""Google text-embedding-004 wrapper.

All calls are synchronous; callers in async contexts must wrap with
asyncio.to_thread() to avoid blocking the event loop.
"""

from __future__ import annotations

import time

from google import genai
from google.genai import types

from src.shared.config import Config

_MODEL = "gemini-embedding-001"
_BATCH_SIZE = 100  # API limit per call
_INTER_BATCH_DELAY = 2.0  # seconds between batches — stay under 100 req/min free tier


def _client() -> genai.Client:
    key = Config.GEMINI_API_KEY
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=key)


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed texts for indexing (RETRIEVAL_DOCUMENT task type)."""
    return _embed_batched(texts, "RETRIEVAL_DOCUMENT")


def embed_query(text: str) -> list[float]:
    """Embed a single query string (RETRIEVAL_QUERY task type)."""
    return _embed_batched([text], "RETRIEVAL_QUERY")[0]


def _embed_batched(texts: list[str], task_type: str) -> list[list[float]]:
    if not texts:
        return []
    client = _client()
    result: list[list[float]] = []
    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        # SDK has built-in tenacity retry for 429s — no need to wrap again
        response = client.models.embed_content(
            model=_MODEL,
            contents=batch,
            config=types.EmbedContentConfig(task_type=task_type),
        )
        result.extend(emb.values for emb in response.embeddings)
        if i + _BATCH_SIZE < len(texts):
            time.sleep(_INTER_BATCH_DELAY)
    return result

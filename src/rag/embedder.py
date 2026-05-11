"""Google text-embedding-004 wrapper.

All calls are synchronous; callers in async contexts must wrap with
asyncio.to_thread() to avoid blocking the event loop.
"""

from __future__ import annotations

import logging
import time

from google import genai
from google.genai import types
from google.genai.errors import ClientError

from src.shared.config import Config

logger = logging.getLogger(__name__)

_MODEL = "gemini-embedding-001"
_BATCH_SIZE = 100  # texts per API call
_RATE_LIMIT_WAIT = 62  # seconds to sleep on 429 before retrying


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
    i = 0
    just_waited = False
    while i < len(texts):
        batch = texts[i : i + _BATCH_SIZE]
        try:
            response = client.models.embed_content(
                model=_MODEL,
                contents=batch,
                config=types.EmbedContentConfig(task_type=task_type),
            )
            result.extend(emb.values for emb in response.embeddings)
            i += _BATCH_SIZE
            just_waited = False
        except ClientError as exc:
            if exc.code == 429:
                if just_waited:
                    # Still 429 after a full wait → daily quota exhausted, no point retrying
                    raise RuntimeError(
                        "Daily embedding quota exhausted. Retry tomorrow or switch API key."
                    ) from exc
                logger.warning("Embed rate limit hit — sleeping %ds before retry", _RATE_LIMIT_WAIT)
                time.sleep(_RATE_LIMIT_WAIT)
                just_waited = True
                # retry same batch — do NOT advance i
            else:
                raise
    return result

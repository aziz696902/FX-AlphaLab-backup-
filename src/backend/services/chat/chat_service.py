"""Chat service: orchestrates context building, RAG retrieval, and LLM streaming."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from sqlalchemy.orm import Session

from src.backend.schemas.chat import ChatMessage
from src.backend.services.chat.context_builder import MT5State, build_context
from src.backend.services.chat.llm_client import stream_chat
from src.backend.services.chat.prompt_builder import build_system_prompt
from src.rag.retriever import Retriever

logger = logging.getLogger(__name__)


async def stream_response(
    db: Session,
    messages: list[ChatMessage],
    retriever: Retriever,
    mt5_state: MT5State | None = None,
) -> AsyncIterator[str]:
    """Build grounded context, augment with RAG chunks, and stream the LLM response.

    Args:
        db:         SQLAlchemy session (read-only queries).
        messages:   Full conversation history from the client.
        retriever:  RAG retriever (NoOpRetriever by default; swap for ChromaRetriever later).
        mt5_state:  Optional live MT5 snapshot pre-fetched by the router.

    Yields:
        Text delta chunks from the model.
    """
    ctx = build_context(db, mt5_state)
    system_prompt = build_system_prompt(ctx)

    # RAG augmentation — retrieve chunks relevant to the latest user query.
    last_user_content = next((m.content for m in reversed(messages) if m.role == "user"), "")
    rag_chunks = await retriever.retrieve(last_user_content)
    if rag_chunks:
        formatted = [f"[{c.source}] (score={c.score:.3f})\n{c.content}" for c in rag_chunks]
        rag_block = "\n=== RETRIEVED DOCUMENTS ===\n" + "\n---\n".join(formatted) + "\n"
        system_prompt = system_prompt + rag_block

    msg_dicts = [{"role": m.role.value, "content": m.content} for m in messages]

    async for chunk in stream_chat(msg_dicts, system_prompt):
        yield chunk

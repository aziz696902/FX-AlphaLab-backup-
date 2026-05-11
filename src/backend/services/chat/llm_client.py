"""Google Gemini LLM client.

Uses the current `google-genai` SDK (google.genai).

Two public functions:
- stream_chat()    — multi-turn streaming, used by the chat feature.
- generate_text()  — single-turn non-streaming, used by the narrate endpoint.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from google import genai
from google.genai import types

from src.shared.config import Config

logger = logging.getLogger(__name__)

_MODEL = "gemini-3.1-flash-lite-preview"


def _get_client() -> genai.Client:
    api_key = Config.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured in the environment")
    return genai.Client(api_key=api_key)


async def stream_chat(
    messages: list[dict[str, str]],
    system_prompt: str,
) -> AsyncIterator[str]:
    """Yield text delta chunks from Gemini for a multi-turn conversation.

    Args:
        messages:       Full conversation history with role "user" | "assistant".
        system_prompt:  Pre-built system prompt (persona + inference context).

    Yields:
        Text delta strings as they arrive from the model.
    """
    client = _get_client()

    # Gemini uses "model" instead of "assistant" for the AI role.
    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part(text=m["content"])],
        )
        for m in messages
    ]

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.7,
        max_output_tokens=1024,
    )

    async for chunk in await client.aio.models.generate_content_stream(
        model=_MODEL,
        contents=contents,
        config=config,
    ):
        try:
            text = chunk.text
            if text:
                yield text
        except (ValueError, AttributeError):
            # Chunk contains no text (e.g. safety metadata only) — skip silently.
            continue


async def generate_text(prompt: str, system_prompt: str = "") -> str:
    """Return a complete text response from Gemini for a single-turn prompt.

    Args:
        prompt:        User-side content (e.g. serialised JSON context).
        system_prompt: Optional system instruction (persona / task framing).

    Returns:
        Full response text. Empty string if the model returns nothing.
    """
    client = _get_client()

    config = types.GenerateContentConfig(
        system_instruction=system_prompt or None,
        temperature=0.7,
        max_output_tokens=512,
    )

    response = await client.aio.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=config,
    )

    try:
        return response.text or ""
    except (ValueError, AttributeError):
        return ""

"""Narrate endpoint — generates a plain-English market summary from coordinator context."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException

from src.backend.schemas.narrate import NarrateRequest, NarrateResponse
from src.backend.services.chat.llm_client import generate_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/narrate", tags=["narrate"])

_SYSTEM_PROMPT = (
    "You are a concise FX market analyst. "
    "Given the following raw coordinator signal context (JSON), write 2-3 short sentences "
    "in plain English explaining what's happening in the market right now, "
    "what the top trade idea is, and why. "
    "Be direct, no jargon. No bullet points."
)


@router.post("", response_model=NarrateResponse)
async def narrate(body: NarrateRequest) -> NarrateResponse:
    """Generate a plain-English narrative from a coordinator signal context."""
    try:
        narrative = await generate_text(
            prompt=json.dumps(body.context),
            system_prompt=_SYSTEM_PROMPT,
        )
    except Exception:
        logger.exception("Gemini narrate call failed")
        raise HTTPException(status_code=502, detail="LLM request failed")

    return NarrateResponse(narrative=narrative)

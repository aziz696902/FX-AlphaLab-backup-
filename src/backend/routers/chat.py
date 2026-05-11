"""Chat endpoint — POST /chat/stream.

Returns a Server-Sent Events stream of text deltas from the LLM.
The LLM receives the full inference context (all agent outputs + live MT5 state)
as its system prompt, so it can answer any question about today's analysis.

SSE protocol:
  data: {"delta": "<text chunk>"}   — one or more, as they arrive
  data: [DONE]                       — signals end of stream
  data: {"error": "<message>"}      — on failure, then [DONE]
"""

from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.backend.dependencies import get_db
from src.backend.schemas.chat import ChatRequest
from src.backend.services.chat.chat_service import stream_response
from src.backend.services.chat.context_builder import MT5State
from src.live.mt5_connection import mt5_connection
from src.rag.chroma_retriever import ChromaRetriever
from src.shared.config import Config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

_retriever = ChromaRetriever(chroma_dir=Config.CHROMA_DIR)


async def _fetch_mt5_state() -> MT5State:
    """Fetch live MT5 account and positions. Returns an empty state on failure."""
    try:
        if not mt5_connection._initialized:
            return MT5State()

        positions_raw = await mt5_connection.get_positions()
        account_raw = await mt5_connection.get_account_info()

        positions = [
            {
                "symbol": p.symbol,
                "side": "BUY" if p.type == 0 else "SELL",
                "volume": p.volume,
                "open_price": p.price_open,
                "current_price": p.price_current,
                "sl": p.sl,
                "tp": p.tp,
                "profit": p.profit,
            }
            for p in positions_raw
        ]
        account = {
            "balance": account_raw.balance,
            "equity": account_raw.equity,
            "margin": account_raw.margin,
            "margin_free": account_raw.margin_free,
            "margin_level": account_raw.margin_level,
            "profit": account_raw.profit,
        }
        return MT5State(positions=positions, account=account)

    except Exception:
        logger.warning("Could not fetch MT5 state for chat context", exc_info=True)
        return MT5State()


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """Stream an LLM response grounded in the latest agent outputs and live MT5 state.

    **Request body**:
    ```json
    {
      "messages": [
        {"role": "user", "content": "What is today's top pick?"},
        {"role": "assistant", "content": "Today's top pick is ..."},
        {"role": "user", "content": "What is the risk/reward?"}
      ]
    }
    ```

    **Response**: `text/event-stream`
    ```
    data: {"delta": "The risk"}
    data: {"delta": "/reward ratio is 2.3:1"}
    data: [DONE]
    ```
    """
    mt5_state = await _fetch_mt5_state()

    async def event_generator():
        try:
            async for chunk in stream_response(
                db=db,
                messages=request.messages,
                retriever=_retriever,
                mt5_state=mt5_state,
            ):
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
        except Exception:
            logger.exception("Error in chat stream")
            yield f"data: {json.dumps({'error': 'Stream interrupted — please try again'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

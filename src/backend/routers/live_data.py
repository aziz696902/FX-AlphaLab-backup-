"""Router for live WebSocket candle streams."""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.live.candle_feed import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["live"])


@router.websocket("/ws/candles/{pair}/{timeframe}")
async def websocket_candles(websocket: WebSocket, pair: str, timeframe: str) -> None:
    """WebSocket endpoint for live candle updates.

    Establishes bidirectional connection. On connect, client receives:
    1. Last known candle state (prevents cold-start gap)
    2. Position and account updates
    3. Live candle updates (every bar change)
    4. Tick updates (bid/ask changes)
    5. Connection status messages

    Args:
        websocket: WebSocket connection
        pair: Canonical symbol (e.g. "EURUSD")
        timeframe: Timeframe string (e.g. "M1")
    """
    await websocket.accept()
    logger.info(f"WebSocket connected: {pair}:{timeframe}")

    try:
        # Subscribe to candle channel
        await connection_manager.subscribe(websocket, pair, timeframe)

        # Send initial connection status
        await websocket.send_json(
            {
                "type": "status",
                "state": "connected",
                "message": f"Subscribed to {pair}:{timeframe}",
            }
        )

        # Keep connection alive, respond to pings
        while True:
            data = await websocket.receive_text()
            if data in ["ping", "PING"]:
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {pair}:{timeframe}")
        await connection_manager.unsubscribe(websocket)

    except Exception as e:
        logger.exception(f"WebSocket error for {pair}:{timeframe}: {e}")
        await connection_manager.unsubscribe(websocket)
        try:
            await websocket.close()
        except Exception:
            pass

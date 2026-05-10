"""Background task for position tracking and broadcasting.

Polls open positions every 1000ms and broadcasts updates via WebSocket.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from src.live.candle_feed import connection_manager
from src.live.mt5_connection import MT5Connection, MT5Error

logger = logging.getLogger(__name__)


class PositionTracker:
    """Polls and broadcasts open positions and account info.

    Runs as a background task. Every 1000ms:
    - Fetch all open positions
    - Broadcast position_update for each
    - Broadcast account_update with current balance/equity/margin
    """

    def __init__(self, mt5_conn: MT5Connection) -> None:
        """Initialize position tracker.

        Args:
            mt5_conn: MT5Connection instance
        """
        self.mt5_conn = mt5_conn
        self._running = False
        self._last_positions: dict[int, dict] = {}  # ticket -> position data

    async def run(self) -> None:
        """Main loop for position tracking.

        Runs indefinitely. On error, broadcasts status and retries after 5s.
        """
        logger.info("PositionTracker started")
        self._running = True

        while self._running:
            try:
                # Skip polling when no WebSocket clients are subscribed
                if not connection_manager._channels.get("positions"):
                    await asyncio.sleep(1.0)
                    continue

                # Fetch all open positions
                positions = await self.mt5_conn.get_positions()

                # Broadcast position updates
                for position in positions:
                    payload = {
                        "type": "position_update",
                        "ticket": position.ticket,
                        "symbol": position.symbol,
                        "side": "BUY" if position.type == 0 else "SELL",
                        "volume": position.volume,
                        "open_price": position.price_open,
                        "current_price": position.price_current,
                        "sl": position.sl,
                        "tp": position.tp,
                        "profit": position.profit,
                        "swap": position.swap,
                        "open_time": datetime.fromtimestamp(
                            position.time_utc, tz=timezone.utc
                        ).isoformat(),
                    }
                    await connection_manager.broadcast("positions", payload)

                # Broadcast account update
                account = await self.mt5_conn.get_account_info()
                account_payload = {
                    "type": "account_update",
                    "balance": account.balance,
                    "equity": account.equity,
                    "margin": account.margin,
                    "margin_free": account.margin_free,
                    "margin_level": account.margin_level,
                    "profit": account.profit,
                }
                await connection_manager.broadcast("positions", account_payload)

                # Sleep 1000ms before next poll
                await asyncio.sleep(1.0)

            except MT5Error as e:
                logger.error(f"MT5 error in position tracker: {e}")
                await connection_manager.broadcast(
                    "positions",
                    {
                        "type": "status",
                        "state": "mt5_offline",
                        "message": str(e),
                    },
                )
                # Wait 5s before retry
                await asyncio.sleep(5.0)

            except Exception as e:
                logger.exception(f"Unexpected error in position tracker: {e}")
                await asyncio.sleep(5.0)

        logger.info("PositionTracker stopped")

    def stop(self) -> None:
        """Stop the tracking loop gracefully."""
        self._running = False


# Module-level singleton
position_tracker: PositionTracker | None = None

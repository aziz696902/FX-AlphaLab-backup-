"""Live candle feed with WebSocket broadcasting.

Components:
- ConnectionManager: Tracks active WebSocket subscriptions by channel
- CandleFeed: Background polling task that fetches rates and broadcasts updates
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from src.live.mt5_connection import MT5Connection, MT5Error, MT5Rate

logger = logging.getLogger(__name__)

# Timeframe mapping: canonical string -> mt5 constant
TIMEFRAME_MAP: dict[str, int] = None  # Lazy-loaded from MT5


def _get_timeframe_map() -> dict[str, int]:
    """Lazy-load timeframe mapping from MT5 module."""
    global TIMEFRAME_MAP
    if TIMEFRAME_MAP is not None:
        return TIMEFRAME_MAP

    try:
        import MetaTrader5 as mt5  # noqa: N813
    except ImportError:
        raise ImportError("MetaTrader5 module required for timeframe mapping")

    TIMEFRAME_MAP = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30,
        "H1": mt5.TIMEFRAME_H1,
        "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1,
    }
    return TIMEFRAME_MAP


class ConnectionManager:
    """Manages WebSocket subscriptions by channel.

    Channels are named "{pair}:{timeframe}" e.g. "EURUSD:M1"
    Also tracks "positions" channel for position updates.
    """

    def __init__(self) -> None:
        """Initialize connection manager."""
        self._channels: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, ws: WebSocket, pair: str, tf: str) -> None:
        """Subscribe WebSocket to a candle channel.

        Args:
            ws: WebSocket connection
            pair: Canonical symbol (e.g. "EURUSD")
            tf: Timeframe string (e.g. "M1")
        """
        async with self._lock:
            for channel in (f"{pair}:{tf}", f"{pair}:_tick", "positions"):
                if channel not in self._channels:
                    self._channels[channel] = set()
                self._channels[channel].add(ws)
            logger.info(f"WebSocket subscribed to {pair}:{tf}")

    async def unsubscribe(self, ws: WebSocket) -> None:
        """Unsubscribe WebSocket from all channels.

        Args:
            ws: WebSocket connection
        """
        async with self._lock:
            for channel_sockets in self._channels.values():
                channel_sockets.discard(ws)
            logger.info("WebSocket unsubscribed from all channels")

    async def broadcast(self, channel: str, payload: dict[str, Any]) -> None:
        """Broadcast message to all sockets in a channel.

        Silently drops dead sockets. Non-JSON-serializable values are skipped.

        Args:
            channel: Channel name (e.g. "EURUSD:M1" or "positions")
            payload: Data to broadcast (must be JSON-serializable)
        """
        if channel not in self._channels:
            return

        async with self._lock:
            sockets = list(self._channels[channel])  # Copy to avoid mutation

        dead_sockets = set()
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception as e:
                logger.debug(f"Failed to send to socket: {e}")
                dead_sockets.add(ws)

        # Clean up dead sockets
        if dead_sockets:
            async with self._lock:
                for channel_sockets in self._channels.values():
                    channel_sockets.difference_update(dead_sockets)

    def active_subscriptions(self) -> set[tuple[str, str]]:
        """Get active (pair, tf) subscriptions from candle channels only.

        Returns:
            Set of (pair, timeframe) tuples for channels that have subscribers.
            Excludes tick channels (tf starting with '_') and the positions channel.
        """
        subscriptions = set()
        for channel, sockets in self._channels.items():
            if not sockets or ":" not in channel or channel == "positions":
                continue
            try:
                pair, tf = channel.split(":", 1)
                if not tf.startswith("_"):
                    subscriptions.add((pair, tf))
            except ValueError:
                continue
        return subscriptions


class CandleFeed:
    """Background task for live candle polling and broadcasting.

    Polls MT5 every 500ms for active (pair, timeframe) subscriptions.
    Compares with previous state and broadcasts updates on changes.
    Also fetches ticks and broadcasts bid/ask updates.
    """

    def __init__(self, mt5_conn: MT5Connection, conn_mgr: ConnectionManager) -> None:
        """Initialize candle feed.

        Args:
            mt5_conn: MT5Connection singleton instance
            conn_mgr: ConnectionManager singleton instance
        """
        self.mt5_conn = mt5_conn
        self.conn_mgr = conn_mgr
        self._last_state: dict[tuple[str, str], dict[str, Any]] = {}
        self._running = False

    async def run(self) -> None:
        """Main polling loop for live candles.

        Runs indefinitely. On MT5 error, broadcasts status and retries after 5s.
        """
        logger.info("CandleFeed started")
        self._running = True

        while self._running:
            try:
                # Get active subscriptions
                subscriptions = self.conn_mgr.active_subscriptions()

                if subscriptions:
                    # Poll rates for each subscription
                    tf_map = _get_timeframe_map()
                    for pair, tf_str in subscriptions:
                        try:
                            if tf_str not in tf_map:
                                logger.warning(f"Unknown timeframe: {tf_str}")
                                continue

                            mt5_tf = tf_map[tf_str]

                            # Fetch only the current (in-progress) bar.
                            # get_rates returns ascending order; rates[-1] is newest.
                            rates = await self.mt5_conn.get_rates(pair, mt5_tf, count=1)
                            if not rates:
                                continue

                            current = rates[-1]
                            key = (pair, tf_str)

                            if key not in self._last_state or self._rate_changed(
                                self._last_state[key], current
                            ):
                                await self.conn_mgr.broadcast(
                                    f"{pair}:{tf_str}",
                                    {
                                        "type": "candle_update",
                                        "pair": pair,
                                        "timeframe": tf_str,
                                        "time": current.time_utc,
                                        "open": current.open,
                                        "high": current.high,
                                        "low": current.low,
                                        "close": current.close,
                                        "volume": current.tick_volume,
                                        "is_current": True,
                                    },
                                )
                                self._last_state[key] = {
                                    "time": current.time_utc,
                                    "open": current.open,
                                    "high": current.high,
                                    "low": current.low,
                                    "close": current.close,
                                    "volume": current.tick_volume,
                                }

                        except Exception as e:
                            logger.debug(f"Error polling {pair}:{tf_str}: {e}")

                    # Fetch and broadcast ticks for each unique pair
                    pairs = {pair for pair, _ in subscriptions}
                    for pair in pairs:
                        try:
                            tick = await self.mt5_conn.get_tick(pair)
                            await self.conn_mgr.broadcast(
                                f"{pair}:_tick",
                                {
                                    "type": "tick",
                                    "pair": pair,
                                    "bid": tick.bid,
                                    "ask": tick.ask,
                                    "spread_pips": tick.spread_pips,
                                    "time_ms": tick.time_utc * 1000,
                                },
                            )
                        except Exception as e:
                            logger.debug(f"Error fetching tick for {pair}: {e}")

                # Sleep 500ms before next poll
                await asyncio.sleep(0.5)

            except MT5Error as e:
                logger.error(f"MT5 error in candle feed: {e}")
                await self.conn_mgr.broadcast(
                    "positions",  # Broadcast to all connected clients
                    {
                        "type": "status",
                        "state": "mt5_offline",
                        "message": str(e),
                    },
                )
                # Wait 5s before retry
                await asyncio.sleep(5.0)

            except Exception as e:
                logger.exception(f"Unexpected error in candle feed: {e}")
                await asyncio.sleep(5.0)

        logger.info("CandleFeed stopped")

    def stop(self) -> None:
        """Stop the polling loop gracefully."""
        self._running = False

    def _rate_changed(self, last_state: dict[str, Any], rate: MT5Rate) -> bool:
        """Check if rate differs from previous state.

        Args:
            last_state: Previous bar state dict
            rate: Current MT5Rate

        Returns:
            True if any field changed
        """
        return (
            last_state.get("time") != rate.time_utc
            or last_state.get("open") != rate.open
            or last_state.get("high") != rate.high
            or last_state.get("low") != rate.low
            or last_state.get("close") != rate.close
            or last_state.get("volume") != rate.tick_volume
        )


# Module-level singletons
connection_manager = ConnectionManager()
candle_feed: CandleFeed | None = None

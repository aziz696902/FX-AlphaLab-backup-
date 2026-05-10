"""Live trading layer for MT5 with async-safe wrappers and WebSocket support.

Modules:
- symbol_mapper: Bidirectional canonical ↔ MT5 symbol mapping
- mt5_connection: Async-safe MT5 connection with UTC offset correction
- candle_feed: Background polling and WebSocket broadcasting for live candles
- trade_executor: Trade validation and execution with error handling
- position_tracker: Background task for position and account updates
"""

from src.live.candle_feed import CandleFeed, ConnectionManager, connection_manager
from src.live.mt5_connection import MT5Connection, MT5ConnectionError, MT5Error
from src.live.position_tracker import PositionTracker
from src.live.symbol_mapper import SymbolMapper
from src.live.trade_executor import TradeExecutor, TradeResponse, TradeValidationError

__all__ = [
    "CandleFeed",
    "ConnectionManager",
    "connection_manager",
    "MT5Connection",
    "MT5Error",
    "MT5ConnectionError",
    "PositionTracker",
    "SymbolMapper",
    "TradeExecutor",
    "TradeResponse",
    "TradeValidationError",
]

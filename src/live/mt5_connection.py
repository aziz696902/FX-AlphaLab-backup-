"""MT5 connection management with async-safe thread pooling.

CRITICAL: All MT5 operations go through this module via asyncio.to_thread().
Never call mt5.* directly from anywhere else in src/live/.

MT5 is NOT async-safe. This module wraps all MT5 calls in an asyncio.Lock
and executes them in a thread pool to prevent race conditions.

WARNING: --reload is incompatible with MT5. The connection must be initialized
in a process-wide context manager. Do not use uvicorn --reload in development.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from src.live.symbol_mapper import SymbolMapper
from src.shared.config import Config

# MT5 is Windows-only, optional import
try:
    import MetaTrader5 as mt5  # noqa: N813
except ImportError:
    mt5 = None  # type: ignore[assignment]


class MT5Error(Exception):
    """Base exception for MT5 operations."""

    def __init__(self, code: int | None, description: str):
        self.code = code
        self.description = description
        super().__init__(f"MT5Error({code}): {description}")


class MT5ConnectionError(MT5Error):
    """Raised when MT5 connection or login fails."""

    pass


class MT5RequestError(MT5Error):
    """Raised when an MT5 trade request fails."""

    pass


# Typed dataclasses for MT5 return values
# These replace raw MT5 named tuples to ensure type safety and proper UTC correction


@dataclass
class MT5Tick:
    """Current bid/ask tick from MT5."""

    bid: float
    ask: float
    last: float
    volume: int
    time_utc: int  # Unix timestamp UTC (corrected)
    spread_pips: float  # Calculated: (ask - bid) / point


@dataclass
class MT5Rate:
    """OHLCV candle from MT5."""

    time_utc: int  # Unix timestamp UTC (corrected)
    open: float
    high: float
    low: float
    close: float
    tick_volume: int
    real_volume: int


@dataclass
class MT5Position:
    """Open position from MT5."""

    ticket: int
    symbol: str  # Canonical symbol (e.g. "EURUSD")
    type: int  # 0=BUY, 1=SELL (from mt5 enum)
    magic: int
    time_utc: int  # Open time UTC (corrected)
    time_msc: int  # Open time milliseconds
    volume: float
    price_open: float
    sl: float
    tp: float
    price_current: float
    swap: float
    profit: float
    commission: float


@dataclass
class MT5PendingOrder:
    """Unfilled pending order (limit/stop) from MT5."""

    ticket: int
    symbol: str  # Canonical symbol (e.g. "EURUSD")
    type: int  # MT5 ORDER_TYPE enum value
    type_label: str  # "BUY_LIMIT", "SELL_LIMIT", "BUY_STOP", "SELL_STOP", etc.
    volume: float
    price_open: float  # Trigger price
    sl: float
    tp: float
    time_setup_utc: int  # Placement timestamp UTC
    time_expiration_utc: int  # 0 = GTC (no expiration)
    comment: str


@dataclass
class MT5Deal:
    """Individual deal (trade leg) from MT5 history."""

    ticket: int
    position_id: int
    time_utc: int
    type: int  # 0=buy, 1=sell
    entry: int  # 0=in (open), 1=out (close)
    volume: float
    price: float
    commission: float
    swap: float
    profit: float
    symbol: str  # Canonical symbol


@dataclass
class MT5AccountInfo:
    """Account information from MT5."""

    login: int
    trade_mode: int  # mt5.ACCOUNT_TRADE_MODE_DEMO, REAL, etc.
    leverage: int
    limit_orders: int
    trade_allowed: bool
    trade_expert: bool
    balance: float
    credit: float
    profit: float
    equity: float
    margin: float
    margin_free: float
    margin_level: float
    margin_so_call: float
    margin_so_so: float
    currency_digits: int


@dataclass
class MT5OrderResult:
    """Result from order_send()."""

    retcode: int
    deal: int
    order: int
    volume: float
    price: float
    bid: float
    ask: float
    comment: str | None


@dataclass
class MT5OrderCheck:
    """Result from order_check()."""

    retcode: int
    balance: float
    equity: float
    profit: float
    margin: float
    margin_free: float
    margin_level: float


@dataclass
class MT5SymbolInfo:
    """Symbol information from MT5."""

    custom: bool
    chart_mode: int
    select: bool
    visible: bool
    session_deals: int
    session_buy_orders: int
    session_sell_orders: int
    volume: int
    volumehigh: int
    volumelow: int
    time: int
    time_msc: int
    bid: float
    ask: float
    last: float
    volume_real: int
    volumehigh_real: int
    volumelow_real: int
    option_mode: int
    option_right: int
    bid_high: float
    bid_low: float
    ask_high: float
    ask_low: float
    last_high: float
    last_low: float
    trade_mode: int  # SYMBOL_TRADE_MODE_FULL, etc.
    trade_exemode: int
    filling_mode: int  # Bitmask: IOC=0x01, FOK=0x02, RETURN=0x04
    order_mode: int
    expiration_mode: int
    digits: int
    spread: int
    spread_high: int
    spread_low: int
    spread_avg: int
    point: float
    volume_min: float
    volume_max: float
    volume_step: float
    volume_limit: float
    swap_long: float
    swap_short: float
    swap_mode: int
    swap_rollover: int
    margin_hedged: float
    price_open: float
    price_close: float
    price_high: float
    price_low: float
    price_weighted_avg: float
    stops_level: int  # Minimum SL/TP distance in points


_PENDING_ORDER_TYPE_LABELS: dict[int, str] = {
    2: "BUY_LIMIT",
    3: "SELL_LIMIT",
    4: "BUY_STOP",
    5: "SELL_STOP",
    6: "BUY_STOP_LIMIT",
    7: "SELL_STOP_LIMIT",
}


class MT5Connection:
    """Module-level MT5 connection singleton.

    Manages initialization, login, and all async-safe MT5 operations.
    All MT5 calls go through _call() which acquires a lock and uses
    asyncio.to_thread() to prevent race conditions.

    UTC Offset Correction:
    MT5 returns broker server time, not UTC. On initialize(), we compute
    _server_utc_offset_s and apply it to all returned timestamps.
    """

    _instance: MT5Connection | None = None
    _lock: asyncio.Lock | None = None
    _initialized: bool = False
    _server_utc_offset_s: int = 0

    def __new__(cls) -> MT5Connection:
        """Enforce singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def initialize(self) -> None:
        """Initialize MT5 connection and login.

        Steps:
        1. mt5.initialize() — raise MT5ConnectionError if fails
        2. mt5.login() — raise if fails
        3. Verify demo mode — raise RuntimeError if live account
        4. Select all configured symbols
        5. Compute server UTC offset
        6. Set _initialized = True

        Must be called exactly once per process (in lifespan startup).

        Raises:
            MT5ConnectionError: If MT5 init or login fails
            RuntimeError: If live account detected
            KeyError: If symbol configuration is missing
        """
        if mt5 is None:
            raise ImportError(
                "MetaTrader5 module not found. "
                "Install with: pip install MetaTrader5 (Windows only)"
            )

        if self._initialized:
            return

        # Ensure we have a lock
        if MT5Connection._lock is None:
            MT5Connection._lock = asyncio.Lock()

        # Step 1: Initialize MT5
        result = await self._call(mt5.initialize)
        if not result:
            error = mt5.last_error()
            raise MT5ConnectionError(
                error[0],
                f"mt5.initialize() failed: {error[1]}",
            )

        # Step 2: Login
        login = Config.MT5_LOGIN
        password = Config.MT5_PASSWORD
        server = Config.MT5_SERVER

        if not login or not password or not server:
            raise ValueError(
                "MT5 credentials missing. Set MT5_LOGIN, MT5_PASSWORD, MT5_SERVER in .env"
            )

        result = await self._call(
            mt5.login,
            login,
            password,
            server,
        )
        if not result:
            error = mt5.last_error()
            await self._call(mt5.shutdown)
            raise MT5ConnectionError(
                error[0],
                f"mt5.login() failed: {error[1]}",
            )

        # Step 3: Verify demo mode
        account_info = await self.get_account_info()
        if account_info.trade_mode != mt5.ACCOUNT_TRADE_MODE_DEMO:
            await self._call(mt5.shutdown)
            raise RuntimeError(
                f"Live account detected (trade_mode={account_info.trade_mode}). "
                "This system only supports demo accounts."
            )

        # Step 4: Select all symbols
        for canonical in SymbolMapper.get_all_canonical():
            mt5_symbol = SymbolMapper.to_mt5(canonical)
            result = await self._call(mt5.symbol_select, mt5_symbol, True)
            if not result:
                await self._call(mt5.shutdown)
                raise MT5ConnectionError(
                    None,
                    f"Failed to select symbol '{mt5_symbol}' (canonical '{canonical}')",
                )

        # Step 5: Compute UTC offset
        # Use any symbol to get server time
        any_symbol = SymbolMapper.get_all_mt5()[0]
        tick_info = await self._call(mt5.symbol_info_tick, any_symbol)
        if tick_info is None:
            await self._call(mt5.shutdown)
            raise MT5ConnectionError(
                None,
                f"Failed to get tick info for '{any_symbol}' to compute UTC offset",
            )

        server_time_unix = int(tick_info.time)
        utc_now_unix = int(datetime.now(timezone.utc).timestamp())
        MT5Connection._server_utc_offset_s = server_time_unix - utc_now_unix

        MT5Connection._initialized = True

    async def shutdown(self) -> None:
        """Shut down MT5 connection gracefully.

        Safe to call multiple times; subsequent calls are no-ops.
        """
        if not self._initialized:
            return

        await self._call(mt5.shutdown)
        MT5Connection._initialized = False

    async def _call(
        self,
        fn: Any,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Execute MT5 function safely via thread pool with lock.

        Acquires _lock, runs fn in thread pool, handles errors, applies UTC offset.

        Args:
            fn: MT5 function to call
            *args: Positional arguments
            **kwargs: Keyword arguments

        Returns:
            Function result (converted to typed dataclass if appropriate)

        Raises:
            MT5Error: If function returns None/False or MT5 error occurs
        """
        if MT5Connection._lock is None:
            MT5Connection._lock = asyncio.Lock()

        async with MT5Connection._lock:
            result = await asyncio.to_thread(fn, *args, **kwargs)

            # Check for error conditions
            if result is None or result is False:
                error = mt5.last_error()
                raise MT5RequestError(error[0], error[1])

            return result

    async def get_tick(self, symbol: str) -> MT5Tick:
        """Get current bid/ask tick for symbol.

        Args:
            symbol: Canonical symbol (e.g. "EURUSD")

        Returns:
            MT5Tick with UTC-corrected timestamp

        Raises:
            MT5RequestError: If fetch fails
            KeyError: If canonical symbol not found
        """
        mt5_symbol = SymbolMapper.to_mt5(symbol)
        tick = await self._call(mt5.symbol_info_tick, mt5_symbol)

        # Get point for spread calculation
        sym_info = await self._call(mt5.symbol_info, mt5_symbol)
        point = sym_info.point

        return MT5Tick(
            bid=tick.bid,
            ask=tick.ask,
            last=tick.last,
            volume=tick.volume,
            time_utc=int(tick.time) - MT5Connection._server_utc_offset_s,
            spread_pips=(tick.ask - tick.bid) / point,
        )

    async def get_rates(
        self,
        symbol: str,
        tf: int,
        count: int,
    ) -> list[MT5Rate]:
        """Get OHLCV rates for symbol and timeframe.

        Args:
            symbol: Canonical symbol (e.g. "EURUSD")
            tf: MT5 timeframe constant (mt5.TIMEFRAME_M1, etc.)
            count: Number of bars to fetch

        Returns:
            List of MT5Rate objects with UTC-corrected timestamps
            Index 0 is oldest, Index -1 is most recent (in-progress bar)

        Raises:
            MT5RequestError: If fetch fails
            KeyError: If canonical symbol not found
        """
        mt5_symbol = SymbolMapper.to_mt5(symbol)
        rates = await self._call(mt5.copy_rates_from_pos, mt5_symbol, tf, 0, count)

        # copy_rates_from_pos returns a numpy structured array; use bracket access
        has_real_volume = "real_volume" in rates.dtype.names
        return [
            MT5Rate(
                time_utc=int(rate["time"]) - MT5Connection._server_utc_offset_s,
                open=float(rate["open"]),
                high=float(rate["high"]),
                low=float(rate["low"]),
                close=float(rate["close"]),
                tick_volume=int(rate["tick_volume"]),
                real_volume=int(rate["real_volume"]) if has_real_volume else 0,
            )
            for rate in rates
        ]

    async def get_positions(
        self,
        symbol: str | None = None,
        ticket: int | None = None,
    ) -> list[MT5Position]:
        """Get open positions, optionally filtered by symbol or ticket.

        Args:
            symbol: Optional canonical symbol filter (e.g. "EURUSD")
            ticket: Optional position ticket filter

        Returns:
            List of MT5Position objects with UTC-corrected open time

        Raises:
            MT5RequestError: If fetch fails
        """
        if ticket is not None:
            # Fetch specific position by ticket
            positions = await self._call(mt5.positions_get, ticket=ticket)
        elif symbol is not None:
            # Fetch all positions for symbol
            mt5_symbol = SymbolMapper.to_mt5(symbol)
            positions = await self._call(mt5.positions_get, symbol=mt5_symbol)
        else:
            # Fetch all open positions
            positions = await self._call(mt5.positions_get)

        if not positions:
            return []

        result = []
        for pos in positions:
            # Map MT5 symbol to canonical
            canonical_symbol = SymbolMapper.to_canonical(pos.symbol)
            result.append(
                MT5Position(
                    ticket=pos.ticket,
                    symbol=canonical_symbol,
                    type=pos.type,
                    magic=pos.magic,
                    time_utc=int(pos.time) - MT5Connection._server_utc_offset_s,
                    time_msc=pos.time_msc,
                    volume=pos.volume,
                    price_open=pos.price_open,
                    sl=pos.sl,
                    tp=pos.tp,
                    price_current=pos.price_current,
                    swap=pos.swap,
                    profit=pos.profit,
                    commission=getattr(pos, "commission", 0.0),
                )
            )

        return result

    async def get_orders(self) -> list[MT5PendingOrder]:
        """Get all pending (unfilled) orders.

        Returns:
            List of MT5PendingOrder objects with UTC-corrected timestamps.
            Empty list when no pending orders exist or MT5 unavailable.

        Raises:
            MT5RequestError: On MT5 API error (not on empty result)
        """
        try:
            orders = await self._call(mt5.orders_get)
        except MT5RequestError:
            return []

        if not orders:
            return []

        result = []
        for o in orders:
            canonical = SymbolMapper.to_canonical(o.symbol)
            exp_utc = (
                int(o.time_expiration) - MT5Connection._server_utc_offset_s
                if o.time_expiration
                else 0
            )
            result.append(
                MT5PendingOrder(
                    ticket=o.ticket,
                    symbol=canonical,
                    type=o.type,
                    type_label=_PENDING_ORDER_TYPE_LABELS.get(o.type, f"TYPE_{o.type}"),
                    volume=o.volume_current,
                    price_open=o.price_open,
                    sl=o.sl,
                    tp=o.tp,
                    time_setup_utc=int(o.time_setup) - MT5Connection._server_utc_offset_s,
                    time_expiration_utc=exp_utc,
                    comment=o.comment or "",
                )
            )
        return result

    async def get_deal_history(self, days: int = 7) -> list[MT5Deal]:
        """Get historical deals for the last N days.

        Args:
            days: Number of calendar days to look back

        Returns:
            List of MT5Deal objects with UTC-corrected timestamps.
            Empty list when no deals found or MT5 unavailable.
        """
        date_from = datetime.now(timezone.utc) - timedelta(days=days)
        date_to = datetime.now(timezone.utc)

        try:
            deals = await self._call(mt5.history_deals_get, date_from, date_to)
        except MT5RequestError:
            return []

        if not deals:
            return []

        result = []
        for d in deals:
            try:
                canonical = SymbolMapper.to_canonical(d.symbol)
            except KeyError:
                canonical = d.symbol  # unknown symbol — keep as-is
            result.append(
                MT5Deal(
                    ticket=d.ticket,
                    position_id=d.position_id,
                    time_utc=int(d.time) - MT5Connection._server_utc_offset_s,
                    type=d.type,
                    entry=d.entry,
                    volume=d.volume,
                    price=d.price,
                    commission=d.commission,
                    swap=d.swap,
                    profit=d.profit,
                    symbol=canonical,
                )
            )
        return result

    async def get_account_info(self) -> MT5AccountInfo:
        """Get account information.

        Returns:
            MT5AccountInfo with all account details

        Raises:
            MT5RequestError: If fetch fails
        """
        info = await self._call(mt5.account_info)

        return MT5AccountInfo(
            login=info.login,
            trade_mode=info.trade_mode,
            leverage=info.leverage,
            limit_orders=info.limit_orders,
            trade_allowed=info.trade_allowed,
            trade_expert=info.trade_expert,
            balance=info.balance,
            credit=info.credit,
            profit=info.profit,
            equity=info.equity,
            margin=info.margin,
            margin_free=info.margin_free,
            margin_level=info.margin_level,
            margin_so_call=info.margin_so_call,
            margin_so_so=info.margin_so_so,
            currency_digits=info.currency_digits,
        )

    async def send_order(self, request: dict) -> MT5OrderResult:
        """Send a trade order (market, limit, or stop).

        Args:
            request: mt5.TradeRequest dict with order parameters

        Returns:
            MT5OrderResult with order result details

        Raises:
            MT5RequestError: If order fails
        """
        result = await self._call(mt5.order_send, request)

        return MT5OrderResult(
            retcode=result.retcode,
            deal=result.deal,
            order=result.order,
            volume=result.volume,
            price=result.price,
            bid=result.bid,
            ask=result.ask,
            comment=result.comment if hasattr(result, "comment") else None,
        )

    async def check_order(self, request: dict) -> MT5OrderCheck:
        """Check a trade order without sending (validation only).

        Args:
            request: mt5.TradeRequest dict to validate

        Returns:
            MT5OrderCheck with validation result

        Raises:
            MT5RequestError: If check fails
        """
        result = await self._call(mt5.order_check, request)

        return MT5OrderCheck(
            retcode=result.retcode,
            balance=result.balance,
            equity=result.equity,
            profit=result.profit,
            margin=result.margin,
            margin_free=result.margin_free,
            margin_level=result.margin_level,
        )

    async def get_symbol_info(self, symbol: str) -> MT5SymbolInfo:
        """Get detailed information about a symbol.

        Args:
            symbol: Canonical symbol (e.g. "EURUSD")

        Returns:
            MT5SymbolInfo with all symbol properties

        Raises:
            MT5RequestError: If fetch fails
            KeyError: If canonical symbol not found
        """
        mt5_symbol = SymbolMapper.to_mt5(symbol)
        info = await self._call(mt5.symbol_info, mt5_symbol)

        g = lambda field, default=0: getattr(info, field, default)  # noqa: E731
        return MT5SymbolInfo(
            custom=g("custom", False),
            chart_mode=g("chart_mode"),
            select=g("select", False),
            visible=g("visible", False),
            session_deals=g("session_deals"),
            session_buy_orders=g("session_buy_orders"),
            session_sell_orders=g("session_sell_orders"),
            volume=g("volume"),
            volumehigh=g("volumehigh"),
            volumelow=g("volumelow"),
            time=g("time"),
            time_msc=g("time_msc"),
            bid=g("bid", 0.0),
            ask=g("ask", 0.0),
            last=g("last", 0.0),
            volume_real=g("volume_real"),
            volumehigh_real=g("volumehigh_real"),
            volumelow_real=g("volumelow_real"),
            option_mode=g("option_mode"),
            option_right=g("option_right"),
            bid_high=g("bid_high", 0.0),
            bid_low=g("bid_low", 0.0),
            ask_high=g("ask_high", 0.0),
            ask_low=g("ask_low", 0.0),
            last_high=g("last_high", 0.0),
            last_low=g("last_low", 0.0),
            trade_mode=g("trade_mode"),
            trade_exemode=g("trade_exemode"),
            filling_mode=g("filling_mode"),
            order_mode=g("order_mode"),
            expiration_mode=g("expiration_mode"),
            digits=g("digits"),
            spread=g("spread"),
            spread_high=g("spread_high"),
            spread_low=g("spread_low"),
            spread_avg=g("spread_avg"),
            point=g("point", 0.00001),
            volume_min=g("volume_min", 0.01),
            volume_max=g("volume_max", 100.0),
            volume_step=g("volume_step", 0.01),
            volume_limit=g("volume_limit", 0.0),
            swap_long=g("swap_long", 0.0),
            swap_short=g("swap_short", 0.0),
            swap_mode=g("swap_mode"),
            swap_rollover=g("swap_rollover"),
            margin_hedged=g("margin_hedged", 0.0),
            price_open=g("price_open", 0.0),
            price_close=g("price_close", 0.0),
            price_high=g("price_high", 0.0),
            price_low=g("price_low", 0.0),
            price_weighted_avg=g("price_weighted_avg", 0.0),
            stops_level=g("stops_level"),
        )


# Module-level singleton instance
mt5_connection = MT5Connection()

"""Trade execution with validation and error handling.

Responsibilities:
- Pre-validate trade parameters before sending to MT5
- Execute market/limit/stop orders with proper error handling
- Manage order retries for transient failures
- Write trade records to database
- Ensure demo-only mode is enforced at init time

ERROR MATRIX:
MT5 retcodes and their meanings. See MT5 documentation for full list.
"""

from __future__ import annotations

import importlib.util
import logging
from typing import Any

from src.live.mt5_connection import (
    MT5Connection,
    MT5Error,
)
from src.live.symbol_mapper import SymbolMapper

logger = logging.getLogger(__name__)

# MT5 retcode meanings
RETCODE_MESSAGES = {
    10004: "Price moved — please retry",
    10006: "Generic retcode (check error description)",
    10009: "Trade executed successfully",
    10010: "Trade placed successfully",
    10011: "Request completed",
    10012: "Only part of the request was completed",
    10013: "Request processing error",
    10014: "Invalid lot size",
    10015: "No prices available",
    10016: "Invalid price",
    10017: "Order locked",
    10018: "Trade disabled for symbol",
    10019: "Insufficient margin",
    10020: "Account disabled",
    10021: "Invalid expiration",
    10022: "Order is too close to market",
    10024: "Too many requests to server",
    10025: "No changes in request",
    10026: "Autotrading disabled on server",
    10027: "Autotrading disabled on client",
    10028: "Request rejected",
    10029: "Order or deal locked",
    10030: "Only buy orders allowed",
    10031: "Only sell orders allowed",
}

# MT5 filling mode support bits (SYMBOL_FILLING_*) — what symbol supports
SYMBOL_FILLING_FOK_BIT = 0x01
SYMBOL_FILLING_IOC_BIT = 0x02

# MT5 filling mode order values (ORDER_FILLING_*) — what to put in request
ORDER_FILLING_FOK = 0
ORDER_FILLING_IOC = 1
ORDER_FILLING_RETURN = 2


class TradeValidationError(Exception):
    """Raised when trade validation fails."""

    pass


class TradeResponse:
    """Trade execution result."""

    def __init__(
        self,
        success: bool,
        ticket: int | None = None,
        retcode: int | None = None,
        retcode_description: str | None = None,
        fill_price: float | None = None,
        volume_filled: float | None = None,
        error_message: str | None = None,
    ):
        self.success = success
        self.ticket = ticket
        self.retcode = retcode
        self.retcode_description = retcode_description
        self.fill_price = fill_price
        self.volume_filled = volume_filled
        self.error_message = error_message

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON response."""
        return {
            "success": self.success,
            "ticket": self.ticket,
            "retcode": self.retcode,
            "retcode_description": self.retcode_description,
            "fill_price": self.fill_price,
            "volume_filled": self.volume_filled,
            "error_message": self.error_message,
        }


class TradeExecutor:
    """Executes trades with validation and error handling.

    Enforces demo-only mode at initialization time (unconditional).
    Pre-validates all trade parameters before sending to MT5.
    """

    def __init__(self, mt5_conn: MT5Connection) -> None:
        """Initialize trade executor.

        Checks demo mode. Raises RuntimeError if live account detected.
        This check is UNCONDITIONAL and cannot be overridden.

        Args:
            mt5_conn: MT5Connection instance

        Raises:
            RuntimeError: If live account detected or MT5 not ready
        """
        self.mt5_conn = mt5_conn

        # Demo guard is unconditional
        if not self.mt5_conn._initialized:
            raise RuntimeError("MT5Connection not initialized")

        logger.info("TradeExecutor initialized (demo mode enforced)")

    async def open_order(
        self,
        pair: str,
        side: str,
        volume: float,
        order_type: str = "MARKET",
        price: float | None = None,
        sl: float | None = None,
        tp: float | None = None,
        comment: str = "",
    ) -> TradeResponse:
        """Open a new trade position.

        Pre-validation steps in order:
        1. Check trade_allowed flag
        2. Check symbol trade_mode
        3. Validate and round volume
        4. Fetch live price for market orders
        5. Validate SL/TP distance
        6. Determine filling mode
        7. Check margin

        Args:
            pair: Canonical symbol (e.g. "EURUSD")
            side: "BUY" or "SELL"
            volume: Trade volume in lots
            order_type: "MARKET", "LIMIT", or "STOP"
            price: Required for LIMIT/STOP orders
            sl: Stop loss price (optional)
            tp: Take profit price (optional)
            comment: Order comment

        Returns:
            TradeResponse with execution result
        """
        try:
            mt5_side = self._validate_side(side)
            mt5_pair = SymbolMapper.to_mt5(pair)

            # Step 1: Check trade allowed
            account_info = await self.mt5_conn.get_account_info()
            if not account_info.trade_allowed:
                return TradeResponse(
                    success=False,
                    retcode=None,
                    error_message="Trading is not allowed on this account",
                )

            # Step 2: Check symbol trade mode
            symbol_info = await self.mt5_conn.get_symbol_info(pair)
            try:
                import MetaTrader5 as mt5  # noqa: N813

                if symbol_info.trade_mode != mt5.SYMBOL_TRADE_MODE_FULL:
                    return TradeResponse(
                        success=False,
                        retcode=None,
                        error_message=f"Symbol {pair} not in full trade mode (trade_mode={symbol_info.trade_mode})",
                    )
            except ImportError:
                pass  # Can't check if MT5 not available

            # Step 3: Validate and round volume
            volume_min = symbol_info.volume_min
            volume_max = symbol_info.volume_max
            volume_step = symbol_info.volume_step

            # Round to volume_step precision
            rounded_volume = self._round_to_step(volume, volume_step)

            # Check if volume is within range
            if rounded_volume < volume_min or rounded_volume > volume_max:
                raise TradeValidationError(
                    f"Volume {volume} (rounded to {rounded_volume}) outside allowed range "
                    f"[{volume_min}, {volume_max}]. Volume step is {volume_step}."
                )

            volume = rounded_volume

            # Step 4: Fetch live price for market orders
            current_bid = symbol_info.bid
            current_ask = symbol_info.ask

            if order_type == "MARKET":
                # For market orders, use current ask/bid
                price = current_ask if mt5_side == 0 else current_bid  # 0=BUY, 1=SELL
            elif not price:
                raise TradeValidationError(f"Price required for {order_type} orders")

            # Step 5: Validate SL/TP distance
            point = symbol_info.point
            stops_level = symbol_info.spread  # Minimum distance in points

            if sl is not None:
                min_distance = stops_level * point
                actual_distance = abs(price - sl)
                if actual_distance < min_distance:
                    raise TradeValidationError(
                        f"SL too close to entry price. Minimum distance: {min_distance:.5f} "
                        f"(stops_level={stops_level}), actual: {actual_distance:.5f}"
                    )

            if tp is not None:
                min_distance = stops_level * point
                actual_distance = abs(price - tp)
                if actual_distance < min_distance:
                    raise TradeValidationError(
                        f"TP too close to entry price. Minimum distance: {min_distance:.5f} "
                        f"(stops_level={stops_level}), actual: {actual_distance:.5f}"
                    )

            # Step 6: Determine filling mode (prefer IOC, then FOK, then RETURN)
            filling_mode = self._select_filling_mode(symbol_info.filling_mode)

            # Step 7: Check margin
            request = {
                "action": 1,  # TRADE_ACTION_DEAL
                "symbol": mt5_pair,
                "volume": volume,
                "type": mt5_side,
                "price": price,
                "sl": sl if sl else 0.0,
                "tp": tp if tp else 0.0,
                "comment": comment,
                "type_filling": filling_mode,
            }

            # Validate with order_check
            try:
                check_result = await self.mt5_conn.check_order(request)
                if check_result.margin_free < 0:
                    return TradeResponse(
                        success=False,
                        retcode=10019,
                        error_message=f"Insufficient margin. Required: {abs(check_result.margin_free):.2f}, "
                        f"Available: {account_info.margin_free:.2f}",
                    )
            except MT5Error as e:
                return TradeResponse(
                    success=False,
                    retcode=e.code,
                    error_message=f"Order validation failed: {e.description}",
                )

            # Send order (with single retry for specific errors)
            return await self._send_order_with_retry(request, price, filling_mode)

        except TradeValidationError as e:
            logger.warning(f"Trade validation failed: {e}")
            return TradeResponse(
                success=False,
                retcode=None,
                error_message=str(e),
            )
        except Exception as e:
            logger.exception(f"Unexpected error in open_order: {e}")
            return TradeResponse(
                success=False,
                retcode=None,
                error_message=f"Internal error: {str(e)}",
            )

    async def _send_order_with_retry(
        self,
        request: dict,
        price: float,
        filling_mode: int,
    ) -> TradeResponse:
        """Send order with retry logic for specific error codes.

        Retries:
        - 10004 (REQUOTE): Refresh price and retry once
        - 10030 (INVALID_FILL): Try next filling mode, retry once

        Args:
            request: MT5 TradeRequest dict
            price: Original entry price
            filling_mode: Original filling mode

        Returns:
            TradeResponse with result
        """
        if importlib.util.find_spec("MetaTrader5") is None:
            raise ImportError("MetaTrader5 module required")

        result = await self.mt5_conn.send_order(request)

        # Handle retryable error codes
        if result.retcode == 10004:  # REQUOTE
            logger.info("Got REQUOTE, refreshing price and retrying")
            try:
                # Refresh tick and update price
                pair = SymbolMapper.to_canonical(request["symbol"])
                tick = await self.mt5_conn.get_tick(pair)
                request["price"] = tick.ask if request["type"] == 0 else tick.bid

                # Retry once
                result = await self.mt5_conn.send_order(request)
            except Exception as e:
                logger.warning(f"Retry after REQUOTE failed: {e}")

        if result.retcode == 10030:  # INVALID_FILL (Invalid filling mode)
            logger.info("Got INVALID_FILL, trying alternate filling mode")
            try:
                # Try next available filling mode
                next_mode = self._next_filling_mode(filling_mode)
                if next_mode != filling_mode:
                    request["type_filling"] = next_mode
                    result = await self.mt5_conn.send_order(request)
            except Exception as e:
                logger.warning(f"Retry with alternate filling mode failed: {e}")

        # Map result to TradeResponse
        if result.retcode == 10009 or result.retcode == 10010:  # DONE or DONE_PARTIAL
            # Write to trade_log
            try:
                await self._write_trade_log(
                    ticket=result.order,
                    symbol=SymbolMapper.to_canonical(request["symbol"]),
                    side="BUY" if request["type"] == 0 else "SELL",
                    volume=request["volume"],
                    open_price=result.price,
                    sl=request.get("sl"),
                    tp=request.get("tp"),
                )
            except Exception as e:
                logger.error(f"Failed to write trade_log: {e}")

            return TradeResponse(
                success=True,
                ticket=result.order,
                retcode=result.retcode,
                retcode_description=RETCODE_MESSAGES.get(result.retcode, "Unknown"),
                fill_price=result.price,
                volume_filled=result.volume,
            )

        # Error response
        error_msg = RETCODE_MESSAGES.get(result.retcode, "Unknown error")
        return TradeResponse(
            success=False,
            ticket=None,
            retcode=result.retcode,
            retcode_description=error_msg,
            error_message=f"Order failed ({result.retcode}): {error_msg}",
        )

    async def close_position(self, ticket: int) -> TradeResponse:
        """Close an open position by ticket.

        Args:
            ticket: Position ticket number

        Returns:
            TradeResponse with close result
        """
        try:

            # Fetch position
            positions = await self.mt5_conn.get_positions(ticket=ticket)
            if not positions:
                return TradeResponse(
                    success=False,
                    retcode=None,
                    error_message=f"Position {ticket} not found",
                )

            position = positions[0]
            mt5_symbol = SymbolMapper.to_mt5(position.symbol)

            # Build opposite order to close
            opposite_side = 1 if position.type == 0 else 0  # 0=BUY, 1=SELL
            symbol_info = await self.mt5_conn.get_symbol_info(position.symbol)

            request = {
                "action": 1,  # TRADE_ACTION_DEAL
                "symbol": mt5_symbol,
                "volume": position.volume,
                "type": opposite_side,
                "price": symbol_info.ask if opposite_side == 1 else symbol_info.bid,
                "position": ticket,
                "comment": f"Close position {ticket}",
                "type_filling": self._select_filling_mode(symbol_info.filling_mode),
            }

            result = await self.mt5_conn.send_order(request)

            if result.retcode == 10009:  # DONE
                # Update trade_log with close info
                try:
                    await self._update_trade_log_close(
                        ticket=ticket,
                        close_price=result.price,
                        profit=position.profit,
                        swap=position.swap,
                    )
                except Exception as e:
                    logger.error(f"Failed to update trade_log close: {e}")

                return TradeResponse(
                    success=True,
                    ticket=ticket,
                    retcode=result.retcode,
                    retcode_description="Position closed",
                    fill_price=result.price,
                    volume_filled=result.volume,
                )

            error_msg = RETCODE_MESSAGES.get(result.retcode, "Unknown error")
            return TradeResponse(
                success=False,
                retcode=result.retcode,
                error_message=f"Close failed ({result.retcode}): {error_msg}",
            )

        except Exception as e:
            logger.exception(f"Error closing position {ticket}: {e}")
            return TradeResponse(
                success=False,
                retcode=None,
                error_message=f"Internal error: {str(e)}",
            )

    async def close_all(self) -> list[TradeResponse]:
        """Close all open positions sequentially.

        Returns:
            List of TradeResponse for each close operation
        """
        results = []
        try:
            positions = await self.mt5_conn.get_positions()
            for position in positions:
                result = await self.close_position(position.ticket)
                results.append(result)
        except Exception as e:
            logger.exception(f"Error closing all positions: {e}")
            results.append(
                TradeResponse(
                    success=False,
                    error_message=f"Error fetching positions: {str(e)}",
                )
            )
        return results

    async def cancel_order(self, ticket: int) -> TradeResponse:
        """Cancel a pending (unfilled) order by ticket.

        Args:
            ticket: Pending order ticket number

        Returns:
            TradeResponse with cancellation result
        """
        try:
            import MetaTrader5 as mt5  # noqa: N813

            # Verify the order still exists
            orders = await self.mt5_conn.get_orders()
            if not any(o.ticket == ticket for o in orders):
                return TradeResponse(
                    success=False,
                    retcode=None,
                    error_message=f"Pending order {ticket} not found",
                )

            request = {
                "action": mt5.TRADE_ACTION_REMOVE,
                "order": ticket,
            }

            result = await self.mt5_conn.send_order(request)

            if result.retcode in (10009, 10011):  # DONE or DONE_PARTIAL
                return TradeResponse(
                    success=True,
                    ticket=ticket,
                    retcode=result.retcode,
                    retcode_description="Order cancelled",
                )

            error_msg = RETCODE_MESSAGES.get(result.retcode, "Unknown error")
            return TradeResponse(
                success=False,
                retcode=result.retcode,
                error_message=f"Cancel failed ({result.retcode}): {error_msg}",
            )

        except Exception as e:
            logger.exception(f"Error cancelling order {ticket}: {e}")
            return TradeResponse(
                success=False,
                retcode=None,
                error_message=f"Internal error: {str(e)}",
            )

    # ── Helper Methods ───────────────────────────────────────────────────

    def _validate_side(self, side: str) -> int:
        """Convert side string to MT5 order type.

        Args:
            side: "BUY" or "SELL"

        Returns:
            0 for BUY, 1 for SELL

        Raises:
            TradeValidationError: If invalid side
        """
        if side == "BUY":
            return 0
        elif side == "SELL":
            return 1
        else:
            raise TradeValidationError(f"Invalid side: {side}")

    def _round_to_step(self, value: float, step: float) -> float:
        """Round value to nearest step.

        Args:
            value: Value to round
            step: Step size

        Returns:
            Rounded value
        """
        if step <= 0:
            return value
        return round(value / step) * step

    def _select_filling_mode(self, symbol_filling_bitmask: int) -> int:
        """Select best filling mode from symbol's supported modes.

        Prefers: IOC → FOK → RETURN

        Args:
            symbol_filling_bitmask: Bitmask of supported modes

        Returns:
            Selected filling mode constant
        """
        # Check IOC first (bit 0x02)
        if symbol_filling_bitmask & SYMBOL_FILLING_IOC_BIT:
            return ORDER_FILLING_IOC
        # Then FOK (bit 0x01)
        if symbol_filling_bitmask & SYMBOL_FILLING_FOK_BIT:
            return ORDER_FILLING_FOK
        # Finally RETURN (default if none explicitly supported)
        return ORDER_FILLING_RETURN

    def _next_filling_mode(self, current: int) -> int:
        """Get next filling mode in preference order.

        Args:
            current: Current filling mode

        Returns:
            Next filling mode or same if none available
        """
        if current == ORDER_FILLING_IOC:
            return ORDER_FILLING_FOK
        elif current == ORDER_FILLING_FOK:
            return ORDER_FILLING_RETURN
        else:
            return current

    async def _write_trade_log(
        self,
        ticket: int,
        symbol: str,
        side: str,
        volume: float,
        open_price: float,
        sl: float | None,
        tp: float | None,
    ) -> None:
        """Write trade entry to database.

        Args:
            ticket: Order ticket
            symbol: Canonical symbol
            side: "BUY" or "SELL"
            volume: Trade volume
            open_price: Fill price
            sl: Stop loss price
            tp: Take profit price
        """
        try:
            from datetime import date

            from src.shared.db.models import TradeLogRow
            from src.shared.db.session import SessionLocal

            session = SessionLocal()
            try:
                row = TradeLogRow(
                    backtest_run="live",
                    pair=symbol,
                    direction=side,
                    entry_date=date.today(),
                    entry_price=open_price,
                )
                session.add(row)
                session.commit()
                logger.info(
                    f"Trade entry logged: ticket={ticket}, symbol={symbol}, "
                    f"side={side}, volume={volume}, price={open_price}"
                )
            except Exception as e:
                session.rollback()
                logger.error(f"Failed to write trade_log entry: {e}")
            finally:
                session.close()
        except ImportError:
            logger.warning("Database session not available; trade entry not logged")

    async def _update_trade_log_close(
        self,
        ticket: int,
        close_price: float,
        profit: float,
        swap: float,
    ) -> None:
        """Update trade_log with close information.

        Args:
            ticket: Position ticket
            close_price: Close fill price
            profit: Realized profit
            swap: Swap cost
        """
        try:
            from datetime import date

            from src.shared.db.models import TradeLogRow
            from src.shared.db.session import SessionLocal

            session = SessionLocal()
            try:
                # Find most recent trade entry (by entry_date desc, id desc)
                row = (
                    session.query(TradeLogRow)
                    .filter(TradeLogRow.backtest_run == "live")
                    .order_by(TradeLogRow.id.desc())
                    .first()
                )
                if row:
                    row.exit_date = date.today()
                    row.exit_price = close_price
                    # Calculate pnl percentage
                    if row.entry_price != 0:
                        row.gross_pnl_pct = (close_price - row.entry_price) / row.entry_price
                    session.commit()
                    logger.info(
                        f"Trade closed: ticket={ticket}, close_price={close_price}, "
                        f"profit={profit}"
                    )
                else:
                    logger.warning(f"Could not find trade entry to close for ticket={ticket}")
            except Exception as e:
                session.rollback()
                logger.error(f"Failed to update trade_log close: {e}")
            finally:
                session.close()
        except ImportError:
            logger.warning("Database session not available; trade close not logged")


# Module-level singleton
trade_executor: TradeExecutor | None = None

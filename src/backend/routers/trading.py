"""Router for trade execution and account queries."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import src.live.trade_executor as _te_module
from src.live.mt5_connection import mt5_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trade", tags=["trading"])


# ── Pydantic Models ───────────────────────────────────────────────────


class TradeRequest(BaseModel):
    """Trade execution request."""

    pair: str
    side: str  # "BUY" or "SELL"
    volume: float
    order_type: str = "MARKET"  # "MARKET", "LIMIT", or "STOP"
    price: float | None = None
    sl: float | None = None
    tp: float | None = None
    comment: str = ""

    model_config = {"str_strip_whitespace": True}


class TradeResponse(BaseModel):
    """Trade execution response."""

    success: bool
    ticket: int | None = None
    retcode: int | None = None
    retcode_description: str | None = None
    fill_price: float | None = None
    volume_filled: float | None = None
    error_message: str | None = None


class PositionResponse(BaseModel):
    """Open position details."""

    ticket: int
    symbol: str
    side: str
    volume: float
    open_price: float
    current_price: float
    sl: float
    tp: float
    profit: float
    swap: float
    open_time: str


class AccountResponse(BaseModel):
    """Account information."""

    balance: float
    equity: float
    margin: float
    margin_free: float
    margin_level: float
    profit: float
    login: int
    leverage: int


class DealResponse(BaseModel):
    """Historical deal/trade record."""

    ticket: int
    symbol: str
    side: str
    volume: float
    entry_price: float
    exit_price: float | None
    entry_time: str
    exit_time: str | None
    profit: float
    swap: float


class PendingOrderResponse(BaseModel):
    """Pending (unfilled) limit or stop order."""

    ticket: int
    symbol: str
    type: str  # "BUY_LIMIT", "SELL_LIMIT", "BUY_STOP", "SELL_STOP", etc.
    volume: float
    price: float  # Trigger price
    sl: float
    tp: float
    time_setup: str  # ISO datetime when the order was placed


# ── Endpoints ───────────────────────────────────────────────────────


@router.post("/open", response_model=TradeResponse)
async def open_trade(request: TradeRequest) -> dict[str, Any]:
    """Open a new trade position.

    Args:
        request: TradeRequest with symbol, side, volume, etc.

    Returns:
        TradeResponse with execution result

    Raises:
        HTTPException: If trade executor not initialized or MT5 error
    """
    if _te_module.trade_executor is None:
        raise HTTPException(
            status_code=503,
            detail="Trading not available (TradeExecutor not initialized)",
        )

    try:
        result = await _te_module.trade_executor.open_order(
            pair=request.pair,
            side=request.side,
            volume=request.volume,
            order_type=request.order_type,
            price=request.price,
            sl=request.sl,
            tp=request.tp,
            comment=request.comment,
        )
        return result.to_dict()

    except Exception as e:
        logger.exception(f"Error opening trade: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Trade execution error: {str(e)}",
        ) from e


@router.post("/close/{ticket}", response_model=TradeResponse)
async def close_trade(ticket: int) -> dict[str, Any]:
    """Close an open position.

    Args:
        ticket: Position ticket number

    Returns:
        TradeResponse with close result

    Raises:
        HTTPException: If position not found or close fails
    """
    if _te_module.trade_executor is None:
        raise HTTPException(
            status_code=503,
            detail="Trading not available (TradeExecutor not initialized)",
        )

    try:
        result = await _te_module.trade_executor.close_position(ticket)
        if not result.success:
            raise HTTPException(status_code=400, detail=result.error_message)
        return result.to_dict()

    except Exception as e:
        logger.exception(f"Error closing trade {ticket}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Close execution error: {str(e)}",
        ) from e


@router.post("/close-all", response_model=list[TradeResponse])
async def close_all_trades() -> list[dict[str, Any]]:
    """Close all open positions.

    Returns:
        List of TradeResponse for each closed position

    Raises:
        HTTPException: If execution fails
    """
    if _te_module.trade_executor is None:
        raise HTTPException(
            status_code=503,
            detail="Trading not available (TradeExecutor not initialized)",
        )

    try:
        results = await _te_module.trade_executor.close_all()
        return [r.to_dict() for r in results]

    except Exception as e:
        logger.exception(f"Error closing all trades: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Close all execution error: {str(e)}",
        ) from e


@router.get("/positions", response_model=list[PositionResponse])
async def get_positions() -> list[dict[str, Any]]:
    """Get all open positions.

    Returns:
        List of open positions with current details

    Raises:
        HTTPException: If MT5 error occurs
    """
    try:
        positions = await mt5_connection.get_positions()
        return [
            {
                "ticket": p.ticket,
                "symbol": p.symbol,
                "side": "BUY" if p.type == 0 else "SELL",
                "volume": p.volume,
                "open_price": p.price_open,
                "current_price": p.price_current,
                "sl": p.sl,
                "tp": p.tp,
                "profit": p.profit,
                "swap": p.swap,
                "open_time": datetime.fromtimestamp(p.time_utc, tz=timezone.utc).isoformat(),
            }
            for p in positions
        ]

    except Exception as e:
        logger.exception(f"Error fetching positions: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"MT5 error: {str(e)}",
        ) from e


@router.get("/account", response_model=AccountResponse)
async def get_account() -> dict[str, Any]:
    """Get account information.

    Returns:
        Current account balance, equity, margin, etc.

    Raises:
        HTTPException: If MT5 error occurs
    """
    try:
        account = await mt5_connection.get_account_info()
        return {
            "balance": account.balance,
            "equity": account.equity,
            "margin": account.margin,
            "margin_free": account.margin_free,
            "margin_level": account.margin_level,
            "profit": account.profit,
            "login": account.login,
            "leverage": account.leverage,
        }

    except Exception as e:
        logger.exception(f"Error fetching account info: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"MT5 error: {str(e)}",
        ) from e


@router.get("/history", response_model=list[DealResponse])
async def get_history(days: int = 30) -> list[dict[str, Any]]:
    """Get closed position history from MT5 deal history.

    Groups entry+exit deals by position_id. Only complete round-trips
    (positions with both an opening and closing deal) are returned.

    Args:
        days: Number of calendar days to look back (default 30)

    Returns:
        List of closed positions sorted by entry time descending

    Raises:
        HTTPException: If MT5 is unavailable
    """
    try:
        deals = await mt5_connection.get_deal_history(days)
    except Exception as e:
        logger.exception(f"Error fetching deal history: {e}")
        raise HTTPException(status_code=503, detail=f"MT5 error: {str(e)}")

    # Group by position_id; only include actual trade legs (entry 0=in, 1=out)
    position_deals: defaultdict[int, list] = defaultdict(list)
    for deal in deals:
        if deal.position_id > 0 and deal.entry in (0, 1):
            position_deals[deal.position_id].append(deal)

    results = []
    for pos_id, pos_deals in position_deals.items():
        entry_deal = next((d for d in pos_deals if d.entry == 0), None)
        exit_deal = next((d for d in pos_deals if d.entry == 1), None)

        if entry_deal is None or exit_deal is None:
            continue  # skip open positions and deals with no matching pair

        total_profit = sum(d.profit + d.commission + d.swap for d in pos_deals)
        total_swap = sum(d.swap for d in pos_deals)

        results.append(
            {
                "ticket": pos_id,
                "symbol": entry_deal.symbol,
                "side": "BUY" if entry_deal.type == 0 else "SELL",
                "volume": entry_deal.volume,
                "entry_price": entry_deal.price,
                "exit_price": exit_deal.price,
                "entry_time": datetime.fromtimestamp(
                    entry_deal.time_utc, tz=timezone.utc
                ).isoformat(),
                "exit_time": datetime.fromtimestamp(
                    exit_deal.time_utc, tz=timezone.utc
                ).isoformat(),
                "profit": total_profit,
                "swap": total_swap,
            }
        )

    results.sort(key=lambda x: x["entry_time"], reverse=True)
    return results


@router.get("/orders", response_model=list[PendingOrderResponse])
async def get_orders() -> list[dict[str, Any]]:
    """Get all pending (unfilled) limit and stop orders.

    Returns:
        List of pending orders from MT5

    Raises:
        HTTPException: If MT5 error occurs
    """
    try:
        orders = await mt5_connection.get_orders()
        return [
            {
                "ticket": o.ticket,
                "symbol": o.symbol,
                "type": o.type_label,
                "volume": o.volume,
                "price": o.price_open,
                "sl": o.sl,
                "tp": o.tp,
                "time_setup": datetime.fromtimestamp(o.time_setup_utc, tz=timezone.utc).isoformat(),
            }
            for o in orders
        ]
    except Exception as e:
        logger.exception(f"Error fetching pending orders: {e}")
        raise HTTPException(status_code=503, detail=f"MT5 error: {str(e)}")


@router.delete("/orders/{ticket}", response_model=TradeResponse)
async def cancel_order(ticket: int) -> dict[str, Any]:
    """Cancel a pending (unfilled) order.

    Args:
        ticket: Pending order ticket number

    Returns:
        TradeResponse with cancellation result

    Raises:
        HTTPException: If trade executor not initialized or MT5 error
    """
    if _te_module.trade_executor is None:
        raise HTTPException(
            status_code=503,
            detail="Trading not available (TradeExecutor not initialized)",
        )

    try:
        result = await _te_module.trade_executor.cancel_order(ticket)
        return result.to_dict()
    except Exception as e:
        logger.exception(f"Error cancelling order {ticket}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Cancel execution error: {str(e)}",
        ) from e

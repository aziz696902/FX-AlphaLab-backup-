"""Unit tests for TradeExecutor pre-validation logic.

Tests cover:
- Demo guard (unconditional at init)
- Volume rounding to volume_step
- Stops level validation for SL/TP
- Filling mode selection from symbol bitmask
- Account validation (trade_allowed)
- Symbol validation (trade_mode)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, Mock

import pytest

from src.live.mt5_connection import (
    MT5Connection,
)
from src.live.trade_executor import (
    ORDER_FILLING_FOK,
    ORDER_FILLING_IOC,
    ORDER_FILLING_RETURN,
    TradeExecutor,
    TradeValidationError,
)


class TestTradeExecutorDemoGuard:
    """Test demo-only mode enforcement."""

    def test_init_fails_when_mt5_not_initialized(self):
        """Demo guard raises RuntimeError if MT5Connection not initialized."""
        # Create a mock MT5Connection that is NOT initialized
        mock_conn = Mock(spec=MT5Connection)
        mock_conn._initialized = False

        with pytest.raises(RuntimeError, match="MT5Connection not initialized"):
            TradeExecutor(mock_conn)

    def test_init_succeeds_when_mt5_initialized(self):
        """Demo guard passes if MT5Connection is initialized."""
        mock_conn = Mock(spec=MT5Connection)
        mock_conn._initialized = True

        # Should not raise
        executor = TradeExecutor(mock_conn)
        assert executor is not None


class TestTradeExecutorVolume:
    """Test volume rounding and validation."""

    @pytest.fixture
    def executor(self):
        """Create executor with mock MT5Connection."""
        mock_conn = Mock(spec=MT5Connection)
        mock_conn._initialized = True
        return TradeExecutor(mock_conn)

    def test_round_to_step_basic(self, executor):
        """Volume is rounded to volume_step precision."""
        # 0.15 rounded to step 0.01 = 0.15
        result = executor._round_to_step(0.15, 0.01)
        assert result == 0.15

        # 0.156 rounded to step 0.01 = 0.16
        result = executor._round_to_step(0.156, 0.01)
        assert result == 0.16

        # 0.154 rounded to step 0.01 = 0.15
        result = executor._round_to_step(0.154, 0.01)
        assert result == 0.15

    def test_round_to_step_zero_step(self, executor):
        """If step is 0 or negative, volume unchanged."""
        assert executor._round_to_step(0.156, 0) == 0.156
        assert executor._round_to_step(0.156, -0.01) == 0.156

    def test_round_to_step_large_step(self, executor):
        """Large step sizes work correctly."""
        result = executor._round_to_step(1.5, 1.0)
        assert result == 2.0

    @pytest.mark.asyncio
    async def test_volume_outside_range_raises_error(self, executor):
        """Volume outside [min, max] raises TradeValidationError."""
        mock_account = AsyncMock()
        mock_account.trade_allowed = True

        mock_symbol = AsyncMock()
        mock_symbol.bid = 1.08500
        mock_symbol.ask = 1.08512
        mock_symbol.volume_min = 0.01
        mock_symbol.volume_max = 100.0
        mock_symbol.volume_step = 0.01
        mock_symbol.spread = 50
        mock_symbol.point = 0.0001
        mock_symbol.filling_mode = 0x02  # IOC support bit
        mock_symbol.trade_mode = 1  # SYMBOL_TRADE_MODE_FULL

        executor.mt5_conn.get_account_info = AsyncMock(return_value=mock_account)
        executor.mt5_conn.get_symbol_info = AsyncMock(return_value=mock_symbol)
        executor.mt5_conn.check_order = AsyncMock(return_value=Mock(margin_free=1000.0))

        # Volume too small: 0.005 rounds to 0.00, which is < 0.01 min
        result = await executor.open_order(
            pair="EURUSD",
            side="BUY",
            volume=0.005,
        )
        assert result.success is False
        assert "outside allowed range" in result.error_message


class TestTradeExecutorStopsLevel:
    """Test SL/TP distance validation against stops_level."""

    @pytest.fixture
    def executor(self):
        """Create executor with mock MT5Connection."""
        mock_conn = Mock(spec=MT5Connection)
        mock_conn._initialized = True
        return TradeExecutor(mock_conn)

    @pytest.mark.asyncio
    async def test_sl_too_close_raises_error(self, executor):
        """SL closer than stops_level * point raises error."""
        mock_account = AsyncMock()
        mock_account.trade_allowed = True

        # Entry price: 1.08500
        # Stops level: 50 points = 50 * 0.0001 = 0.005
        # SL at 1.08450 = 0.005 distance, but this equals minimum, not exceeds it
        # SL at 1.08499 = 0.001 distance, which is < minimum
        mock_symbol = AsyncMock()
        mock_symbol.bid = 1.08500
        mock_symbol.ask = 1.08512
        mock_symbol.volume_min = 0.01
        mock_symbol.volume_max = 100.0
        mock_symbol.volume_step = 0.01
        mock_symbol.spread = 50  # Stops level in points
        mock_symbol.point = 0.0001
        mock_symbol.filling_mode = 0x02  # IOC support bit
        mock_symbol.trade_mode = 1

        executor.mt5_conn.get_account_info = AsyncMock(return_value=mock_account)
        executor.mt5_conn.get_symbol_info = AsyncMock(return_value=mock_symbol)

        # SL at 1.08499 is too close (0.001 < 0.005 minimum)
        result = await executor.open_order(
            pair="EURUSD",
            side="BUY",
            volume=0.01,
            order_type="MARKET",
            sl=1.08499,
        )
        assert result.success is False
        assert "too close" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_sl_at_minimum_distance_accepted(self, executor):
        """SL at exactly stops_level * point is accepted."""
        mock_account = AsyncMock()
        mock_account.trade_allowed = True

        # Entry price (ask for BUY): 1.08512, stops_level = 50 points = 50 * 0.0001 = 0.005
        # SL at 1.08012 = exactly 0.005 distance (1.08512 - 1.08012 = 0.005)
        mock_symbol = AsyncMock()
        mock_symbol.bid = 1.08500
        mock_symbol.ask = 1.08512
        mock_symbol.volume_min = 0.01
        mock_symbol.volume_max = 100.0
        mock_symbol.volume_step = 0.01
        mock_symbol.spread = 50
        mock_symbol.point = 0.0001
        mock_symbol.filling_mode = 0x01
        mock_symbol.trade_mode = 1

        executor.mt5_conn.get_account_info = AsyncMock(return_value=mock_account)
        executor.mt5_conn.get_symbol_info = AsyncMock(return_value=mock_symbol)
        executor.mt5_conn.check_order = AsyncMock(return_value=Mock(margin_free=1000.0))
        executor.mt5_conn.send_order = AsyncMock(
            return_value=Mock(retcode=10009, order=12345, price=1.08512, volume=0.01)
        )
        executor._write_trade_log = AsyncMock()

        # SL at 1.08012 = exactly 0.005 distance from entry ask (should pass)
        result = await executor.open_order(
            pair="EURUSD",
            side="BUY",
            volume=0.01,
            order_type="MARKET",
            sl=1.08012,
        )
        # Should succeed (check_order passed)
        assert result.error_message is None or "too close" not in result.error_message.lower()


class TestTradeExecutorFillingMode:
    """Test filling mode selection from symbol bitmask."""

    @pytest.fixture
    def executor(self):
        """Create executor with mock MT5Connection."""
        mock_conn = Mock(spec=MT5Connection)
        mock_conn._initialized = True
        return TradeExecutor(mock_conn)

    def test_select_filling_mode_prefers_ioc(self, executor):
        """If IOC available, select it."""
        # Bitmask: FOK=0x01, IOC=0x02, RETURN=0x04
        bitmask = 0x01 | 0x02 | 0x04  # All available
        result = executor._select_filling_mode(bitmask)
        assert result == ORDER_FILLING_IOC

    def test_select_filling_mode_fallback_to_fok(self, executor):
        """If IOC not available but FOK is, select FOK."""
        # Only FOK and RETURN bits set
        bitmask = 0x01 | 0x04
        result = executor._select_filling_mode(bitmask)
        assert result == ORDER_FILLING_FOK

    def test_select_filling_mode_fallback_to_return(self, executor):
        """If only RETURN available, select it."""
        bitmask = 0x04
        result = executor._select_filling_mode(bitmask)
        assert result == ORDER_FILLING_RETURN

    def test_next_filling_mode_sequence(self, executor):
        """_next_filling_mode cycles through preference order."""
        assert executor._next_filling_mode(ORDER_FILLING_IOC) == ORDER_FILLING_FOK
        assert executor._next_filling_mode(ORDER_FILLING_FOK) == ORDER_FILLING_RETURN
        assert executor._next_filling_mode(ORDER_FILLING_RETURN) == ORDER_FILLING_RETURN


class TestTradeExecutorAccountValidation:
    """Test account and symbol validation."""

    @pytest.fixture
    def executor(self):
        """Create executor with mock MT5Connection."""
        mock_conn = Mock(spec=MT5Connection)
        mock_conn._initialized = True
        return TradeExecutor(mock_conn)

    @pytest.mark.asyncio
    async def test_trade_not_allowed_raises_error(self, executor):
        """If trade_allowed=False, order fails."""
        mock_account = AsyncMock()
        mock_account.trade_allowed = False

        executor.mt5_conn.get_account_info = AsyncMock(return_value=mock_account)

        result = await executor.open_order(
            pair="EURUSD",
            side="BUY",
            volume=0.01,
        )
        assert result.success is False
        assert "not allowed" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_symbol_not_in_full_trade_mode_fails(self, executor):
        """If symbol trade_mode != FULL, order fails."""
        mock_account = AsyncMock()
        mock_account.trade_allowed = True

        mock_symbol = AsyncMock()
        mock_symbol.trade_mode = 0  # Not SYMBOL_TRADE_MODE_FULL (which is 1)

        executor.mt5_conn.get_account_info = AsyncMock(return_value=mock_account)
        executor.mt5_conn.get_symbol_info = AsyncMock(return_value=mock_symbol)

        result = await executor.open_order(
            pair="EURUSD",
            side="BUY",
            volume=0.01,
        )
        assert result.success is False
        assert "not in full trade mode" in result.error_message.lower()


class TestTradeExecutorSide:
    """Test side validation."""

    @pytest.fixture
    def executor(self):
        """Create executor with mock MT5Connection."""
        mock_conn = Mock(spec=MT5Connection)
        mock_conn._initialized = True
        return TradeExecutor(mock_conn)

    def test_validate_side_buy(self, executor):
        """BUY side converts to 0."""
        result = executor._validate_side("BUY")
        assert result == 0

    def test_validate_side_sell(self, executor):
        """SELL side converts to 1."""
        result = executor._validate_side("SELL")
        assert result == 1

    def test_validate_side_invalid(self, executor):
        """Invalid side raises TradeValidationError."""
        with pytest.raises(TradeValidationError):
            executor._validate_side("INVALID")

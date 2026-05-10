"""Symbol mapping between canonical and MT5 broker symbols.

Reads config/mt5_symbols.yaml on import. Provides bidirectional mapping
between canonical symbols (e.g. "EURUSD") and broker-specific MT5 symbols.
"""

from __future__ import annotations

import yaml

from src.shared.config import Config


class SymbolMapper:
    """Bidirectional symbol mapping for MT5 broker symbols.

    Loads symbol configuration from config/mt5_symbols.yaml on first use.
    Ensures consistent naming across the live trading layer.
    """

    _config: dict | None = None
    _broker: str | None = None
    _canonical_to_mt5: dict[str, str] | None = None
    _mt5_to_canonical: dict[str, str] | None = None

    @classmethod
    def _load_config(cls) -> None:
        """Load MT5 symbol configuration from YAML file."""
        if cls._config is not None:
            return

        config_path = Config.ROOT_DIR / "config" / "mt5_symbols.yaml"
        if not config_path.exists():
            raise FileNotFoundError(
                f"MT5 symbol config not found at {config_path}. "
                "Create it with canonical symbols mapped to your broker's MT5 names."
            )

        with open(config_path) as f:
            cls._config = yaml.safe_load(f)

        if not cls._config:
            raise ValueError(f"MT5 symbol config at {config_path} is empty")

        cls._broker = cls._config.get("broker")
        if not cls._broker:
            raise ValueError("MT5 symbol config must specify 'broker' field")

        symbol_map = cls._config.get("symbol_map", {})
        if cls._broker not in symbol_map:
            raise ValueError(
                f"Broker '{cls._broker}' not configured in symbol_map. "
                f"Available brokers: {list(symbol_map.keys())}"
            )

        # Build bidirectional mapping for current broker
        broker_symbols = symbol_map[cls._broker]
        cls._canonical_to_mt5 = dict(broker_symbols)
        cls._mt5_to_canonical = {v: k for k, v in broker_symbols.items()}

    @classmethod
    def to_mt5(cls, canonical: str) -> str:
        """Convert canonical symbol name to MT5 broker symbol.

        Args:
            canonical: Canonical symbol name (e.g. "EURUSD")

        Returns:
            MT5 broker-specific symbol name (e.g. "EURUSDm" for Exness)

        Raises:
            KeyError: If canonical symbol not in mapping
        """
        cls._load_config()
        if canonical not in cls._canonical_to_mt5:
            raise KeyError(
                f"Canonical symbol '{canonical}' not found in MT5 config for broker '{cls._broker}'. "
                f"Available symbols: {sorted(cls._canonical_to_mt5.keys())}"
            )
        return cls._canonical_to_mt5[canonical]

    @classmethod
    def to_canonical(cls, mt5_symbol: str) -> str:
        """Convert MT5 broker symbol to canonical name.

        Args:
            mt5_symbol: MT5 broker-specific symbol name (e.g. "EURUSDm")

        Returns:
            Canonical symbol name (e.g. "EURUSD")

        Raises:
            KeyError: If MT5 symbol not in reverse mapping
        """
        cls._load_config()
        if mt5_symbol not in cls._mt5_to_canonical:
            raise KeyError(
                f"MT5 symbol '{mt5_symbol}' not found in reverse mapping for broker '{cls._broker}'. "
                f"Available symbols: {sorted(cls._mt5_to_canonical.keys())}"
            )
        return cls._mt5_to_canonical[mt5_symbol]

    @classmethod
    def get_all_canonical(cls) -> list[str]:
        """Get list of all configured canonical symbols.

        Returns:
            Sorted list of canonical symbol names
        """
        cls._load_config()
        return sorted(cls._canonical_to_mt5.keys())

    @classmethod
    def get_all_mt5(cls) -> list[str]:
        """Get list of all configured MT5 symbols for current broker.

        Returns:
            Sorted list of MT5 symbol names
        """
        cls._load_config()
        return sorted(cls._mt5_to_canonical.keys())

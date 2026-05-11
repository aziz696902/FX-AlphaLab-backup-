"""MT5 credential verifier — run only as a subprocess, never imported directly.

Reads a JSON object from stdin:
  {"login": 12345678, "password": "...", "server": "Exness-MT5Trial16"}

Writes a JSON object to stdout:
  On success: {"login": 12345678, "server": "...", "name": "...", "currency": "USD",
               "leverage": 2000, "balance": 10000.0, "equity": 10000.0,
               "margin": 0.0, "margin_free": 10000.0, "account_type": "demo"}
  On failure: {"error": "<reason>"}

Exit code: 0 on success, 1 on error.

Security: password is read from stdin only — never in argv, never logged, never stored.
"""

from __future__ import annotations

import json
import sys


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read())
        login: int = int(payload["login"])
        password: str = payload["password"]
        server: str = payload["server"]
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        sys.stdout.write(json.dumps({"error": f"Invalid input: {exc}"}))
        sys.exit(1)

    try:
        import MetaTrader5 as mt5  # noqa: N813
    except ImportError:
        sys.stdout.write(json.dumps({"error": "MetaTrader5 not installed"}))
        sys.exit(1)

    if not mt5.initialize():
        err = mt5.last_error()
        sys.stdout.write(json.dumps({"error": f"MT5 initialize failed: {err[1]}"}))
        sys.exit(1)

    if not mt5.login(login, password=password, server=server):
        err = mt5.last_error()
        mt5.shutdown()
        sys.stdout.write(json.dumps({"error": f"Login failed: {err[1]}"}))
        sys.exit(1)

    info = mt5.account_info()
    mt5.shutdown()

    if info is None:
        sys.stdout.write(json.dumps({"error": "account_info() returned None"}))
        sys.exit(1)

    trade_mode = {0: "demo", 1: "contest", 2: "real"}

    sys.stdout.write(
        json.dumps(
            {
                "login": info.login,
                "server": info.server,
                "name": info.name,
                "currency": info.currency,
                "leverage": info.leverage,
                "balance": info.balance,
                "equity": info.equity,
                "margin": info.margin,
                "margin_free": info.margin_free,
                "account_type": trade_mode.get(info.trade_mode, "unknown"),
            }
        )
    )
    sys.exit(0)


if __name__ == "__main__":
    main()

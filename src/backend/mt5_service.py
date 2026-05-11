"""MT5 credential verification service.

Spawns an isolated subprocess to verify MT5 credentials without touching the
main process's MT5 connection (the system trading connection must never be
interrupted by user authentication flows).

Password is passed via stdin only — never in argv, environment, or logs.
"""

from __future__ import annotations

import json
import logging
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_VERIFIER = Path(__file__).parent / "mt5_verifier_script.py"
_TIMEOUT_S = 30


@dataclass(frozen=True)
class MT5VerificationResult:
    login: int
    server: str
    name: str
    currency: str
    leverage: int
    balance: float
    equity: float
    margin: float
    margin_free: float
    account_type: str  # "demo" | "contest" | "real"


def verify_mt5_credentials(
    login: int,
    password: str,
    server: str,
) -> MT5VerificationResult:
    """Verify MT5 credentials in a subprocess and return account snapshot.

    Raises:
        ValueError: If credentials are invalid or MT5 cannot authenticate.
        RuntimeError: If the subprocess fails unexpectedly.
    """
    payload = json.dumps({"login": login, "password": password, "server": server})

    try:
        proc = subprocess.run(
            [sys.executable, str(_VERIFIER)],
            input=payload,
            capture_output=True,
            text=True,
            timeout=_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("MT5 verification timed out — is the terminal running?") from exc
    except OSError as exc:
        raise RuntimeError(f"Failed to spawn MT5 verifier subprocess: {exc}") from exc

    stdout = proc.stdout.strip()
    if not stdout:
        stderr = proc.stderr.strip()
        raise RuntimeError(f"MT5 verifier produced no output. stderr: {stderr!r}")

    try:
        result = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"MT5 verifier returned invalid JSON: {stdout!r}") from exc

    if "error" in result:
        raise ValueError(result["error"])

    try:
        return MT5VerificationResult(
            login=int(result["login"]),
            server=result["server"],
            name=result["name"],
            currency=result["currency"],
            leverage=int(result["leverage"]),
            balance=float(result["balance"]),
            equity=float(result["equity"]),
            margin=float(result["margin"]),
            margin_free=float(result["margin_free"]),
            account_type=result["account_type"],
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise RuntimeError(f"MT5 verifier returned unexpected schema: {result}") from exc

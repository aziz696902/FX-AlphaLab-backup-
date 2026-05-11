"""MT5 account linking schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MT5ConnectRequest(BaseModel):
    mt5_login: int = Field(gt=0, description="MT5 account number")
    mt5_password: str = Field(min_length=1, description="MT5 account password (never stored)")
    mt5_server: str = Field(min_length=1, description="MT5 broker server name")


class MT5AccountSnapshot(BaseModel):
    mt5_login: int
    mt5_server: str
    mt5_name: str | None
    mt5_currency: str | None
    mt5_leverage: int | None
    mt5_account_type: str | None
    connected_at: datetime
    last_verified_at: datetime

    model_config = {"from_attributes": True}


class MT5StatusResponse(BaseModel):
    connected: bool
    account: MT5AccountSnapshot | None = None

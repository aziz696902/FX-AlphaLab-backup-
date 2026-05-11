from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class NarrateRequest(BaseModel):
    context: dict[str, Any]


class NarrateResponse(BaseModel):
    narrative: str

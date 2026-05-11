"""Pydantic schemas for the chat endpoint."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, field_validator


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v


class ChatRequest(BaseModel):
    """Full conversation history sent by the client on every turn.

    The server is stateless — the client owns the message list and sends
    it in full on each request.  This matches the Gemini multi-turn API
    and keeps the backend simple.
    """

    messages: list[ChatMessage]

    @field_validator("messages")
    @classmethod
    def at_least_one_message(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        if not v:
            raise ValueError("messages must contain at least one entry")
        return v

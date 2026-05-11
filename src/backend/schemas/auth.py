"""Auth request/response schemas."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

_PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$")


def _validate_strong_password(value: str) -> str:
    if not _PASSWORD_PATTERN.match(value):
        raise ValueError("Password must include upper, lower, number, and symbol")
    return value


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)
    full_name: str | None = None
    role: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_strong_password(value)


class SignupPendingResponse(BaseModel):
    requires_verification: bool = True
    email: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=12)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_strong_password(value)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    role: str
    tier: str = "free"
    is_active: bool
    email_verified_at: datetime | None = None
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=12)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str | None) -> str | None:
        if value is not None:
            return _validate_strong_password(value)
        return value


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserResponse


class DevTierRequest(BaseModel):
    tier: str = Field(pattern=r"^(free|pro|elite)$")

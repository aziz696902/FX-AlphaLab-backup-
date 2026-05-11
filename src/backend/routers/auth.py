"""Auth endpoints for login, signup, email verification, and password reset."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.backend.dependencies import get_db
from src.backend.email_service import (
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)
from src.backend.schemas.auth import (
    DevTierRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SignupPendingResponse,
    SignupRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from src.backend.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    hash_token,
    verify_password,
)
from src.shared.db.models import EmailVerificationToken, RefreshToken, UserAccount

router = APIRouter(prefix="/auth", tags=["auth"])

_VERIFY_TTL = timedelta(hours=24)
_RESET_TTL = timedelta(minutes=15)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _generate_token() -> tuple[str, str]:
    """Return (raw_token, token_hash). Store hash; send raw in email."""
    raw = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def _issue_tokens(db: Session, user: UserAccount) -> TokenResponse:
    access_token, access_expires = create_access_token(user)
    refresh_token, jti, refresh_expires_at = create_refresh_token(user)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            jti=jti,
            expires_at=refresh_expires_at,
        )
    )
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in_seconds=access_expires,
        user=UserResponse.model_validate(user),
    )


def _create_verification_token(
    db: Session, user: UserAccount, token_type: str, ttl: timedelta
) -> str:
    """Invalidate any existing tokens of this type, create a new one, return the raw token."""
    now = datetime.now(timezone.utc)
    # Invalidate all existing unused tokens of this type for this user
    existing = (
        db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.type == token_type,
                EmailVerificationToken.used_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for tok in existing:
        tok.used_at = now

    raw, hashed = _generate_token()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hashed,
            type=token_type,
            expires_at=now + ttl,
        )
    )
    db.flush()
    return raw


@router.post("/signup", response_model=SignupPendingResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> SignupPendingResponse:
    email = _normalize_email(payload.email)
    existing = db.execute(
        select(UserAccount).where(UserAccount.email == email)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = UserAccount(
        email=email,
        full_name=payload.full_name,
        role=payload.role or "trader",
        password_hash=hash_password(payload.password),
        is_active=True,
        email_verified_at=None,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        ) from exc

    raw_token = _create_verification_token(db, user, "email_verify", _VERIFY_TTL)
    db.commit()

    send_verification_email(email, payload.full_name, raw_token)
    return SignupPendingResponse(email=email)


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
def resend_verification(
    payload: ResendVerificationRequest, db: Session = Depends(get_db)
) -> dict[str, str]:
    """Resend email verification link. Always returns 200 (anti-enumeration)."""
    email = _normalize_email(payload.email)
    user = db.execute(select(UserAccount).where(UserAccount.email == email)).scalar_one_or_none()

    if user and user.email_verified_at is None:
        raw_token = _create_verification_token(db, user, "email_verify", _VERIFY_TTL)
        db.commit()
        send_verification_email(email, user.full_name, raw_token)

    return {"message": "If that email exists and is unverified, a new link has been sent."}


@router.get("/verify-email", response_model=TokenResponse)
def verify_email(token: str, db: Session = Depends(get_db)) -> TokenResponse:
    """Consume an email verification token and return JWT tokens (auto-login)."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    record = db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.type == "email_verify",
        )
    ).scalar_one_or_none()

    if record is None or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link is invalid or already used.",
        )

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Request a new one.",
        )

    user = db.get(UserAccount, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not found.")

    record.used_at = now
    user.email_verified_at = now
    user.last_login_at = now
    db.commit()
    db.refresh(user)

    send_welcome_email(user.email, user.full_name)

    return _issue_tokens(db, user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = _normalize_email(payload.email)
    user = db.execute(select(UserAccount).where(UserAccount.email == email)).scalar_one_or_none()
    if (
        user is None
        or not user.password_hash
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled. Contact support.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    return _issue_tokens(db, user)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    payload: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> dict[str, str]:
    """Send a password reset link. Always returns 200 (anti-enumeration)."""
    email = _normalize_email(payload.email)
    user = db.execute(select(UserAccount).where(UserAccount.email == email)).scalar_one_or_none()

    if user and user.email_verified_at is not None and user.is_active and user.password_hash:
        raw_token = _create_verification_token(db, user, "password_reset", _RESET_TTL)
        db.commit()
        send_password_reset_email(email, user.full_name, raw_token)

    return {"message": "If that email is registered, you'll receive a reset link shortly."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    """Consume a password reset token and update the user's password."""
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    record = db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.type == "password_reset",
        )
    ).scalar_one_or_none()

    if record is None or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link is invalid or already used.",
        )

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link has expired. Request a new one.",
        )

    user = db.get(UserAccount, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not found.")

    record.used_at = now
    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated. You can now log in with your new password."}


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    token_hash = hash_token(payload.refresh_token)
    record = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).scalar_one_or_none()

    if record is None or record.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    now = datetime.now(timezone.utc)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

    user = db.get(UserAccount, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authorized")

    record.revoked_at = now
    record.last_used_at = now

    return _issue_tokens(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> None:
    token_hash = hash_token(payload.refresh_token)
    record = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).scalar_one_or_none()

    if record is not None and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        db.commit()


@router.get("/me", response_model=UserResponse)
def me(current_user: UserAccount = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/users/me/tier", response_model=UserResponse)
def dev_set_tier(
    payload: DevTierRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Dev-only: set tier without payment. Requires DEV_TIER_BYPASS=true in env."""
    from src.shared.config import Config

    if not Config.DEV_TIER_BYPASS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev tier bypass is not enabled on this server.",
        )
    current_user.tier = payload.tier
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
) -> UserResponse:
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Current password required",
            )
        if not current_user.password_hash or not verify_password(
            payload.current_password, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )
        current_user.password_hash = hash_password(payload.new_password)

    if payload.email and payload.email != current_user.email:
        existing = db.execute(
            select(UserAccount).where(UserAccount.email == _normalize_email(payload.email))
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        current_user.email = _normalize_email(payload.email)

    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)

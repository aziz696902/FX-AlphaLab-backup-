"""Google OAuth 2.0 login endpoints."""

from __future__ import annotations

import json
import urllib.parse
from datetime import datetime

import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.backend.dependencies import get_db
from src.backend.email_service import send_welcome_email
from src.backend.security import create_access_token, create_refresh_token, hash_token
from src.shared.config import Config
from src.shared.db.models import RefreshToken, UserAccount

router = APIRouter(prefix="/auth", tags=["auth"])

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google")
def google_login() -> RedirectResponse:
    """Redirect the browser to Google's OAuth consent screen."""
    if not Config.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured — set GOOGLE_CLIENT_ID in .env",
        )
    params = urllib.parse.urlencode(
        {
            "client_id": Config.GOOGLE_CLIENT_ID,
            "redirect_uri": Config.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }
    )
    return RedirectResponse(url=f"{_GOOGLE_AUTH_URL}?{params}")


@router.get("/google/callback")
def google_callback(
    code: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Exchange Google auth code for app JWT tokens, find or create the user."""
    if error or not code:
        return RedirectResponse(url=f"{Config.FRONTEND_URL}/auth?error=google_denied")

    # Exchange authorization code for Google access token
    token_resp = http_requests.post(
        _GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": Config.GOOGLE_CLIENT_ID,
            "client_secret": Config.GOOGLE_CLIENT_SECRET,
            "redirect_uri": Config.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if not token_resp.ok:
        return RedirectResponse(url=f"{Config.FRONTEND_URL}/auth?error=google_token_failed")

    google_access_token = token_resp.json().get("access_token")

    # Fetch Google user profile
    userinfo_resp = http_requests.get(
        _GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {google_access_token}"},
        timeout=10,
    )
    if not userinfo_resp.ok:
        return RedirectResponse(url=f"{Config.FRONTEND_URL}/auth?error=google_userinfo_failed")

    userinfo = userinfo_resp.json()
    google_id: str = userinfo.get("id", "")
    email: str = userinfo.get("email", "").strip().lower()
    full_name: str | None = userinfo.get("name")

    if not email:
        return RedirectResponse(url=f"{Config.FRONTEND_URL}/auth?error=google_no_email")

    # Find or create user
    user = db.execute(select(UserAccount).where(UserAccount.email == email)).scalar_one_or_none()
    is_new = user is None

    now = datetime.utcnow()
    if user is None:
        user = UserAccount(
            email=email,
            full_name=full_name,
            role="trader",
            google_id=google_id,
            password_hash=None,
            is_active=True,
            email_verified_at=now,
        )
        db.add(user)
        db.flush()
    else:
        # Link Google identity to an existing email/password account
        if user.google_id is None:
            user.google_id = google_id
        if user.email_verified_at is None:
            user.email_verified_at = now
        user.last_login_at = now

    # Issue app JWT tokens
    access_token, expires_in = create_access_token(user)
    refresh_token_str, jti, refresh_expires_at = create_refresh_token(user)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token_str),
            jti=jti,
            expires_at=refresh_expires_at,
        )
    )
    db.commit()

    if is_new:
        send_welcome_email(email, full_name)

    # Encode user payload for the frontend callback
    user_json = json.dumps(
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tier": user.tier,
            "is_active": user.is_active,
            "email_verified_at": (
                user.email_verified_at.isoformat() if user.email_verified_at else None
            ),
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        },
        separators=(",", ":"),
    )

    redirect_params = urllib.parse.urlencode(
        {
            "access_token": access_token,
            "refresh_token": refresh_token_str,
            "expires_in_seconds": expires_in,
            "user": user_json,
        }
    )
    return RedirectResponse(url=f"{Config.FRONTEND_URL}/auth/callback?{redirect_params}")

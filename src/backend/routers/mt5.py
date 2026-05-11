"""MT5 account linking endpoints."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.backend.dependencies import get_db
from src.backend.mt5_service import verify_mt5_credentials
from src.backend.schemas.mt5 import MT5AccountSnapshot, MT5ConnectRequest, MT5StatusResponse
from src.backend.security import get_current_user
from src.shared.db.models import UserAccount, UserMT5Link

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mt5", tags=["mt5"])


@router.get("/status", response_model=MT5StatusResponse)
def mt5_status(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MT5StatusResponse:
    """Return the current user's MT5 link status."""
    link = db.execute(
        select(UserMT5Link).where(UserMT5Link.user_id == current_user.id)
    ).scalar_one_or_none()

    if link is None:
        return MT5StatusResponse(connected=False)

    return MT5StatusResponse(
        connected=True,
        account=MT5AccountSnapshot.model_validate(link),
    )


@router.post("/connect", response_model=MT5StatusResponse, status_code=status.HTTP_200_OK)
def mt5_connect(
    payload: MT5ConnectRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MT5StatusResponse:
    """Verify MT5 credentials and link the account to the current user.

    MT5 password is used only during verification and is never stored.
    Raises 400 if credentials are invalid, 409 if this MT5 account is
    already linked to another user.
    """
    try:
        info = verify_mt5_credentials(
            login=payload.mt5_login,
            password=payload.mt5_password,
            server=payload.mt5_server,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MT5 authentication failed: {exc}",
        ) from exc
    except RuntimeError as exc:
        logger.exception("MT5 verifier subprocess error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"MT5 terminal unavailable: {exc}",
        ) from exc

    now = datetime.now(timezone.utc)

    # Upsert: update existing link or create new one
    existing = db.execute(
        select(UserMT5Link).where(UserMT5Link.user_id == current_user.id)
    ).scalar_one_or_none()

    if existing is not None:
        existing.mt5_login = info.login
        existing.mt5_server = info.server
        existing.mt5_name = info.name
        existing.mt5_currency = info.currency
        existing.mt5_leverage = info.leverage
        existing.mt5_account_type = info.account_type
        existing.last_verified_at = now
        link = existing
    else:
        link = UserMT5Link(
            user_id=current_user.id,
            mt5_login=info.login,
            mt5_server=info.server,
            mt5_name=info.name,
            mt5_currency=info.currency,
            mt5_leverage=info.leverage,
            mt5_account_type=info.account_type,
            connected_at=now,
            last_verified_at=now,
        )
        db.add(link)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This MT5 account is already linked to another user.",
        ) from exc

    db.refresh(link)

    return MT5StatusResponse(
        connected=True,
        account=MT5AccountSnapshot.model_validate(link),
    )


@router.delete("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
def mt5_disconnect(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Unlink the current user's MT5 account."""
    link = db.execute(
        select(UserMT5Link).where(UserMT5Link.user_id == current_user.id)
    ).scalar_one_or_none()

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No MT5 account linked.",
        )

    db.delete(link)
    db.commit()

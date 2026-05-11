"""Admin endpoints — user management and inference trigger.

All endpoints require role == 'admin'.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.backend.dependencies import get_db
from src.backend.schemas.auth import UserResponse
from src.backend.security import get_current_user
from src.shared.config import Config
from src.shared.db.models import UserAccount, UserMT5Link

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

_VALID_TIERS = {"free", "pro", "elite"}


def _require_admin(current_user: UserAccount = Depends(get_current_user)) -> UserAccount:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


class AdminUserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    tier: str
    is_active: bool
    mt5_connected: bool
    email_verified_at: datetime | None
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class AdminUpdateUserRequest(BaseModel):
    tier: str | None = None
    is_active: bool | None = None


class InferenceRunResponse(BaseModel):
    status: str
    message: str


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    _admin: UserAccount = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserResponse]:
    """Return all users with MT5 link status."""
    users = db.execute(select(UserAccount).order_by(UserAccount.created_at.desc())).scalars().all()
    mt5_user_ids = set(db.execute(select(UserMT5Link.user_id)).scalars().all())
    return [
        AdminUserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            tier=u.tier,
            is_active=u.is_active,
            mt5_connected=u.id in mt5_user_ids,
            email_verified_at=u.email_verified_at,
            created_at=u.created_at,
            last_login_at=u.last_login_at,
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: AdminUpdateUserRequest,
    _admin: UserAccount = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Update a user's tier or active status."""
    user = db.get(UserAccount, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.tier is not None:
        if payload.tier not in _VALID_TIERS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid tier. Must be one of: {', '.join(sorted(_VALID_TIERS))}",
            )
        user.tier = payload.tier

    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/inference/run", response_model=InferenceRunResponse)
def trigger_inference(
    _admin: UserAccount = Depends(_require_admin),
) -> InferenceRunResponse:
    """Fire the daily inference pipeline in a background thread."""

    def _run() -> None:
        try:
            from src.inference.pipeline import InferencePipeline

            pipeline = InferencePipeline()
            result = pipeline.run(dry_run=False)
            logger.info(
                "Admin-triggered inference complete: top_pick=%s, db_rows=%d",
                result.report.top_pick,
                result.db_rows,
            )
            from src.backend.email_service import send_daily_report_emails

            send_daily_report_emails(result.target_date)
        except Exception:
            logger.exception("Admin-triggered inference failed")

    threading.Thread(target=_run, daemon=True, name="admin-inference-trigger").start()
    return InferenceRunResponse(
        status="started",
        message="Inference pipeline is running in the background. Check server logs for progress.",
    )


class ReindexResponse(BaseModel):
    status: str
    message: str


@router.post("/rag/reindex", response_model=ReindexResponse)
def reindex_rag(
    days: int = 30,
    _admin: UserAccount = Depends(_require_admin),
) -> ReindexResponse:
    """Rebuild the RAG vector index in a background thread.

    Args:
        days: Rolling window size in days (default 30). Pass ?days=5 for a quick test.

    Returns immediately. Check server logs for progress and completion stats.
    """

    def _run() -> None:
        try:
            from src.rag.indexer import build_index

            stats = build_index(data_dir=Config.DATA_DIR, chroma_dir=Config.CHROMA_DIR, days=days)
            logger.info(
                "RAG reindex complete: upserted=%d evicted=%d total=%d",
                stats["upserted"],
                stats["evicted"],
                stats["total"],
            )
        except Exception:
            logger.exception("RAG reindex failed")

    threading.Thread(target=_run, daemon=True, name="admin-rag-reindex").start()
    return ReindexResponse(
        status="started",
        message=f"RAG reindex (days={days}) running in background. Check server logs for progress.",
    )

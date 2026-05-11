"""add_user_tier

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-11

Adds users.tier column to support paywall tiers (free/pro/elite).
Existing users default to 'free'.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = ("0003", "3dee0b24c9f5")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("tier", sa.String(50), nullable=False, server_default=sa.text("'free'")),
    )


def downgrade() -> None:
    op.drop_column("users", "tier")

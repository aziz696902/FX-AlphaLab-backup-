"""email_verification

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-11

- Adds users.email_verified_at (nullable TIMESTAMP)
- Backfills existing rows with created_at so they are not locked out
- Creates email_verification_tokens table for email verify + password reset flows
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.TIMESTAMP, nullable=True))
    op.execute("UPDATE users SET email_verified_at = created_at")

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP, nullable=False),
        sa.Column("used_at", sa.TIMESTAMP, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash", name="uq_evt_token_hash"),
        sa.CheckConstraint("type IN ('email_verify', 'password_reset')", name="chk_evt_type"),
    )
    op.create_index("idx_evt_token_hash", "email_verification_tokens", ["token_hash"])
    op.create_index("idx_evt_user_type", "email_verification_tokens", ["user_id", "type"])


def downgrade() -> None:
    op.drop_index("idx_evt_user_type", table_name="email_verification_tokens")
    op.drop_index("idx_evt_token_hash", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_column("users", "email_verified_at")

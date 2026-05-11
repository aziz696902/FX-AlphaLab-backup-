"""mt5_connections

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-11

Creates user_mt5_links table for MT5 account linking.
- One MT5 account per user (UNIQUE on user_id)
- One user per MT5 account (UNIQUE on mt5_login + mt5_server)
- Password is never stored
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_mt5_links",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("mt5_login", sa.Integer, nullable=False),
        sa.Column("mt5_server", sa.String(100), nullable=False),
        sa.Column("mt5_name", sa.String(255), nullable=True),
        sa.Column("mt5_currency", sa.String(10), nullable=True),
        sa.Column("mt5_leverage", sa.Integer, nullable=True),
        sa.Column("mt5_account_type", sa.String(20), nullable=True),
        sa.Column("connected_at", sa.TIMESTAMP, nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "last_verified_at", sa.TIMESTAMP, nullable=False, server_default=sa.text("now()")
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_mt5_links_user_id"),
        sa.UniqueConstraint("mt5_login", "mt5_server", name="uq_mt5_login_server"),
    )
    op.create_index("idx_mt5_links_user_id", "user_mt5_links", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_mt5_links_user_id", table_name="user_mt5_links")
    op.drop_table("user_mt5_links")

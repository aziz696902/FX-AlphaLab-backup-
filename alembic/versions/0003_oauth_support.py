"""oauth_support

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-09

- Makes users.password_hash nullable (OAuth users have no password)
- Adds users.google_id column for Google OAuth identity linking
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "password_hash", nullable=True)
    op.add_column("users", sa.Column("google_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])
    op.create_index("idx_users_google_id", "users", ["google_id"])


def downgrade() -> None:
    op.drop_index("idx_users_google_id", table_name="users")
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_column("users", "google_id")
    op.alter_column("users", "password_hash", nullable=False)

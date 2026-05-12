"""daily_reports table

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-12

Stores the generated HTML report per (date, pair).  The html column holds the
inner <div class="report-shell"> fragment (no <html>/<body> wrapper) so the
frontend can inject it via innerHTML.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_reports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("pair", sa.String(10), nullable=False),
        sa.Column("html", sa.Text, nullable=False),
        sa.Column(
            "generated_at",
            sa.TIMESTAMP,
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("date", "pair", name="uq_daily_reports_date_pair"),
    )
    op.create_index("idx_daily_reports_date", "daily_reports", ["date"])


def downgrade() -> None:
    op.drop_index("idx_daily_reports_date", table_name="daily_reports")
    op.drop_table("daily_reports")

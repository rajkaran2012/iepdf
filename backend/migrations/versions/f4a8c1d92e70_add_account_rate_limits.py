"""Add shared account rate-limit buckets.

Revision ID: f4a8c1d92e70
Revises: c8d5f1a739b2
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f4a8c1d92e70"
down_revision: Union[str, Sequence[str], None] = "c8d5f1a739b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_rate_limits",
        sa.Column("bucket_key", sa.String(length=64), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "request_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "request_count >= 0",
            name="ck_account_rate_limits_request_count_nonnegative",
        ),
        sa.PrimaryKeyConstraint("bucket_key"),
    )


def downgrade() -> None:
    op.drop_table("account_rate_limits")

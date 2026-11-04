"""Add administrator plan-assignment audit records.

Revision ID: c8d5f1a739b2
Revises: 72a912da03ff
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d5f1a739b2"
down_revision: Union[str, Sequence[str], None] = "72a912da03ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_plan_audits",
        sa.Column("id", sa.BigInteger(), primary_key=True, nullable=False),
        sa.Column("admin_user_id", sa.BigInteger(), nullable=False),
        sa.Column("target_user_id", sa.BigInteger(), nullable=False),
        sa.Column("previous_plan", sa.String(length=20), nullable=False),
        sa.Column("assigned_plan", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "previous_plan IN ('free', 'paid')",
            name="ck_admin_plan_audit_previous_plan",
        ),
        sa.CheckConstraint(
            "assigned_plan IN ('free', 'paid')",
            name="ck_admin_plan_audit_assigned_plan",
        ),
        sa.ForeignKeyConstraint(
            ["admin_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["target_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
    )
    op.create_index(
        "ix_admin_plan_audits_target_created",
        "admin_plan_audits",
        ["target_user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_admin_plan_audits_target_created",
        table_name="admin_plan_audits",
    )
    op.drop_table("admin_plan_audits")

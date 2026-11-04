"""Initial SQLAlchemy models for iePDF account and billing foundations.

Defining these models does not create database tables.
No payment provider or authentication flow is activated here.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")
    usage_records: Mapped[list["UsageRecord"]] = relationship(back_populates="user")
    entitlements: Mapped[list["Entitlement"]] = relationship(back_populates="user")


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("plan_id IN ('free', 'paid')", name="ck_subscription_plan"),
        CheckConstraint(
            "status IN ('inactive', 'active', 'past_due', 'cancelled', 'expired')",
            name="ck_subscription_status",
        ),
        CheckConstraint(
            "ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at",
            name="ck_subscription_date_order",
        ),
        Index("ix_subscriptions_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[str] = mapped_column(String(20), default="free", server_default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active", nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="subscriptions")


class UsageRecord(Base):
    __tablename__ = "usage_records"
    __table_args__ = (
        CheckConstraint("task_count >= 0", name="ck_usage_task_count_nonnegative"),
        UniqueConstraint("user_id", "usage_date", name="uq_usage_user_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    usage_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    task_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="usage_records")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_payment_amount_nonnegative"),
        CheckConstraint(
            "status IN ('pending', 'verified', 'failed', 'refunded')",
            name="ck_payment_status",
        ),
        UniqueConstraint("provider", "provider_payment_id", name="uq_provider_payment"),
        Index("ix_payments_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    provider_order_id: Mapped[str | None] = mapped_column(String(255))
    provider_payment_id: Mapped[str | None] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending", nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Entitlement(Base):
    __tablename__ = "entitlements"
    __table_args__ = (
        UniqueConstraint("user_id", "entitlement_key", name="uq_user_entitlement"),
        CheckConstraint(
            "status IN ('active', 'revoked', 'expired')",
            name="ck_entitlement_status",
        ),
        CheckConstraint("max_files IS NULL OR max_files > 0", name="ck_entitlement_max_files_positive"),
        CheckConstraint("max_file_size_bytes IS NULL OR max_file_size_bytes > 0", name="ck_entitlement_file_size_positive"),
        CheckConstraint("max_total_size_bytes IS NULL OR max_total_size_bytes > 0", name="ck_entitlement_total_size_positive"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    entitlement_key: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active", nullable=False)
    max_files: Mapped[int | None] = mapped_column(Integer)
    max_file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    max_total_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    granted_by: Mapped[str] = mapped_column(String(80), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="entitlements")

class EmailVerificationToken(Base):
    """Single-use email verification token metadata; never store raw tokens."""

    __tablename__ = "email_verification_tokens"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_email_verification_token_hash"),
        Index("ix_email_verification_user_expiry", "user_id", "expires_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AdminPlanAudit(Base):
    """Durable record of a successful administrator plan assignment."""

    __tablename__ = "admin_plan_audits"
    __table_args__ = (
        CheckConstraint(
            "previous_plan IN ('free', 'paid')",
            name="ck_admin_plan_audit_previous_plan",
        ),
        CheckConstraint(
            "assigned_plan IN ('free', 'paid')",
            name="ck_admin_plan_audit_assigned_plan",
        ),
        Index(
            "ix_admin_plan_audits_target_created",
            "target_user_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    target_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    previous_plan: Mapped[str] = mapped_column(String(20), nullable=False)
    assigned_plan: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

class AccountRateLimit(Base):
    """Persistent request counters for account endpoint rate limits."""

    __tablename__ = "account_rate_limits"
    __table_args__ = (
        CheckConstraint(
            "request_count >= 0",
            name="ck_account_rate_limits_request_count_nonnegative",
        ),
    )

    bucket_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    request_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

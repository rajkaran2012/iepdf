"""Account endpoints."""

from typing import Generator, Literal
import re
from datetime import datetime, timezone

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models import AdminPlanAudit, EmailVerificationToken, Subscription, User
from security.access_tokens import create_access_token
from security.email_sender import EmailDeliveryError, send_verification_email
from security.email_verification import create_verification_token
from security.passwords import hash_password, verify_password
from security.email_verification_service import consume_verification_token
from security.account_access import AccountContext, require_account, reserve_daily_task
from security.admin_access import require_admin
from security.plan_policy import FREE_POLICY, PAID_POLICY, ToolId, get_tool_limit
from security.rate_limit import enforce_rate_limit


router = APIRouter(prefix="/accounts", tags=["accounts"])


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=512)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)

    from pydantic import field_validator as _field_validator

    @_field_validator("email")
    @classmethod
    def normalize_and_validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized



class RegisterRequest(BaseModel):
    """Validated registration input; plaintext passwords are never persisted."""

    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=128)

    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    # Pydantic v2 field validation
    from pydantic import field_validator as _field_validator

    @_field_validator("email")
    @classmethod
    def normalize_and_validate_email(cls, value: str) -> str:
        return cls.validate_email(value)


def _registration_accepted() -> dict[str, str]:
    # Use the same response for existing and newly accepted accounts.
    return {
        "status": "accepted",
        "message": "If the account can be registered, a verification email will be sent.",
    }


@router.post("/register", status_code=202)
def register_account(
    payload: RegisterRequest,
    session: Session = Depends(get_db),
) -> dict[str, str]:
    """Create a pending account and request email verification.

    Only a token hash is stored. The account remains pending until verification.
    Repeated requests for a pending account rotate its unused verification token.
    """
    enforce_rate_limit(session, "register", payload.email)
    raw_token: str | None = None

    try:
        user = session.execute(
            select(User)
            .where(User.email == payload.email)
            .with_for_update()
        ).scalar_one_or_none()

        if user is not None and user.status != "pending":
            return _registration_accepted()

        if user is None:
            user = User(
                email=payload.email,
                password_hash=hash_password(payload.password),
                status="pending",
            )
            session.add(user)
            session.flush()
        elif not user.password_hash:
            user.password_hash = hash_password(payload.password)

        now = datetime.now(timezone.utc)

        old_tokens = session.execute(
            select(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.used_at.is_(None),
            )
            .with_for_update()
        ).scalars().all()

        for old_token in old_tokens:
            old_token.used_at = now

        raw_token, token_hash, expires_at = create_verification_token(now)
        session.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
            )
        )
        session.commit()

    except IntegrityError:
        session.rollback()
        # Handles concurrent duplicate registration without exposing account state.
        return _registration_accepted()
    except Exception:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Registration could not be completed.",
        ) from None

    try:
        send_verification_email(payload.email, raw_token)
    except EmailDeliveryError:
        # The account remains pending. A repeated registration request rotates
        # the token and can retry delivery without creating a duplicate account.
        raise HTTPException(
            status_code=503,
            detail="The account is pending, but the verification email could not be sent. Please retry registration.",
        ) from None

    return _registration_accepted()


@router.post("/verify-email")
def verify_email(
    payload: VerifyEmailRequest,
    session: Session = Depends(get_db),
) -> dict[str, str]:
    """Verify an email token and activate its pending account."""
    enforce_rate_limit(session, "verify-email", payload.token)
    try:
        verified = consume_verification_token(session, payload.token)
        if not verified:
            session.rollback()
            raise HTTPException(
                status_code=400,
                detail="Verification link is invalid or expired.",
            )

        session.commit()
        return {"status": "verified"}

    except HTTPException:
        raise
    except Exception:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Email verification could not be completed.",
        ) from None



@router.post("/login")
def login_account(
    payload: LoginRequest,
    session: Session = Depends(get_db),
) -> dict[str, object]:
    """Authenticate an active account and issue a short-lived access token."""
    enforce_rate_limit(session, "login", payload.email)
    try:
        user = session.execute(
            select(User).where(User.email == payload.email)
        ).scalar_one_or_none()

        if (
            user is None
            or not verify_password(payload.password, user.password_hash)
            or user.status != "active"
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials or account not verified.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return {
            "access_token": create_access_token(user.id),
            "token_type": "bearer",
            "expires_in": 3600,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Login could not be completed.",
        ) from None


class ReserveTaskRequest(BaseModel):
    """Browser-side task reservation; the server resolves plan and limits."""
    model_config = ConfigDict(extra="forbid")
    tool_id: Literal["merge", "split", "compress", "pdf-to-jpg", "jpg-to-pdf"]


@router.post("/reserve-task")
def reserve_browser_task(
    payload: ReserveTaskRequest,
    account: AccountContext = Depends(require_account),
) -> dict[str, str]:
    """Reserve one daily task for a browser-processed tool."""
    reserve_daily_task(account, payload.tool_id)
    return {"status": "reserved", "tool_id": payload.tool_id}


logger = logging.getLogger(__name__)


class PlanAssignmentRequest(BaseModel):
    """Manual plan assignment restricted to configured administrators."""
    model_config = ConfigDict(extra="forbid")
    user_id: int = Field(gt=0)
    plan_id: Literal["free", "paid"]


@router.post("/admin/set-plan")
def admin_set_plan(
    payload: PlanAssignmentRequest,
    account: AccountContext = Depends(require_admin),
) -> dict[str, object]:
    """Assign a plan to an active account using one database transaction."""
    session = account.session

    try:
        target = session.execute(
            select(User)
            .where(User.id == payload.user_id)
            .with_for_update()
        ).scalar_one_or_none()

        if target is None or target.status != "active":
            raise HTTPException(
                status_code=404,
                detail="Active target account not found.",
            )

        subscriptions = session.execute(
            select(Subscription)
            .where(
                Subscription.user_id == target.id,
                Subscription.status == "active",
            )
            .with_for_update()
        ).scalars().all()

        now = datetime.now(timezone.utc)

        # Match account_access.py: only a currently effective Paid
        # subscription makes the previous effective plan Paid.
        previous_plan = "free"
        for subscription in subscriptions:
            if subscription.plan_id != "paid":
                continue
            starts = subscription.starts_at
            ends = subscription.ends_at
            if starts is not None and starts.tzinfo is None:
                starts = starts.replace(tzinfo=timezone.utc)
            if ends is not None and ends.tzinfo is None:
                ends = ends.replace(tzinfo=timezone.utc)
            if (starts is None or starts <= now) and (
                ends is None or ends > now
            ):
                previous_plan = "paid"
                break

        for subscription in subscriptions:
            subscription.status = "cancelled"

        session.add(
            Subscription(
                user_id=target.id,
                plan_id=payload.plan_id,
                status="active",
                starts_at=now,
            )
        )
        session.add(
            AdminPlanAudit(
                admin_user_id=account.user.id,
                target_user_id=target.id,
                previous_plan=previous_plan,
                assigned_plan=payload.plan_id,
            )
        )
        # Force pending inserts/constraints to be checked before commit.
        # Both records and subscription status changes share this transaction.
        session.flush()
        session.commit()

        logger.info(
            "Manual plan assignment completed: admin_user_id=%s target_user_id=%s plan_id=%s",
            account.user.id,
            target.id,
            payload.plan_id,
        )
        return {
            "status": "updated",
            "user_id": target.id,
            "plan_id": payload.plan_id,
        }

    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Plan assignment could not be completed.",
        ) from None


@router.get("/me")
def get_current_account(
    account: AccountContext = Depends(require_account),
) -> dict[str, object]:
    """Return the authenticated account's effective server-resolved plan."""
    policy = PAID_POLICY if account.plan_id == "paid" else FREE_POLICY
    tools: dict[str, dict[str, int]] = {}

    for tool_id in ("merge", "split", "compress", "pdf-to-jpg", "jpg-to-pdf"):
        limit = get_tool_limit(
            policy,
            tool_id,  # type: ignore[arg-type]
            special_merge_authorized=(
                account.special_merge_authorized and tool_id == "merge"
            ),
        )
        tools[tool_id] = {
            "min_files": limit.min_files,
            "max_files": limit.max_files,
            "max_file_size_bytes": limit.max_file_size_bytes,
            "max_total_size_bytes": limit.max_total_size_bytes,
        }

    return {
        "user_id": account.user.id,
        "plan_id": account.plan_id,
        "daily_task_limit": policy.daily_task_limit,
        "show_ads": policy.show_ads,
        "watermark_enabled": policy.watermark_enabled,
        "priority_eligible": policy.priority_eligible,
        "tools": tools,
    }

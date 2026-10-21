"""Authentication, plan resolution, upload policy, and atomic quota enforcement."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Generator, Sequence

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Entitlement, Subscription, UsageRecord, User
from security.plan_policy import FREE_POLICY, PAID_POLICY, ToolId, ToolLimit, get_tool_limit
from security.upload_validation import validate_upload_batch
from config import MAX_FILE_SIZE

from security.access_tokens import create_access_token, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped database session for account dependencies."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@dataclass(frozen=True)
class AccountContext:
    user: User
    session: Session
    plan_id: str
    special_merge_authorized: bool
    special_merge_max_files: int | None = None
    special_merge_max_file_size_bytes: int | None = None
    special_merge_max_total_size_bytes: int | None = None


def require_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_db),
) -> AccountContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in with a verified iePDF account to use this tool.")
    user_id = decode_access_token(credentials.credentials)
    user = session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None or user.status != "active":
        raise HTTPException(status_code=403, detail="A verified, active account is required.")

    now = datetime.now(timezone.utc)
    subscriptions = session.execute(
        select(Subscription)
        .where(Subscription.user_id == user.id, Subscription.status == "active")
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
    ).scalars().all()

    paid_active = False
    for subscription in subscriptions:
        if subscription.plan_id != "paid":
            continue
        starts = subscription.starts_at
        ends = subscription.ends_at
        if starts is not None and starts.tzinfo is None:
            starts = starts.replace(tzinfo=timezone.utc)
        if ends is not None and ends.tzinfo is None:
            ends = ends.replace(tzinfo=timezone.utc)
        if (starts is None or starts <= now) and (ends is None or ends > now):
            paid_active = True
            break

    entitlement = session.execute(
        select(Entitlement).where(
            Entitlement.user_id == user.id,
            Entitlement.entitlement_key == "special_merge",
            Entitlement.status == "active",
        )
    ).scalar_one_or_none()
    special_merge = False
    if entitlement is not None:
        expiry = entitlement.expires_at
        if expiry is not None and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        special_merge = expiry is None or expiry > now

    return AccountContext(
        user=user,
        session=session,
        plan_id="paid" if paid_active else "free",
        special_merge_authorized=special_merge,
        special_merge_max_files=(
            entitlement.max_files if special_merge and entitlement is not None
            else None
        ),
        special_merge_max_file_size_bytes=(
            entitlement.max_file_size_bytes
            if special_merge and entitlement is not None else None
        ),
        special_merge_max_total_size_bytes=(
            entitlement.max_total_size_bytes
            if special_merge and entitlement is not None else None
        ),
    )


def effective_tool_limit(context: AccountContext, tool_id: ToolId) -> ToolLimit:
    policy = PAID_POLICY if context.plan_id == "paid" else FREE_POLICY
    configured = get_tool_limit(
        policy, tool_id,
        special_merge_authorized=context.special_merge_authorized,
    )
    # Technical boundary is absolute and cannot be raised by any plan/entitlement.
    max_files = configured.max_files
    max_file_size_bytes = min(configured.max_file_size_bytes, MAX_FILE_SIZE)
    max_total_size_bytes = configured.max_total_size_bytes

    if tool_id == "merge" and context.special_merge_authorized:
        if context.special_merge_max_files is not None:
            max_files = min(max_files, context.special_merge_max_files)
        if context.special_merge_max_file_size_bytes is not None:
            max_file_size_bytes = min(
                max_file_size_bytes,
                context.special_merge_max_file_size_bytes,
                MAX_FILE_SIZE,
            )
        if context.special_merge_max_total_size_bytes is not None:
            max_total_size_bytes = min(
                max_total_size_bytes,
                context.special_merge_max_total_size_bytes,
            )

    return ToolLimit(
        min_files=configured.min_files,
        max_files=max_files,
        max_file_size_bytes=max_file_size_bytes,
        max_total_size_bytes=max(max_total_size_bytes, max_file_size_bytes),
    )


def reserve_daily_task(context: AccountContext, tool_id: ToolId) -> None:
    """Atomically reserve one daily task for an authenticated account."""
    daily_limit = (
        PAID_POLICY if context.plan_id == "paid" else FREE_POLICY
    ).daily_task_limit
    now = datetime.now(timezone.utc)
    today = now.date()

    statement = pg_insert(UsageRecord).values(
        user_id=context.user.id,
        usage_date=today,
        task_count=1,
    )
    update_values = {
        "task_count": UsageRecord.task_count + 1,
        "updated_at": now,
    }

    if daily_limit is None:
        statement = statement.on_conflict_do_update(
            index_elements=[UsageRecord.user_id, UsageRecord.usage_date],
            set_=update_values,
        ).returning(UsageRecord.task_count)
    else:
        statement = statement.on_conflict_do_update(
            index_elements=[UsageRecord.user_id, UsageRecord.usage_date],
            set_=update_values,
            where=UsageRecord.task_count < daily_limit,
        ).returning(UsageRecord.task_count)

    try:
        reserved = context.session.execute(statement).scalar_one_or_none()
        if reserved is None:
            context.session.rollback()
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily free-plan limit of {daily_limit} tasks reached. "
                    "Try again tomorrow or upgrade your plan."
                ),
            )
        context.session.commit()
    except HTTPException:
        raise
    except Exception:
        context.session.rollback()
        raise HTTPException(
            status_code=503,
            detail="Usage limits could not be verified. Please try again.",
        ) from None


async def enforce_tool_access(
    context: AccountContext,
    tool_id: ToolId,
    files: Sequence,
) -> None:
    """Validate uploaded files before atomically reserving a daily task."""
    limits = effective_tool_limit(context, tool_id)
    await validate_upload_batch(files, limits)
    reserve_daily_task(context, tool_id)

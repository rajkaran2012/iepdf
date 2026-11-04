"""Database-backed email verification operations.

The caller owns the SQLAlchemy transaction and must commit or roll back.
This module does not send email or create database tables.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import EmailVerificationToken, User
from security.email_verification import (
    hash_verification_token,
    is_verification_token_expired,
)


def consume_verification_token(
    session: Session,
    raw_token: str,
    *,
    now: datetime | None = None,
) -> bool:
    """Consume one valid token and activate its pending user.

    Returns False for unknown, expired, used, or non-pending-user tokens.
    Does not commit; the caller controls the transaction.
    """
    if not isinstance(raw_token, str) or not raw_token:
        return False

    current_time = now if now is not None else datetime.now(timezone.utc)
    if current_time.tzinfo is None or current_time.utcoffset() is None:
        raise ValueError("The current time must be timezone-aware.")

    token_hash = hash_verification_token(raw_token)

    token_record = session.execute(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.token_hash == token_hash)
        .with_for_update()
    ).scalar_one_or_none()

    if token_record is None:
        return False

    if token_record.used_at is not None:
        return False

    if is_verification_token_expired(token_record.expires_at, current_time):
        return False

    user = session.execute(
        select(User)
        .where(User.id == token_record.user_id)
        .with_for_update()
    ).scalar_one_or_none()

    if user is None or user.status != "pending":
        return False

    token_record.used_at = current_time
    user.status = "active"
    return True

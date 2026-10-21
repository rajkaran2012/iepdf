"""Security primitives for email verification; no database or email side effects."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone


TOKEN_TTL = timedelta(minutes=30)


def hash_verification_token(token: str) -> str:
    """Return a fixed-length SHA-256 digest for safe token storage."""
    if not isinstance(token, str) or not token:
        raise ValueError("Verification token must be a non-empty string.")
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_verification_token(
    now: datetime | None = None,
) -> tuple[str, str, datetime]:
    """Return (raw_token, token_hash, expiry); store only the hash."""
    issued_at = now if now is not None else datetime.now(timezone.utc)
    if issued_at.tzinfo is None or issued_at.utcoffset() is None:
        raise ValueError("The issue time must be timezone-aware.")

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_verification_token(raw_token)
    expires_at = issued_at + TOKEN_TTL
    return raw_token, token_hash, expires_at


def is_verification_token_expired(
    expires_at: datetime,
    now: datetime | None = None,
) -> bool:
    """Return whether a token has expired; reject ambiguous naive timestamps."""
    if expires_at.tzinfo is None or expires_at.utcoffset() is None:
        raise ValueError("The expiry time must be timezone-aware.")

    current_time = now if now is not None else datetime.now(timezone.utc)
    if current_time.tzinfo is None or current_time.utcoffset() is None:
        raise ValueError("The current time must be timezone-aware.")

    return current_time >= expires_at

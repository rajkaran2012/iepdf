"""PostgreSQL-backed rate limiting for account endpoints."""

from __future__ import annotations

import hashlib
import hmac
import os
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class RateLimit:
    """Maximum requests allowed within a fixed window."""

    requests: int
    window_seconds: int


RATE_LIMITS: dict[str, RateLimit] = {
    "login": RateLimit(requests=10, window_seconds=15 * 60),
    "register": RateLimit(requests=5, window_seconds=60 * 60),
    "verify-email": RateLimit(requests=10, window_seconds=15 * 60),
}


def _bucket_key(action: str, identifier: str) -> str:
    """Return a keyed hash so raw identifiers are not stored."""
    secret = os.environ.get("AUTH_SECRET_KEY", "")
    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError("AUTH_SECRET_KEY is not configured securely.")

    message = f"{action}:{identifier.strip().lower()}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def enforce_rate_limit(
    session: Session,
    action: str,
    identifier: str,
    *,
    now: datetime | None = None,
) -> None:
    """Commit one shared rate-limit update, or fail closed.

    The limiter commits its own counter deliberately: failed authentication
    attempts must remain counted even if the calling endpoint later fails.
    """
    policy = RATE_LIMITS.get(action)
    if policy is None:
        raise ValueError("Unknown rate-limit action.")
    if not identifier.strip():
        raise ValueError("A non-empty rate-limit identifier is required.")

    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    epoch = int(current.timestamp())
    window_epoch = epoch - (epoch % policy.window_seconds)
    window_start = datetime.fromtimestamp(window_epoch, tz=timezone.utc)

    try:
        key = _bucket_key(action, identifier)
        result = session.execute(
            text(
                """
                INSERT INTO account_rate_limits
                    (bucket_key, window_start, request_count, updated_at)
                VALUES
                    (:bucket_key, :window_start, 1, now())
                ON CONFLICT (bucket_key) DO UPDATE
                SET
                    window_start = CASE
                        WHEN account_rate_limits.window_start < EXCLUDED.window_start
                            THEN EXCLUDED.window_start
                        ELSE account_rate_limits.window_start
                    END,
                    request_count = CASE
                        WHEN account_rate_limits.window_start < EXCLUDED.window_start
                            THEN 1
                        WHEN account_rate_limits.window_start = EXCLUDED.window_start
                            THEN account_rate_limits.request_count + 1
                        ELSE account_rate_limits.request_count
                    END,
                    updated_at = now()
                RETURNING window_start, request_count
                """
            ),
            {"bucket_key": key, "window_start": window_start},
        )
        row = result.one()
        stored_window = row[0]
        count = int(row[1])
        session.commit()
    except Exception:
        session.rollback()
        raise HTTPException(
            status_code=503,
            detail="Request protection is temporarily unavailable. Please retry later.",
            headers={"Retry-After": str(policy.window_seconds)},
        ) from None

    if stored_window.tzinfo is None:
        stored_window = stored_window.replace(tzinfo=timezone.utc)

    # A delayed request from an older window must not reset a newer window.
    if stored_window > window_start or count > policy.requests:
        retry_after = max(
            1,
            int((stored_window.timestamp() + policy.window_seconds) - epoch),
        )
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please retry after the rate limit window.",
            headers={"Retry-After": str(retry_after)},
        )

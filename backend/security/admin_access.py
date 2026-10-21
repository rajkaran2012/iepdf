"""Server-configured administrator authorization."""
from __future__ import annotations

import os

from fastapi import Depends, HTTPException

from security.account_access import AccountContext, require_account


def configured_admin_emails() -> frozenset[str]:
    """Return normalized administrator emails from server configuration."""
    raw = os.environ.get("ADMIN_EMAILS", "")
    return frozenset(
        email.strip().lower()
        for email in raw.split(",")
        if email.strip()
    )


def require_admin(
    account: AccountContext = Depends(require_account),
) -> AccountContext:
    """Require an authenticated, active account explicitly allowlisted as admin."""
    allowed_emails = configured_admin_emails()

    if not allowed_emails:
        raise HTTPException(
            status_code=503,
            detail="Administrator access is not configured.",
        )

    account_email = (account.user.email or "").strip().lower()
    if not account_email or account_email not in allowed_emails:
        raise HTTPException(
            status_code=403,
            detail="Administrator access is required.",
        )

    return account

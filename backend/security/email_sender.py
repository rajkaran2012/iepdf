"""Transactional email delivery for iePDF using Resend.

Configuration:
    RESEND_API_KEY: Resend API key, supplied through the environment.
    EMAIL_FROM: Verified sender address, e.g. "iePDF <accounts@iepdf.com>".
    FRONTEND_URL: Public frontend base URL, e.g. "https://iepdf.com".

This module does not access the database or log secrets.
"""

import html
import os
from urllib.parse import urlencode, urlsplit

import resend


class EmailConfigurationError(RuntimeError):
    """Raised when email delivery configuration is missing or invalid."""


class EmailDeliveryError(RuntimeError):
    """Raised when the email provider cannot accept a message."""


def _required_setting(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise EmailConfigurationError(
            f"Required email configuration is missing: {name}"
        )
    return value


def build_verification_url(raw_token: str) -> str:
    """Build a verification URL without logging or persisting the raw token."""
    if not isinstance(raw_token, str) or not raw_token.strip():
        raise ValueError("A non-empty verification token is required.")

    base_url = _required_setting("FRONTEND_URL").rstrip("/")

    try:
        parsed = urlsplit(base_url)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        raise EmailConfigurationError("FRONTEND_URL is invalid.") from None

    local_http = (
        parsed.scheme == "http"
        and hostname in {"localhost", "127.0.0.1"}
    )

    if (
        not hostname
        or parsed.scheme not in {"http", "https"}
        or (parsed.scheme == "http" and not local_http)
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
        or any(char.isspace() for char in base_url)
        or port is not None and not (1 <= port <= 65535)
    ):
        raise EmailConfigurationError(
            "FRONTEND_URL must be a valid HTTPS origin or local development URL."
        )

    return f"{base_url}/verify-email?{urlencode({'token': raw_token})}"


def send_verification_email(
    recipient: str,
    raw_token: str,
) -> None:
    """Send a 30-minute verification link through Resend.

    The token lifetime is enforced by the existing verification service.
    This function sends only; it does not create tokens or change account state.
    """
    if not isinstance(recipient, str) or not recipient.strip():
        raise ValueError("A valid recipient email address is required.")

    api_key = _required_setting("RESEND_API_KEY")
    sender = _required_setting("EMAIL_FROM")
    verification_url = build_verification_url(raw_token)
    html_verification_url = html.escape(verification_url, quote=True)

    resend.api_key = api_key

    params = {
        "from": sender,
        "to": [recipient.strip()],
        "subject": "Verify your iePDF account",
        "html": (
            "<p>Welcome to iePDF.</p>"
            "<p>Verify your email address using the link below. "
            "This link expires in 30 minutes and can only be used once.</p>"
            f'<p><a href="{html_verification_url}">Verify my email</a></p>'
            "<p>If you did not create this account, you can ignore this email.</p>"
        ),
        "text": (
            "Welcome to iePDF.\n\n"
            "Verify your email address using this link. "
            "It expires in 30 minutes and can only be used once:\n"
            f"{verification_url}\n\n"
            "If you did not create this account, you can ignore this email."
        ),
    }

    try:
        response = resend.Emails.send(params)
        if not getattr(response, "id", None):
            raise EmailDeliveryError("Email provider returned no message ID.")
    except EmailDeliveryError:
        raise
    except Exception:
        # Do not propagate provider responses that could expose sensitive details.
        raise EmailDeliveryError(
            "Verification email could not be sent. Check provider configuration."
        ) from None

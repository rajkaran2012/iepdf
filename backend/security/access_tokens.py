"""Short-lived HMAC access-token primitives for iePDF."""
import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import HTTPException

ACCESS_TOKEN_TTL_SECONDS = 60 * 60


def _secret() -> bytes:
    value = os.environ.get("AUTH_SECRET_KEY", "")
    if len(value.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="Account authentication is not configured.")
    return value.encode("utf-8")


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(user_id: int, *, now: int | None = None) -> str:
    issued = int(time.time()) if now is None else int(now)
    header = _b64encode(b'{"alg":"HS256","typ":"JWT"}')
    payload = _b64encode(json.dumps(
        {"sub": str(user_id), "iat": issued, "exp": issued + ACCESS_TOKEN_TTL_SECONDS},
        separators=(",", ":"),
    ).encode("utf-8"))
    unsigned = f"{header}.{payload}"
    signature = hmac.new(_secret(), unsigned.encode("ascii"), hashlib.sha256).digest()
    return f"{unsigned}.{_b64encode(signature)}"


def decode_access_token(token: str, *, now: int | None = None) -> int:
    try:
        header, payload, signature = token.split(".")
        unsigned = f"{header}.{payload}"
        expected = hmac.new(_secret(), unsigned.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(signature)):
            raise ValueError("signature")
        header_data = json.loads(_b64decode(header))
        data = json.loads(_b64decode(payload))
        if header_data != {"alg": "HS256", "typ": "JWT"}:
            raise ValueError("header")
        issued_value = data["iat"]
        expires_value = data["exp"]
        if (
            isinstance(issued_value, bool)
            or not isinstance(issued_value, int)
            or isinstance(expires_value, bool)
            or not isinstance(expires_value, int)
        ):
            raise ValueError("time claims must be integers")
        issued = issued_value
        expires = expires_value
        user_id = int(data["sub"])
        current = int(time.time()) if now is None else int(now)
        if user_id < 1 or issued > current + 60 or expires <= current or expires <= issued:
            raise ValueError("time")
        return user_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from None

"""Password hashing helpers for iePDF authentication."""

from pwdlib import PasswordHash

_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return an Argon2id password hash; never store the plaintext password."""
    if not isinstance(password, str) or not password:
        raise ValueError("Password must be a non-empty string.")
    return _password_hash.hash(password)


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Verify a password safely; reject missing or malformed stored hashes."""
    if not isinstance(password, str) or not password:
        return False
    if not isinstance(stored_hash, str) or not stored_hash:
        return False

    try:
        return _password_hash.verify(password, stored_hash)
    except Exception:
        return False

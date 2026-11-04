import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from security.access_tokens import (
    ACCESS_TOKEN_TTL_SECONDS,
    create_access_token,
    decode_access_token,
)


class AccessTokenTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"AUTH_SECRET_KEY": "test-secret-key-" * 3})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_round_trip_returns_user_id(self):
        token = create_access_token(123, now=1_800_000_000)
        self.assertEqual(
            decode_access_token(token, now=1_800_000_001),
            123,
        )

    def test_token_expires_at_expiry_boundary(self):
        issued = 1_800_000_000
        token = create_access_token(123, now=issued)
        with self.assertRaises(HTTPException) as caught:
            decode_access_token(
                token,
                now=issued + ACCESS_TOKEN_TTL_SECONDS,
            )
        self.assertEqual(caught.exception.status_code, 401)

    def test_tampered_token_is_rejected(self):
        token = create_access_token(123, now=1_800_000_000)
        parts = token.split(".")
        parts[1] = parts[1][:-1] + ("A" if parts[1][-1] != "A" else "B")
        with self.assertRaises(HTTPException) as caught:
            decode_access_token(".".join(parts), now=1_800_000_001)
        self.assertEqual(caught.exception.status_code, 401)

    def test_malformed_token_is_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            decode_access_token("not-a-valid-token")
        self.assertEqual(caught.exception.status_code, 401)

    def test_token_signed_with_wrong_secret_is_rejected(self):
        issued = 1_800_000_000
        token = create_access_token(123, now=issued)

        with patch.dict(os.environ, {"AUTH_SECRET_KEY": "different-secret-key-" * 2}):
            with self.assertRaises(HTTPException) as caught:
                decode_access_token(token, now=issued + 1)

        self.assertEqual(caught.exception.status_code, 401)

    def test_short_secret_fails_closed(self):
        with patch.dict(os.environ, {"AUTH_SECRET_KEY": "too-short"}):
            with self.assertRaises(HTTPException) as caught:
                create_access_token(123, now=1_800_000_000)
        self.assertEqual(caught.exception.status_code, 503)

    def test_future_issue_time_beyond_clock_skew_is_rejected(self):
        issued = 1_800_000_100
        token = create_access_token(123, now=issued)
        with self.assertRaises(HTTPException) as caught:
            decode_access_token(token, now=1_800_000_000)
        self.assertEqual(caught.exception.status_code, 401)

    def test_malformed_and_invalid_signed_claims_are_rejected(self):
        import base64
        import hashlib
        import hmac
        import json

        def encode(value):
            raw_value = value if isinstance(value, bytes) else json.dumps(
                value, separators=(",", ":")
            ).encode("utf-8")
            return base64.urlsafe_b64encode(raw_value).rstrip(b"=").decode("ascii")

        def signed_token(claims):
            header = encode(b'{"alg":"HS256","typ":"JWT"}')
            payload = encode(claims)
            unsigned = f"{header}.{payload}"
            signature = hmac.new(
                os.environ["AUTH_SECRET_KEY"].encode("utf-8"),
                unsigned.encode("ascii"),
                hashlib.sha256,
            ).digest()
            return f"{unsigned}.{encode(signature)}"

        now = 1_800_000_001
        cases = [
            ("malformed Base64", "!!!!.!!!!.!!!!"),
            ("missing subject", signed_token({"iat": now - 1, "exp": now + 100})),
            ("negative user ID", signed_token({"sub": "-1", "iat": now - 1, "exp": now + 100})),
            ("zero user ID", signed_token({"sub": "0", "iat": now - 1, "exp": now + 100})),
            ("decimal user ID", signed_token({"sub": "1.5", "iat": now - 1, "exp": now + 100})),
            ("invalid issue time", signed_token({"sub": "123", "iat": "bad", "exp": now + 100})),
        ]

        for label, token in cases:
            with self.subTest(case=label):
                with self.assertRaises(HTTPException) as caught:
                    decode_access_token(token, now=now)
                self.assertEqual(caught.exception.status_code, 401)

    def test_fractional_issue_and_expiry_claims_are_rejected(self):
        import base64
        import hashlib
        import hmac
        import json

        def encode(value):
            raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
            return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

        header = encode({"alg": "HS256", "typ": "JWT"})
        now = 1_800_000_001
        cases = [
            ("fractional issue time", {"sub": "123", "iat": now - 1.5, "exp": now + 100}),
            ("fractional expiry time", {"sub": "123", "iat": now - 1, "exp": now + 100.5}),
        ]

        for label, claims in cases:
            with self.subTest(case=label):
                payload = encode(claims)
                unsigned = f"{header}.{payload}"
                signature = hmac.new(
                    os.environ["AUTH_SECRET_KEY"].encode("utf-8"),
                    unsigned.encode("ascii"),
                    hashlib.sha256,
                ).digest()
                encoded_signature = (
                    base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
                )
                token = f"{unsigned}.{encoded_signature}"

                with self.assertRaises(HTTPException) as caught:
                    decode_access_token(token, now=now)
                self.assertEqual(caught.exception.status_code, 401)

if __name__ == "__main__":
    unittest.main(verbosity=2)

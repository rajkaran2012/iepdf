import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from security.email_verification import (
    TOKEN_TTL,
    create_verification_token,
    hash_verification_token,
    is_verification_token_expired,
)


class EmailVerificationTokenTests(unittest.TestCase):
    def test_token_is_random_and_hash_is_fixed_length(self):
        raw1, hash1, _ = create_verification_token()
        raw2, hash2, _ = create_verification_token()

        self.assertNotEqual(raw1, raw2)
        self.assertNotEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)
        self.assertNotEqual(raw1, hash1)
        self.assertEqual(hash1, hash_verification_token(raw1))

    def test_expiry_is_thirty_minutes(self):
        issued = datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc)
        _, _, expires = create_verification_token(now=issued)
        self.assertEqual(expires, issued + TOKEN_TTL)
        self.assertEqual(TOKEN_TTL, timedelta(minutes=30))

    def test_token_is_valid_before_expiry(self):
        expires = datetime(2026, 10, 12, 12, 30, tzinfo=timezone.utc)
        now = datetime(2026, 10, 12, 12, 29, tzinfo=timezone.utc)
        self.assertFalse(is_verification_token_expired(expires, now))

    def test_token_is_expired_at_expiry_boundary(self):
        expires = datetime(2026, 10, 12, 12, 30, tzinfo=timezone.utc)
        self.assertTrue(is_verification_token_expired(expires, expires))

    def test_naive_timestamps_are_rejected(self):
        naive = datetime(2026, 10, 12, 12, 0)
        with self.assertRaises(ValueError):
            create_verification_token(now=naive)
        with self.assertRaises(ValueError):
            is_verification_token_expired(naive)

    def test_empty_token_is_rejected(self):
        with self.assertRaises(ValueError):
            hash_verification_token("")


if __name__ == "__main__":
    unittest.main()

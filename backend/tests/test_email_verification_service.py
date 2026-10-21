import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from security.email_verification import hash_verification_token
from security.email_verification_service import consume_verification_token


class EmailVerificationServiceTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc)
        self.raw_token = "example-secure-token"
        self.token_record = SimpleNamespace(
            token_hash=hash_verification_token(self.raw_token),
            user_id=42,
            expires_at=self.now + timedelta(minutes=30),
            used_at=None,
        )
        self.user = SimpleNamespace(id=42, status="pending")
        self.session = MagicMock()
        self.token_result = MagicMock()
        self.user_result = MagicMock()
        self.session.execute.side_effect = [
            self.token_result,
            self.user_result,
        ]
        self.token_result.scalar_one_or_none.return_value = self.token_record
        self.user_result.scalar_one_or_none.return_value = self.user

    def test_valid_token_activates_pending_user_and_marks_token_used(self):
        result = consume_verification_token(
            self.session, self.raw_token, now=self.now
        )

        self.assertTrue(result)
        self.assertEqual(self.user.status, "active")
        self.assertEqual(self.token_record.used_at, self.now)
        self.session.commit.assert_not_called()

    def test_unknown_token_is_rejected(self):
        self.token_result.scalar_one_or_none.return_value = None

        self.assertFalse(
            consume_verification_token(
                self.session, self.raw_token, now=self.now
            )
        )
        self.user_result.scalar_one_or_none.assert_not_called()

    def test_used_token_is_rejected(self):
        self.token_record.used_at = self.now - timedelta(minutes=1)

        self.assertFalse(
            consume_verification_token(
                self.session, self.raw_token, now=self.now
            )
        )
        self.user_result.scalar_one_or_none.assert_not_called()

    def test_expired_token_is_rejected(self):
        self.token_record.expires_at = self.now

        self.assertFalse(
            consume_verification_token(
                self.session, self.raw_token, now=self.now
            )
        )
        self.user_result.scalar_one_or_none.assert_not_called()

    def test_non_pending_user_is_not_activated(self):
        self.user.status = "active"

        self.assertFalse(
            consume_verification_token(
                self.session, self.raw_token, now=self.now
            )
        )
        self.assertIsNone(self.token_record.used_at)

    def test_empty_token_is_rejected_without_database_access(self):
        self.assertFalse(
            consume_verification_token(self.session, "", now=self.now)
        )
        self.session.execute.assert_not_called()

    def test_naive_current_time_is_rejected(self):
        with self.assertRaises(ValueError):
            consume_verification_token(
                self.session,
                self.raw_token,
                now=datetime(2026, 10, 12, 12, 0),
            )

    def test_failed_verification_does_not_commit(self):
        self.token_result.scalar_one_or_none.return_value = None

        consume_verification_token(
            self.session, self.raw_token, now=self.now
        )

        self.session.commit.assert_not_called()



    def test_user_lookup_failure_propagates_without_mutating_records(self):
        self.session.execute.side_effect = [
            self.token_result,
            RuntimeError("database user lookup failure"),
        ]

        with self.assertRaisesRegex(
            RuntimeError, "database user lookup failure"
        ):
            consume_verification_token(
                self.session, self.raw_token, now=self.now
            )

        self.assertIsNone(self.token_record.used_at)
        self.assertEqual(self.user.status, "pending")
        self.session.commit.assert_not_called()
if __name__ == "__main__":
    unittest.main()

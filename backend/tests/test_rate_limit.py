import os
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from security.rate_limit import (
    RATE_LIMITS,
    _bucket_key,
    enforce_rate_limit,
)


class RateLimitTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.result = MagicMock()
        self.session.execute.return_value = self.result
        self.result.one.return_value = (
            datetime(2026, 10, 19, 15, 0, tzinfo=timezone.utc),
            1,
        )
        self.now = datetime(2026, 10, 19, 15, 5, tzinfo=timezone.utc)
        self.env = patch.dict(
            os.environ,
            {"AUTH_SECRET_KEY": "test-secret-key-that-is-at-least-32-bytes"},
        )
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_bucket_key_is_stable_and_does_not_expose_identifier(self):
        first = _bucket_key("login", "Person@example.com")
        second = _bucket_key("login", " person@example.com ")
        self.assertEqual(first, second)
        self.assertNotIn("person@example.com", first)
        self.assertEqual(len(first), 64)

    def test_bucket_key_requires_strong_secret(self):
        with patch.dict(os.environ, {"AUTH_SECRET_KEY": "short"}, clear=False):
            with self.assertRaises(RuntimeError):
                _bucket_key("login", "person@example.com")

    def test_allowed_request_commits_counter(self):
        self.result.one.return_value = (
            datetime(2026, 10, 19, 15, 0, tzinfo=timezone.utc),
            1,
        )
        enforce_rate_limit(
            self.session, "login", "person@example.com", now=self.now
        )
        self.session.commit.assert_called_once()
        self.session.rollback.assert_not_called()

    def test_limit_exceeded_returns_429_after_count_is_committed(self):
        limit = RATE_LIMITS["login"].requests
        self.result.one.return_value = (
            datetime(2026, 10, 19, 15, 0, tzinfo=timezone.utc),
            limit + 1,
        )
        with self.assertRaises(HTTPException) as caught:
            enforce_rate_limit(
                self.session, "login", "person@example.com", now=self.now
            )
        self.assertEqual(caught.exception.status_code, 429)
        self.session.commit.assert_called_once()

    def test_database_failure_fails_closed_with_503(self):
        self.session.execute.side_effect = RuntimeError("database detail")
        with self.assertRaises(HTTPException) as caught:
            enforce_rate_limit(
                self.session, "login", "person@example.com", now=self.now
            )
        self.assertEqual(caught.exception.status_code, 503)
        self.session.rollback.assert_called_once()
        self.assertNotIn("database detail", str(caught.exception.detail))

    def test_unknown_action_is_rejected(self):
        with self.assertRaises(ValueError):
            enforce_rate_limit(
                self.session, "unknown", "person@example.com", now=self.now
            )
        self.session.execute.assert_not_called()

    def test_empty_identifier_is_rejected(self):
        with self.assertRaises(ValueError):
            enforce_rate_limit(self.session, "login", "   ", now=self.now)
        self.session.execute.assert_not_called()

    def test_naive_datetime_is_accepted_as_utc(self):
        self.result.one.return_value = (
            datetime(2026, 10, 19, 15, 0, tzinfo=timezone.utc),
            1,
        )
        enforce_rate_limit(
            self.session,
            "login",
            "person@example.com",
            now=datetime(2026, 10, 19, 15, 5),
        )
        self.session.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()

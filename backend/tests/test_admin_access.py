import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from security.account_access import AccountContext
from security.admin_access import configured_admin_emails, require_admin


def make_account(email):
    return AccountContext(
        user=SimpleNamespace(email=email),
        session=object(),
        plan_id="free",
        special_merge_authorized=False,
    )


class AdminAccessTests(unittest.TestCase):
    def test_missing_allowlist_is_empty(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(configured_admin_emails(), frozenset())

    def test_allowlist_normalizes_and_deduplicates_emails(self):
        with patch.dict(
            os.environ,
            {"ADMIN_EMAILS": " Admin@example.com,admin@example.com, other@example.com "},
            clear=True,
        ):
            self.assertEqual(
                configured_admin_emails(),
                frozenset({"admin@example.com", "other@example.com"}),
            )

    def test_missing_allowlist_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as raised:
                require_admin(make_account("admin@example.com"))

        self.assertEqual(raised.exception.status_code, 503)

    def test_non_admin_is_forbidden(self):
        with patch.dict(
            os.environ,
            {"ADMIN_EMAILS": "admin@example.com"},
            clear=True,
        ):
            with self.assertRaises(HTTPException) as raised:
                require_admin(make_account("user@example.com"))

        self.assertEqual(raised.exception.status_code, 403)

    def test_allowlisted_email_is_authorized_case_insensitively(self):
        account = make_account("Admin@Example.com")

        with patch.dict(
            os.environ,
            {"ADMIN_EMAILS": " admin@example.com "},
            clear=True,
        ):
            result = require_admin(account)

        self.assertIs(result, account)

    def test_missing_account_email_is_forbidden(self):
        with patch.dict(
            os.environ,
            {"ADMIN_EMAILS": "admin@example.com"},
            clear=True,
        ):
            with self.assertRaises(HTTPException) as raised:
                require_admin(make_account(None))

        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)

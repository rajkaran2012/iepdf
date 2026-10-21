import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from security.account_access import require_account


class SubscriptionPlanResolutionTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user = MagicMock()
        self.user.id = 7
        self.user.status = "active"

        self.session = MagicMock()
        self.user_result = MagicMock()
        self.subscription_result = MagicMock()
        self.entitlement_result = MagicMock()

        self.session.execute.side_effect = [
            self.user_result,
            self.subscription_result,
            self.entitlement_result,
        ]
        self.user_result.scalar_one_or_none.return_value = self.user
        self.subscription_result.scalars.return_value.all.return_value = []
        self.entitlement_result.scalar_one_or_none.return_value = None

        self.credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="test-token",
        )

    def resolve(self, subscriptions):
        self.subscription_result.scalars.return_value.all.return_value = subscriptions
        with patch(
            "security.account_access.decode_access_token",
            return_value=7,
        ):
            return require_account(
                credentials=self.credentials,
                session=self.session,
            )

    def subscription(self, *, status="active", plan_id="paid",
                     starts_at=None, ends_at=None):
        item = MagicMock()
        item.status = status
        item.plan_id = plan_id
        item.starts_at = starts_at
        item.ends_at = ends_at
        return item

    def test_active_paid_subscription_grants_paid_plan(self):
        result = self.resolve([
            self.subscription(
                starts_at=self.now - timedelta(days=1),
                ends_at=self.now + timedelta(days=1),
            )
        ])
        self.assertEqual(result.plan_id, "paid")

    def test_expired_paid_subscription_does_not_grant_paid_plan(self):
        result = self.resolve([
            self.subscription(ends_at=self.now - timedelta(seconds=1))
        ])
        self.assertEqual(result.plan_id, "free")

    def test_future_start_paid_subscription_does_not_grant_paid_plan(self):
        result = self.resolve([
            self.subscription(starts_at=self.now + timedelta(days=1))
        ])
        self.assertEqual(result.plan_id, "free")

    def test_active_paid_subscription_with_no_dates_is_valid(self):
        result = self.resolve([self.subscription()])
        self.assertEqual(result.plan_id, "paid")

    def test_non_paid_plan_does_not_grant_paid_access(self):
        result = self.resolve([
            self.subscription(plan_id="free")
        ])
        self.assertEqual(result.plan_id, "free")

    def test_no_subscription_defaults_to_free_plan(self):
        result = self.resolve([])
        self.assertEqual(result.plan_id, "free")

    def test_inactive_account_is_rejected(self):
        self.user.status = "pending"
        with patch(
            "security.account_access.decode_access_token",
            return_value=7,
        ):
            with self.assertRaises(HTTPException) as raised:
                require_account(
                    credentials=self.credentials,
                    session=self.session,
                )
        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(self.session.execute.call_count, 1)


    def test_expired_special_merge_entitlement_is_not_authorized(self):
        entitlement = MagicMock()
        entitlement.status = "active"
        entitlement.expires_at = self.now
        entitlement.max_files = 200
        entitlement.max_file_size_bytes = 15 * 1024 * 1024
        entitlement.max_total_size_bytes = 200 * 1024 * 1024
        self.entitlement_result.scalar_one_or_none.return_value = entitlement

        with patch("security.account_access.datetime") as mocked_datetime:
            mocked_datetime.now.return_value = self.now
            mocked_datetime.side_effect = None
            with patch("security.account_access.decode_access_token", return_value=7):
                result = require_account(credentials=self.credentials, session=self.session)

        self.assertFalse(result.special_merge_authorized)
        self.assertIsNone(result.special_merge_max_files)
        self.assertIsNone(result.special_merge_max_file_size_bytes)
        self.assertIsNone(result.special_merge_max_total_size_bytes)

    def test_subscription_query_filters_to_active_status(self):
        self.resolve([])
        statement = self.session.execute.call_args_list[1].args[0]
        compiled = statement.compile()
        self.assertIn("status", str(statement.whereclause).lower())
        self.assertIn("active", compiled.params.values())

    def test_naive_utc_start_and_end_dates_are_supported(self):
        naive_now = self.now.replace(tzinfo=None)
        result = self.resolve([
            self.subscription(
                starts_at=naive_now - timedelta(days=1),
                ends_at=naive_now + timedelta(days=1),
            )
        ])
        self.assertEqual(result.plan_id, "paid")

    def test_naive_expired_end_date_does_not_grant_paid_plan(self):
        naive_now = self.now.replace(tzinfo=None)
        result = self.resolve([
            self.subscription(
                ends_at=naive_now - timedelta(seconds=1),
            )
        ])
        self.assertEqual(result.plan_id, "free")
if __name__ == "__main__":
    unittest.main(verbosity=2)

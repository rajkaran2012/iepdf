import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from models import Subscription
from security.account_access import require_account
from security.admin_access import require_admin


def make_account(user_id, email):
    return SimpleNamespace(
        user=SimpleNamespace(id=user_id, email=email),
        session=None,
        plan_id="free",
        special_merge_authorized=False,
    )


class AdminPlanSecurityTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.admin = make_account(1, "admin@example.com")
        self.admin.session = self.session

        def provide_account():
            return self.admin

        app.dependency_overrides.pop(require_admin, None)
        app.dependency_overrides[require_account] = provide_account
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.pop(require_account, None)
        app.dependency_overrides.pop(require_admin, None)

    def test_real_admin_guard_fails_closed_without_allowlist(self):
        with patch.dict(os.environ, {}, clear=True):
            response = self.client.post(
                "/accounts/admin/set-plan",
                json={"user_id": 2, "plan_id": "paid"},
            )

        self.assertEqual(response.status_code, 503, response.text)
        self.session.execute.assert_not_called()
        self.session.commit.assert_not_called()

    def test_real_admin_guard_rejects_non_admin(self):
        self.admin.user.email = "ordinary@example.com"

        with patch.dict(
            os.environ,
            {"ADMIN_EMAILS": "admin@example.com"},
            clear=True,
        ):
            response = self.client.post(
                "/accounts/admin/set-plan",
                json={"user_id": 2, "plan_id": "paid"},
            )

        self.assertEqual(response.status_code, 403, response.text)
        self.session.execute.assert_not_called()
        self.session.commit.assert_not_called()

    def test_admin_replaces_active_subscription_transactionally(self):
        target_user = SimpleNamespace(id=2, status="active")
        old_subscription = SimpleNamespace(
            status="active",
            plan_id="free",
            starts_at=None,
            ends_at=None,
        )

        target_result = MagicMock()
        target_result.scalar_one_or_none.return_value = target_user

        subscription_result = MagicMock()
        subscription_result.scalars.return_value.all.return_value = [
            old_subscription
        ]

        self.session.execute.side_effect = [
            target_result,
            subscription_result,
        ]

        with patch.dict(
            os.environ,
            {"ADMIN_EMAILS": "admin@example.com"},
            clear=True,
        ):
            response = self.client.post(
                "/accounts/admin/set-plan",
                json={"user_id": 2, "plan_id": "paid"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {"status": "updated", "user_id": 2, "plan_id": "paid"},
        )
        self.assertEqual(old_subscription.status, "cancelled")

        added_records = [
            call.args[0] for call in self.session.add.call_args_list
        ]
        subscriptions = [
            item for item in added_records if isinstance(item, Subscription)
        ]
        audits = [
            item for item in added_records
            if type(item).__name__ == "AdminPlanAudit"
        ]

        self.assertEqual(len(subscriptions), 1)
        self.assertEqual(subscriptions[0].user_id, 2)
        self.assertEqual(subscriptions[0].plan_id, "paid")
        self.assertEqual(subscriptions[0].status, "active")
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0].admin_user_id, 1)
        self.assertEqual(audits[0].target_user_id, 2)
        self.assertEqual(audits[0].previous_plan, "free")
        self.assertEqual(audits[0].assigned_plan, "paid")

        self.session.commit.assert_called_once()
        self.session.rollback.assert_not_called()


    def test_admin_previous_plan_for_effective_paid_subscription(self):
        from datetime import datetime, timedelta, timezone

        from models import AdminPlanAudit

        now = datetime.now(timezone.utc)
        scenarios = [
            (
                "active",
                now - timedelta(days=1),
                now + timedelta(days=1),
                "paid",
            ),
            (
                "expired",
                now - timedelta(days=2),
                now - timedelta(days=1),
                "free",
            ),
            (
                "future",
                now + timedelta(days=1),
                now + timedelta(days=2),
                "free",
            ),
            (
                "naive_active",
                (now - timedelta(days=1)).replace(tzinfo=None),
                (now + timedelta(days=1)).replace(tzinfo=None),
                "paid",
            ),
            ("no_dates", None, None, "paid"),
        ]

        for label, starts_at, ends_at, expected_plan in scenarios:
            with self.subTest(scenario=label):
                self.session.reset_mock()
                target_user = SimpleNamespace(id=2, status="active")
                old_subscription = SimpleNamespace(
                    status="active",
                    plan_id="paid",
                    starts_at=starts_at,
                    ends_at=ends_at,
                )

                target_result = MagicMock()
                target_result.scalar_one_or_none.return_value = target_user
                subscription_result = MagicMock()
                subscription_result.scalars.return_value.all.return_value = [
                    old_subscription
                ]
                self.session.execute.side_effect = [
                    target_result,
                    subscription_result,
                ]

                with patch.dict(
                    os.environ,
                    {"ADMIN_EMAILS": "admin@example.com"},
                    clear=True,
                ):
                    response = self.client.post(
                        "/accounts/admin/set-plan",
                        json={"user_id": 2, "plan_id": "free"},
                    )

                self.assertEqual(response.status_code, 200, response.text)
                added_records = [
                    call.args[0]
                    for call in self.session.add.call_args_list
                ]
                audits = [
                    item for item in added_records
                    if isinstance(item, AdminPlanAudit)
                ]
                self.assertEqual(len(audits), 1)
                self.assertEqual(audits[0].previous_plan, expected_plan)
                self.session.commit.assert_called_once()
                self.session.rollback.assert_not_called()

if __name__ == "__main__":
    unittest.main(verbosity=2)

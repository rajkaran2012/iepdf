import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from routers.accounts import get_db
from security.admin_access import require_admin


class AdminPlanApiTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.admin = SimpleNamespace(
            user=SimpleNamespace(id=1, email="admin@example.com"),
            session=self.session,
            plan_id="free",
            special_merge_authorized=False,
        )

        def override_get_db():
            yield self.session

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[require_admin] = lambda: self.admin
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(require_admin, None)

    def test_rejects_invalid_plan(self):
        response = self.client.post(
            "/accounts/admin/set-plan",
            json={"user_id": 2, "plan_id": "enterprise"},
        )
        self.assertEqual(response.status_code, 422)
        self.session.commit.assert_not_called()

    def test_rejects_extra_fields(self):
        response = self.client.post(
            "/accounts/admin/set-plan",
            json={"user_id": 2, "plan_id": "paid", "admin": True},
        )
        self.assertEqual(response.status_code, 422)
        self.session.commit.assert_not_called()

    def test_missing_target_rolls_back(self):
        self.session.execute.return_value.scalar_one_or_none.return_value = None

        response = self.client.post(
            "/accounts/admin/set-plan",
            json={"user_id": 999, "plan_id": "paid"},
        )

        self.assertEqual(response.status_code, 404, response.text)
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()

    def test_inactive_target_rolls_back(self):
        target = SimpleNamespace(id=2, status="pending")
        self.session.execute.return_value.scalar_one_or_none.return_value = target

        response = self.client.post(
            "/accounts/admin/set-plan",
            json={"user_id": 2, "plan_id": "paid"},
        )

        self.assertEqual(response.status_code, 404, response.text)
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()
    def test_database_error_rolls_back(self):
        self.session.execute.side_effect = RuntimeError("simulated database failure")

        response = self.client.post(
            "/accounts/admin/set-plan",
            json={"user_id": 2, "plan_id": "paid"},
        )

        self.assertEqual(response.status_code, 500, response.text)
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()


    def test_commit_failure_rolls_back(self):
        target = SimpleNamespace(id=2, status="active")
        old_subscription = SimpleNamespace(status="active", plan_id="free")

        self.session.execute.side_effect = [
            SimpleNamespace(scalar_one_or_none=MagicMock(return_value=target)),
            SimpleNamespace(scalars=MagicMock(return_value=SimpleNamespace(all=MagicMock(return_value=[old_subscription])))),
        ]
        self.session.commit.side_effect = RuntimeError("simulated commit failure")

        response = self.client.post(
            "/accounts/admin/set-plan",
            json={"user_id": 2, "plan_id": "paid"},
        )

        self.assertEqual(response.status_code, 500, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Plan assignment could not be completed.",
        )
        self.session.flush.assert_called_once()
        self.session.commit.assert_called_once()
        self.session.rollback.assert_called_once()

    def test_flush_failure_rolls_back(self):
        target = SimpleNamespace(id=2, status="active")
        old_subscription = SimpleNamespace(status="active", plan_id="free")

        self.session.execute.side_effect = [
            SimpleNamespace(scalar_one_or_none=MagicMock(return_value=target)),
            SimpleNamespace(scalars=MagicMock(return_value=SimpleNamespace(all=MagicMock(return_value=[old_subscription])))),
        ]
        self.session.flush.side_effect = RuntimeError("simulated audit flush failure")

        response = self.client.post(
            "/accounts/admin/set-plan",
            json={"user_id": 2, "plan_id": "paid"},
        )

        self.assertEqual(response.status_code, 500, response.text)
        self.session.flush.assert_called_once()
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()
if __name__ == "__main__":
    unittest.main(verbosity=2)

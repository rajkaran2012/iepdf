import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app
import routers.accounts as accounts_router
import security.account_access as account_access


class BrowserTaskReservationApiTests(unittest.TestCase):
    def setUp(self):
        self.context = MagicMock()
        self.context.plan_id = "free"

        self.previous_overrides = dict(app.dependency_overrides)

        def override_account():
            return self.context

        app.dependency_overrides[accounts_router.require_account] = override_account

        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous_overrides)

    def test_me_returns_free_plan_features(self):
        self.context.user.id = 42
        self.context.plan_id = "free"
        self.context.special_merge_authorized = False

        response = self.client.get("/accounts/me")

        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["user_id"], 42)
        self.assertEqual(data["plan_id"], "free")
        self.assertEqual(data["daily_task_limit"], 10)
        self.assertTrue(data["show_ads"])
        self.assertTrue(data["watermark_enabled"])
        self.assertFalse(data["priority_eligible"])
        self.assertEqual(data["tools"]["merge"]["max_files"], 5)
        self.assertEqual(data["tools"]["jpg-to-pdf"]["max_files"], 5)

    def test_me_returns_paid_plan_features(self):
        self.context.user.id = 43
        self.context.plan_id = "paid"
        self.context.special_merge_authorized = False

        response = self.client.get("/accounts/me")

        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["plan_id"], "paid")
        self.assertIsNone(data["daily_task_limit"])
        self.assertFalse(data["show_ads"])
        self.assertFalse(data["watermark_enabled"])
        self.assertTrue(data["priority_eligible"])
        self.assertEqual(data["tools"]["merge"]["max_files"], 100)
        self.assertEqual(data["tools"]["merge"]["max_file_size_bytes"], 500 * 1024 * 1024)

    def test_me_applies_authorized_special_merge_limit(self):
        self.context.user.id = 44
        self.context.plan_id = "free"
        self.context.special_merge_authorized = True

        response = self.client.get("/accounts/me")

        self.assertEqual(response.status_code, 200, response.text)
        merge = response.json()["tools"]["merge"]
        self.assertEqual(merge["max_files"], 200)
        self.assertEqual(merge["max_file_size_bytes"], 15 * 1024 * 1024)
        self.assertEqual(merge["max_total_size_bytes"], 200 * 1024 * 1024)

    def test_valid_browser_tool_reserves_task(self):
        with patch("routers.accounts.reserve_daily_task") as reserve:
            response = self.client.post(
                "/accounts/reserve-task",
                json={"tool_id": "split"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {"status": "reserved", "tool_id": "split"},
        )
        reserve.assert_called_once_with(self.context, "split")

    def test_each_browser_tool_is_accepted(self):
        allowed_tools = ("merge", "split", "compress", "pdf-to-jpg", "jpg-to-pdf")

        with patch("routers.accounts.reserve_daily_task") as reserve:
            for tool_id in allowed_tools:
                response = self.client.post(
                    "/accounts/reserve-task",
                    json={"tool_id": tool_id},
                )
                self.assertEqual(
                    response.status_code,
                    200,
                    f"{tool_id}: {response.text}",
                )

        self.assertEqual(reserve.call_count, len(allowed_tools))

    def test_compress_is_accepted_by_browser_reservation_endpoint(self):
        with patch("routers.accounts.reserve_daily_task") as reserve:
            response = self.client.post(
                "/accounts/reserve-task",
                json={"tool_id": "compress"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {"status": "reserved", "tool_id": "compress"},
        )
        reserve.assert_called_once_with(self.context, "compress")

    def test_extra_client_supplied_plan_field_is_rejected(self):
        with patch("routers.accounts.reserve_daily_task") as reserve:
            response = self.client.post(
                "/accounts/reserve-task",
                json={"tool_id": "split", "plan_id": "paid"},
            )

        self.assertEqual(response.status_code, 422)
        reserve.assert_not_called()

    def test_missing_bearer_token_is_rejected(self):
        app.dependency_overrides.pop(accounts_router.require_account, None)

        def override_account_db():
            yield MagicMock()

        app.dependency_overrides[account_access.get_db] = override_account_db

        with patch("routers.accounts.reserve_daily_task") as reserve:
            response = self.client.post(
                "/accounts/reserve-task",
                json={"tool_id": "split"},
            )

        self.assertEqual(response.status_code, 401, response.text)
        reserve.assert_not_called()


if __name__ == "__main__":
    unittest.main()

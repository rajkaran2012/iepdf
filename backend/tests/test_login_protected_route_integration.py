import os
import unittest
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from pypdf import PdfWriter

from main import app
import routers.accounts as accounts_router
import routers.split as split_router
import security.account_access as account_access


class LoginToProtectedRouteTests(unittest.TestCase):
    def setUp(self):
        self.rate_limit_patch = patch("routers.accounts.enforce_rate_limit")
        self.rate_limit_patch.start()
        self.addCleanup(self.rate_limit_patch.stop)

        self.secret_patch = patch.dict(
            os.environ,
            {"AUTH_SECRET_KEY": "integration-test-secret-key-123456789"},
        )
        self.secret_patch.start()
        self.addCleanup(self.secret_patch.stop)

        self.login_session = MagicMock()
        self.account_session = MagicMock()

        self.user = MagicMock()
        self.user.id = 7
        self.user.email = "integration@example.com"
        self.user.password_hash = "mocked-password-hash"
        self.user.status = "active"

        login_result = MagicMock()
        login_result.scalar_one_or_none.return_value = self.user
        self.login_session.execute.return_value = login_result

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = self.user

        subscriptions_result = MagicMock()
        subscriptions_result.scalars.return_value.all.return_value = []

        entitlement_result = MagicMock()
        entitlement_result.scalar_one_or_none.return_value = None

        self.account_session.execute.side_effect = [
            user_result,
            subscriptions_result,
            entitlement_result,
        ]

        def override_login_db():
            yield self.login_session

        def override_account_db():
            yield self.account_session

        sentinel = object()
        self.previous = {}
        overrides = {
            accounts_router.get_db: override_login_db,
            account_access.get_db: override_account_db,
        }

        for dependency, replacement in overrides.items():
            self.previous[dependency] = app.dependency_overrides.get(
                dependency, sentinel
            )
            app.dependency_overrides[dependency] = replacement

        def restore_overrides():
            for dependency, previous in self.previous.items():
                if previous is sentinel:
                    app.dependency_overrides.pop(dependency, None)
                else:
                    app.dependency_overrides[dependency] = previous

        self.addCleanup(restore_overrides)
        self.client = TestClient(app, raise_server_exceptions=False)

    def make_pdf(self):
        writer = PdfWriter()
        writer.add_blank_page(width=300, height=400)
        output = BytesIO()
        writer.write(output)
        return output.getvalue()

    def test_login_token_authenticates_protected_split_route(self):
        with patch("routers.accounts.verify_password", return_value=True):
            login_response = self.client.post(
                "/accounts/login",
                json={
                    "email": "integration@example.com",
                    "password": "IntegrationTestPassword123!",
                },
            )

        self.assertEqual(login_response.status_code, 200, login_response.text)
        body = login_response.json()
        self.assertEqual(body["token_type"], "bearer")
        self.assertEqual(body["expires_in"], 3600)
        token = body["access_token"]
        self.assertTrue(token)

        with patch.object(
            split_router, "enforce_tool_access", new_callable=AsyncMock
        ) as enforce:
            response = self.client.post(
                "/split-pdf",
                headers={"Authorization": f"Bearer {token}"},
                files={
                    "file": (
                        "integration.pdf",
                        BytesIO(self.make_pdf()),
                        "application/pdf",
                    )
                },
            )

        self.assertEqual(response.status_code, 200, response.text[:500])
        self.assertEqual(self.account_session.execute.call_count, 3)
        enforce.assert_awaited_once()

        with patch.object(
            split_router, "enforce_tool_access", new_callable=AsyncMock
        ):
            invalid_response = self.client.post(
                "/split-pdf",
                headers={"Authorization": "Bearer invalid-token"},
                files={
                    "file": (
                        "integration.pdf",
                        BytesIO(self.make_pdf()),
                        "application/pdf",
                    )
                },
            )

        self.assertEqual(invalid_response.status_code, 401, invalid_response.text)


    def test_existing_token_is_rejected_after_account_becomes_pending(self):
        with patch("routers.accounts.verify_password", return_value=True):
            login_response = self.client.post(
                "/accounts/login",
                json={
                    "email": "integration@example.com",
                    "password": "IntegrationTestPassword123!",
                },
            )

        self.assertEqual(login_response.status_code, 200, login_response.text)
        token = login_response.json()["access_token"]

        self.user.status = "pending"

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = self.user
        self.account_session.execute.side_effect = [user_result]

        with patch.object(
            split_router, "enforce_tool_access", new_callable=AsyncMock
        ) as enforce:
            response = self.client.post(
                "/split-pdf",
                headers={"Authorization": f"Bearer {token}"},
                files={
                    "file": (
                        "integration.pdf",
                        BytesIO(self.make_pdf()),
                        "application/pdf",
                    )
                },
            )

        self.assertEqual(response.status_code, 403, response.text)
        self.assertEqual(self.account_session.execute.call_count, 1)
        enforce.assert_not_awaited()


    def test_admin_plan_rejects_missing_bearer_token(self):
        with patch.dict(os.environ, {"ADMIN_EMAILS": "admin@example.com"}):
            response = self.client.post(
                "/accounts/admin/set-plan",
                json={"user_id": 2, "plan_id": "paid"},
            )

        self.assertEqual(response.status_code, 401, response.text)
        self.account_session.execute.assert_not_called()
        self.account_session.commit.assert_not_called()

    def test_admin_plan_rejects_authenticated_non_admin(self):
        with patch("routers.accounts.verify_password", return_value=True):
            login_response = self.client.post(
                "/accounts/login",
                json={
                    "email": "integration@example.com",
                    "password": "IntegrationTestPassword123!",
                },
            )

        self.assertEqual(login_response.status_code, 200, login_response.text)
        token = login_response.json()["access_token"]
        self.account_session.reset_mock()
        self.account_session.execute.side_effect = None

        with patch.dict(os.environ, {"ADMIN_EMAILS": "admin@example.com"}):
            response = self.client.post(
                "/accounts/admin/set-plan",
                headers={"Authorization": f"Bearer {token}"},
                json={"user_id": 2, "plan_id": "paid"},
            )

        self.assertEqual(response.status_code, 403, response.text)
        self.assertEqual(self.account_session.execute.call_count, 1)
        self.account_session.commit.assert_not_called()

if __name__ == "__main__":
    unittest.main()

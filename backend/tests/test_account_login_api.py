import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from routers.accounts import get_db


class AccountLoginApiTests(unittest.TestCase):
    def setUp(self):
        self.rate_limit_patch = patch("routers.accounts.enforce_rate_limit")
        self.mock_rate_limit = self.rate_limit_patch.start()
        self.addCleanup(self.rate_limit_patch.stop)
        self.session = MagicMock()
        self.user = MagicMock(
            id=7,
            email="person@example.com",
            password_hash="test-password-hash",
            status="active",
        )

        def override_get_db():
            yield self.session

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def configure_user(self, user):
        self.session.execute.return_value.scalar_one_or_none.return_value = user

    def test_successful_login_returns_bearer_token(self):
        self.configure_user(self.user)

        with (
            patch("routers.accounts.verify_password", return_value=True) as verify,
            patch("routers.accounts.create_access_token", return_value="test-access-token") as create_token,
        ):
            response = self.client.post(
                "/accounts/login",
                json={
                    "email": "  PERSON@Example.COM  ",
                    "password": "SafeTestPassword123!",
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {
                "access_token": "test-access-token",
                "token_type": "bearer",
                "expires_in": 3600,
            },
        )
        verify.assert_called_once_with(
            "SafeTestPassword123!",
            "test-password-hash",
        )
        create_token.assert_called_once_with(7)

    def test_wrong_password_returns_generic_401(self):
        self.configure_user(self.user)

        with patch("routers.accounts.verify_password", return_value=False):
            response = self.client.post(
                "/accounts/login",
                json={
                    "email": "person@example.com",
                    "password": "WrongPassword123!",
                },
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json()["detail"],
            "Invalid credentials or account not verified.",
        )
        self.assertEqual(response.headers.get("www-authenticate"), "Bearer")

    def test_pending_account_cannot_login(self):
        self.user.status = "pending"
        self.configure_user(self.user)

        with (
            patch("routers.accounts.verify_password", return_value=True),
            patch("routers.accounts.create_access_token") as create_token,
        ):
            response = self.client.post(
                "/accounts/login",
                json={
                    "email": "person@example.com",
                    "password": "SafeTestPassword123!",
                },
            )

        self.assertEqual(response.status_code, 401)
        create_token.assert_not_called()

    def test_unknown_account_returns_generic_401(self):
        self.configure_user(None)

        with (
            patch("routers.accounts.verify_password") as verify,
            patch("routers.accounts.create_access_token") as create_token,
        ):
            response = self.client.post(
                "/accounts/login",
                json={
                    "email": "unknown@example.com",
                    "password": "SafeTestPassword123!",
                },
            )

        self.assertEqual(response.status_code, 401)
        verify.assert_not_called()
        create_token.assert_not_called()

    def test_invalid_email_is_rejected(self):
        response = self.client.post(
            "/accounts/login",
            json={
                "email": "not-an-email",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.session.execute.assert_not_called()

    def test_extra_login_fields_are_rejected(self):
        response = self.client.post(
            "/accounts/login",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
                "status": "active",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.session.execute.assert_not_called()


    def test_inactive_account_cannot_login(self):
        self.user.status = "inactive"
        self.configure_user(self.user)
        with (
            patch("routers.accounts.verify_password", return_value=True),
            patch("routers.accounts.create_access_token") as create_token,
        ):
            response = self.client.post(
                "/accounts/login",
                json={"email": "person@example.com", "password": "SafeTestPassword123!"},
            )
        self.assertEqual(response.status_code, 401)
        create_token.assert_not_called()

    def test_database_lookup_failure_returns_generic_500(self):
        self.session.execute.side_effect = RuntimeError("sensitive database detail")
        response = self.client.post(
            "/accounts/login",
            json={"email": "person@example.com", "password": "SafeTestPassword123!"},
        )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Login could not be completed.")
        self.assertNotIn("sensitive database detail", response.text)

    def test_token_creation_failure_returns_generic_500(self):
        self.configure_user(self.user)
        with (
            patch("routers.accounts.verify_password", return_value=True),
            patch("routers.accounts.create_access_token", side_effect=RuntimeError("secret detail")),
        ):
            response = self.client.post(
                "/accounts/login",
                json={"email": "person@example.com", "password": "SafeTestPassword123!"},
            )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Login could not be completed.")
        self.assertNotIn("secret detail", response.text)

    def test_password_verification_exception_returns_generic_500(self):
        self.configure_user(self.user)
        with patch(
            "routers.accounts.verify_password",
            side_effect=RuntimeError("password verification detail"),
        ):
            response = self.client.post(
                "/accounts/login",
                json={"email": "person@example.com", "password": "SafeTestPassword123!"},
            )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Login could not be completed.")
        self.assertNotIn("password verification detail", response.text)


if __name__ == "__main__":
    unittest.main()

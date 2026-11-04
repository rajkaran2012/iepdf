import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from routers.accounts import get_db


class AccountVerificationApiTests(unittest.TestCase):
    def setUp(self):
        self.rate_limit_patch = patch("routers.accounts.enforce_rate_limit")
        self.mock_rate_limit = self.rate_limit_patch.start()
        self.addCleanup(self.rate_limit_patch.stop)
        self.session = MagicMock()

        def override_get_db():
            yield self.session

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def test_successful_verification_commits(self):
        with patch(
            "routers.accounts.consume_verification_token",
            return_value=True,
        ):
            response = self.client.post(
                "/accounts/verify-email",
                json={"token": "valid-test-token"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"status": "verified"})
        self.session.commit.assert_called_once()
        self.session.rollback.assert_not_called()

    def test_invalid_token_rolls_back(self):
        with patch(
            "routers.accounts.consume_verification_token",
            return_value=False,
        ):
            response = self.client.post(
                "/accounts/verify-email",
                json={"token": "invalid-test-token"},
            )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Verification link is invalid or expired.",
        )
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()

    def test_missing_token_is_rejected(self):
        response = self.client.post("/accounts/verify-email", json={})

        self.assertEqual(response.status_code, 422)
        self.session.commit.assert_not_called()

    def test_empty_token_is_rejected(self):
        response = self.client.post(
            "/accounts/verify-email",
            json={"token": ""},
        )

        self.assertEqual(response.status_code, 422)
        self.session.commit.assert_not_called()

    def test_oversized_token_is_rejected_before_verification(self):
        with patch("routers.accounts.consume_verification_token") as consume:
            response = self.client.post(
                "/accounts/verify-email",
                json={"token": "T" * 513},
            )

        self.assertEqual(response.status_code, 422, response.text)
        consume.assert_not_called()
        self.session.commit.assert_not_called()
    def test_extra_fields_are_rejected(self):
        response = self.client.post(
            "/accounts/verify-email",
            json={"token": "valid-test-token", "password": "unexpected"},
        )

        self.assertEqual(response.status_code, 422)
        self.session.commit.assert_not_called()

    def test_database_failure_rolls_back_and_returns_controlled_error(self):
        with patch(
            "routers.accounts.consume_verification_token",
            side_effect=RuntimeError("internal test failure"),
        ):
            response = self.client.post(
                "/accounts/verify-email",
                json={"token": "valid-test-token"},
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "Email verification could not be completed.",
        )
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()



    def test_commit_failure_rolls_back_and_returns_controlled_error(self):
        self.session.commit.side_effect = RuntimeError("database commit failure")

        with patch(
            "routers.accounts.consume_verification_token",
            return_value=True,
        ):
            response = self.client.post(
                "/accounts/verify-email",
                json={"token": "valid-test-token"},
            )

        self.assertEqual(response.status_code, 500, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Email verification could not be completed.",
        )
        self.session.commit.assert_called_once()
        self.session.rollback.assert_called_once()
if __name__ == "__main__":
    unittest.main(verbosity=2)

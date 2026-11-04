import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from models import EmailVerificationToken, User
from routers.accounts import get_db
from security.email_sender import EmailDeliveryError


class AccountRegistrationApiTests(unittest.TestCase):
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

    def configure_new_user(self):
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = None

        tokens_result = MagicMock()
        tokens_result.scalars.return_value.all.return_value = []

        self.session.execute.side_effect = [user_result, tokens_result]

        def assign_test_id():
            for call in self.session.add.call_args_list:
                obj = call.args[0]
                if isinstance(obj, User) and obj.id is None:
                    obj.id = 123

        self.session.flush.side_effect = assign_test_id

    def test_invalid_email_is_rejected(self):
        response = self.client.post(
            "/accounts/register",
            json={
                "email": "not-an-email",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.session.execute.assert_not_called()
        self.session.commit.assert_not_called()

    def test_short_password_is_rejected(self):
        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "short",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.session.execute.assert_not_called()

    def test_extra_registration_fields_are_rejected(self):
        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
                "status": "active",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.session.execute.assert_not_called()

    @patch("routers.accounts.send_verification_email")
    @patch("routers.accounts.create_verification_token")
    @patch("routers.accounts.hash_password", return_value="test-password-hash")
    def test_new_registration_creates_pending_user_and_sends_email(
        self, hash_mock, token_mock, email_mock
    ):
        self.configure_new_user()
        now = datetime.now(timezone.utc)
        token_mock.return_value = (
            "raw-test-token",
            "hashed-test-token",
            now + timedelta(minutes=30),
        )

        response = self.client.post(
            "/accounts/register",
            json={
                "email": "  PERSON@Example.COM  ",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(response.json()["status"], "accepted")
        hash_mock.assert_called_once_with("SafeTestPassword123!")
        email_mock.assert_called_once_with(
            "person@example.com", "raw-test-token"
        )
        self.session.commit.assert_called_once()

        added = [call.args[0] for call in self.session.add.call_args_list]
        users = [obj for obj in added if isinstance(obj, User)]
        tokens = [
            obj for obj in added
            if isinstance(obj, EmailVerificationToken)
        ]

        self.assertEqual(len(users), 1)
        self.assertEqual(users[0].email, "person@example.com")
        self.assertEqual(users[0].status, "pending")
        self.assertEqual(users[0].password_hash, "test-password-hash")
        self.assertEqual(len(tokens), 1)
        self.assertEqual(tokens[0].token_hash, "hashed-test-token")
        self.assertNotEqual(tokens[0].token_hash, "raw-test-token")

    @patch("routers.accounts.send_verification_email")
    def test_existing_active_account_gets_generic_response_without_email(
        self, email_mock
    ):
        active_user = User(
            email="person@example.com",
            password_hash="existing-hash",
            status="active",
        )
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = active_user
        self.session.execute.return_value = user_result

        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(response.json()["status"], "accepted")
        email_mock.assert_not_called()
        self.session.commit.assert_not_called()

    @patch(
        "routers.accounts.send_verification_email",
        side_effect=EmailDeliveryError("simulated provider failure"),
    )
    @patch("routers.accounts.create_verification_token")
    @patch("routers.accounts.hash_password", return_value="test-password-hash")
    def test_email_failure_returns_controlled_error_after_commit(
        self, hash_mock, token_mock, email_mock
    ):
        self.configure_new_user()
        now = datetime.now(timezone.utc)
        token_mock.return_value = (
            "raw-test-token",
            "hashed-test-token",
            now + timedelta(minutes=30),
        )

        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 503, response.text)
        self.assertEqual(
            response.json()["detail"],
            "The account is pending, but the verification email could not be sent. Please retry registration.",
        )
        self.session.commit.assert_called_once()
        self.session.rollback.assert_not_called()
        email_mock.assert_called_once()

    def test_database_failure_rolls_back_with_controlled_error(self):
        self.session.execute.side_effect = RuntimeError("simulated database failure")

        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 500, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Registration could not be completed.",
        )
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()


    @patch(
        "routers.accounts.send_verification_email",
        side_effect=EmailDeliveryError("simulated retry delivery failure"),
    )
    @patch("routers.accounts.create_verification_token")
    def test_pending_account_retry_email_failure_rotates_token_and_commits(
        self, token_mock, email_mock
    ):
        now = datetime.now(timezone.utc)
        pending_user = User(
            id=456,
            email="person@example.com",
            password_hash="existing-password-hash",
            status="pending",
        )
        old_token = EmailVerificationToken(
            user_id=456,
            token_hash="old-token-hash",
            expires_at=now + timedelta(minutes=10),
        )

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = pending_user

        tokens_result = MagicMock()
        tokens_result.scalars.return_value.all.return_value = [old_token]

        self.session.execute.side_effect = [user_result, tokens_result]
        token_mock.return_value = (
            "replacement-raw-token",
            "replacement-hash",
            now + timedelta(minutes=30),
        )

        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 503, response.text)
        self.assertIsNotNone(old_token.used_at)
        token_mock.assert_called_once()
        email_mock.assert_called_once_with(
            "person@example.com", "replacement-raw-token"
        )
        self.session.add.assert_called_once()
        added_token = self.session.add.call_args.args[0]
        self.assertIsInstance(added_token, EmailVerificationToken)
        self.assertEqual(added_token.token_hash, "replacement-hash")
        self.assertNotEqual(added_token.token_hash, "replacement-raw-token")
        self.session.commit.assert_called_once()
        self.session.rollback.assert_not_called()

    @patch("routers.accounts.send_verification_email")
    def test_integrity_error_rolls_back_and_returns_generic_accepted_response(
        self, email_mock
    ):
        from sqlalchemy.exc import IntegrityError

        self.session.execute.side_effect = IntegrityError(
            "registration",
            {},
            Exception("simulated unique constraint conflict"),
        )

        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(response.json()["status"], "accepted")
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()
        email_mock.assert_not_called()

    def test_registration_rejects_input_length_boundaries(self):
        invalid_payloads = [
            {
                "email": "a" * 310 + "@example.com",
                "password": "SafeTestPassword123!",
            },
            {
                "email": "person@example.com",
                "password": "P" * 129,
            },
            {
                "email": "ab",
                "password": "SafeTestPassword123!",
            },
        ]

        for payload in invalid_payloads:
            with self.subTest(
                email_length=len(payload["email"]),
                password_length=len(payload["password"]),
            ):
                self.session.reset_mock()

                response = self.client.post(
                    "/accounts/register",
                    json=payload,
                )

                self.assertEqual(response.status_code, 422, response.text)
                self.session.execute.assert_not_called()
                self.session.commit.assert_not_called()

    @patch("routers.accounts.send_verification_email")
    @patch("routers.accounts.create_verification_token")
    @patch("routers.accounts.hash_password", return_value="repaired-password-hash")
    def test_pending_account_without_password_hash_sets_hash(
        self, hash_mock, token_mock, email_mock
    ):
        now = datetime.now(timezone.utc)
        pending_user = User(
            id=789,
            email="person@example.com",
            password_hash="",
            status="pending",
        )

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = pending_user

        tokens_result = MagicMock()
        tokens_result.scalars.return_value.all.return_value = []

        self.session.execute.side_effect = [user_result, tokens_result]
        token_mock.return_value = (
            "raw-repair-token",
            "hashed-repair-token",
            now + timedelta(minutes=30),
        )

        response = self.client.post(
            "/accounts/register",
            json={
                "email": "person@example.com",
                "password": "SafeTestPassword123!",
            },
        )

        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(pending_user.password_hash, "repaired-password-hash")
        self.assertEqual(pending_user.status, "pending")
        hash_mock.assert_called_once_with("SafeTestPassword123!")
        self.session.commit.assert_called_once()
        self.session.rollback.assert_not_called()
        email_mock.assert_called_once_with(
            "person@example.com", "raw-repair-token"
        )


    def test_commit_failure_rolls_back_and_returns_controlled_error(self):
        self.session.execute.return_value.scalar_one_or_none.return_value = None
        self.session.commit.side_effect = RuntimeError(
            "database commit failure"
        )

        with (
            patch(
                "routers.accounts.create_verification_token",
                return_value=(
                    "raw-commit-failure-token",
                    "hashed-commit-failure-token",
                    datetime.now(timezone.utc) + timedelta(minutes=30),
                ),
            ),
            patch("routers.accounts.send_verification_email") as email_mock,
        ):
            response = self.client.post(
                "/accounts/register",
                json={
                    "email": "commit-failure@example.com",
                    "password": "StrongPassword123!",
                },
            )

        self.assertEqual(response.status_code, 500, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Registration could not be completed.",
        )
        self.session.commit.assert_called_once()
        self.session.rollback.assert_called_once()
        email_mock.assert_not_called()

    @patch(
        "routers.accounts.hash_password",
        side_effect=RuntimeError("simulated password hashing failure"),
    )
    def test_password_hashing_failure_rolls_back_without_sending_email(
        self, hash_mock
    ):
        self.session.execute.return_value.scalar_one_or_none.return_value = None

        with patch("routers.accounts.send_verification_email") as email_mock:
            response = self.client.post(
                "/accounts/register",
                json={
                    "email": "hash-failure@example.com",
                    "password": "StrongPassword123!",
                },
            )

        self.assertEqual(response.status_code, 500, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Registration could not be completed.",
        )
        hash_mock.assert_called_once_with("StrongPassword123!")
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()
        email_mock.assert_not_called()
if __name__ == "__main__":
    unittest.main(verbosity=2)

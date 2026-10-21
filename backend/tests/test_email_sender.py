import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from security.email_sender import (
    EmailConfigurationError,
    EmailDeliveryError,
    build_verification_url,
    send_verification_email,
)


class EmailSenderTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {
                "RESEND_API_KEY": "re_test_dummy_key",
                "EMAIL_FROM": "iePDF Test <test@example.com>",
                "FRONTEND_URL": "https://iepdf.example",
            },
            clear=True,
        )
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_builds_encoded_verification_url(self):
        url = build_verification_url("test_token-123")
        self.assertEqual(
            url,
            "https://iepdf.example/verify-email?token=test_token-123",
        )

    def test_empty_token_is_rejected(self):
        with self.assertRaises(ValueError):
            build_verification_url("")

    def test_missing_frontend_url_is_rejected(self):
        os.environ.pop("FRONTEND_URL")
        with self.assertRaises(EmailConfigurationError):
            build_verification_url("token123")

    def test_insecure_remote_frontend_url_is_rejected(self):
        os.environ["FRONTEND_URL"] = "http://iepdf.example"
        with self.assertRaises(EmailConfigurationError):
            build_verification_url("token123")

    def test_missing_api_key_does_not_call_provider(self):
        os.environ.pop("RESEND_API_KEY")
        with patch("security.email_sender.resend.Emails.send") as send:
            with self.assertRaises(EmailConfigurationError):
                send_verification_email("user@example.com", "token123")
            send.assert_not_called()

    def test_successful_send_calls_resend(self):
        with patch(
            "security.email_sender.resend.Emails.send",
            return_value=SimpleNamespace(id="test-message-id"),
        ) as send:
            result = send_verification_email(
                "user@example.com",
                "token123",
            )

        self.assertIsNone(result)
        send.assert_called_once()
        params = send.call_args.args[0]
        self.assertEqual(params["to"], ["user@example.com"])
        self.assertEqual(params["from"], "iePDF Test <test@example.com>")
        self.assertIn("https://iepdf.example/verify-email?token=token123", params["text"])

    def test_provider_failure_returns_controlled_error(self):
        with patch(
            "security.email_sender.resend.Emails.send",
            side_effect=RuntimeError("simulated provider failure"),
        ):
            with self.assertRaises(EmailDeliveryError) as context:
                send_verification_email("user@example.com", "token123")

        self.assertNotIn("simulated provider failure", str(context.exception))

    def test_missing_message_id_is_rejected(self):
        with patch(
            "security.email_sender.resend.Emails.send",
            return_value=SimpleNamespace(),
        ):
            with self.assertRaises(EmailDeliveryError):
                send_verification_email("user@example.com", "token123")



    def test_rejects_malformed_and_untrusted_frontend_urls(self):
        invalid_urls = [
            "http://localhost.evil.example",
            "http://127.0.0.1.evil.example",
            "https://",
            "https://iepdf.example/path",
            "https://user:pass@iepdf.example",
            "https://iepdf.example?next=evil",
            "https://iepdf.example#fragment",
            "https://iepdf.example:99999",
        ]

        for frontend_url in invalid_urls:
            with self.subTest(frontend_url=frontend_url):
                os.environ["FRONTEND_URL"] = frontend_url
                with self.assertRaises(EmailConfigurationError):
                    build_verification_url("token123")

    def test_allows_exact_local_development_hosts(self):
        for frontend_url in (
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ):
            with self.subTest(frontend_url=frontend_url):
                os.environ["FRONTEND_URL"] = frontend_url
                self.assertTrue(
                    build_verification_url("token123").startswith(
                        frontend_url + "/verify-email?"
                    )
                )

    def test_html_verification_link_is_escaped(self):
        with patch(
            "security.email_sender.resend.Emails.send",
            return_value=SimpleNamespace(id="test-message-id"),
        ) as send:
            send_verification_email("user@example.com", "token&value")

        params = send.call_args.args[0]
        self.assertIn(
            'href="https://iepdf.example/verify-email?token=token%26value"',
            params["html"],
        )
        self.assertIn(
            "https://iepdf.example/verify-email?token=token%26value",
            params["text"],
        )

    def test_missing_sender_does_not_call_provider(self):
        os.environ.pop("EMAIL_FROM")

        with patch("security.email_sender.resend.Emails.send") as send:
            with self.assertRaises(EmailConfigurationError):
                send_verification_email("user@example.com", "token123")

            send.assert_not_called()

if __name__ == "__main__":
    unittest.main()

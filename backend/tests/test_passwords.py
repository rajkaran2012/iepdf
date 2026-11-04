import unittest

from security.passwords import hash_password, verify_password


class PasswordSecurityTests(unittest.TestCase):
    def test_hash_does_not_equal_plaintext(self):
        password = "Example-Strong-Password-482!"
        hashed = hash_password(password)
        self.assertNotEqual(hashed, password)
        self.assertTrue(hashed.startswith("$argon2id$"))

    def test_correct_password_verifies(self):
        password = "Example-Strong-Password-482!"
        self.assertTrue(verify_password(password, hash_password(password)))

    def test_wrong_password_is_rejected(self):
        hashed = hash_password("Example-Strong-Password-482!")
        self.assertFalse(verify_password("Wrong-Password-482!", hashed))

    def test_missing_or_invalid_values_are_rejected(self):
        self.assertFalse(verify_password("", "some-hash"))
        self.assertFalse(verify_password("password", None))
        self.assertFalse(verify_password("password", "not-a-valid-hash"))

    def test_empty_password_cannot_be_hashed(self):
        with self.assertRaises(ValueError):
            hash_password("")



    def test_verifier_exception_returns_false(self):
        from unittest.mock import patch

        with patch(
            "security.passwords._password_hash.verify",
            side_effect=RuntimeError("simulated verifier failure"),
        ):
            self.assertFalse(
                verify_password(
                    "Example-Strong-Password-482!",
                    "$argon2id$simulated-malformed-hash",
                )
            )
if __name__ == "__main__":
    unittest.main()

import io
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException, UploadFile

from security.account_access import AccountContext, enforce_tool_access
from security.plan_policy import FREE_POLICY, PAID_POLICY


def make_context(plan_id="free"):
    user = MagicMock()
    user.id = 7
    return AccountContext(
        user=user,
        session=MagicMock(),
        plan_id=plan_id,
        special_merge_authorized=False,
    )


def make_upload(size=10):
    return UploadFile(filename="sample.pdf", file=io.BytesIO(b"x" * size))


class AccountQuotaEnforcementTests(unittest.IsolatedAsyncioTestCase):
    async def test_free_plan_successful_reservation_commits(self):
        context = make_context("free")
        context.session.execute.return_value.scalar_one_or_none.return_value = 1

        with patch(
            "security.account_access.validate_upload_batch"
        ) as validate:
            validate.return_value = None
            await enforce_tool_access(context, "compress", [make_upload()])

        validate.assert_awaited_once()
        context.session.execute.assert_called_once()
        context.session.commit.assert_called_once()
        context.session.rollback.assert_not_called()

    async def test_free_plan_limit_reached_rolls_back_and_returns_429(self):
        context = make_context("free")
        context.session.execute.return_value.scalar_one_or_none.return_value = None

        with patch(
            "security.account_access.validate_upload_batch"
        ) as validate:
            validate.return_value = None
            with self.assertRaises(HTTPException) as raised:
                await enforce_tool_access(context, "compress", [make_upload()])

        self.assertEqual(raised.exception.status_code, 429)
        context.session.commit.assert_not_called()
        context.session.rollback.assert_called_once()

    async def test_database_failure_rolls_back_and_returns_503(self):
        context = make_context("free")
        context.session.execute.side_effect = RuntimeError("simulated DB failure")

        with patch(
            "security.account_access.validate_upload_batch"
        ) as validate:
            validate.return_value = None
            with self.assertRaises(HTTPException) as raised:
                await enforce_tool_access(context, "compress", [make_upload()])

        self.assertEqual(raised.exception.status_code, 503)
        context.session.rollback.assert_called_once()
        context.session.commit.assert_not_called()

    async def test_scalar_result_failure_rolls_back_and_returns_503(self):
        context = make_context("free")
        context.session.execute.return_value.scalar_one_or_none.side_effect = (
            RuntimeError("simulated result extraction failure")
        )

        with patch(
            "security.account_access.validate_upload_batch"
        ) as validate:
            validate.return_value = None
            with self.assertRaises(HTTPException) as raised:
                await enforce_tool_access(context, "compress", [make_upload()])

        self.assertEqual(raised.exception.status_code, 503)
        context.session.rollback.assert_called_once()
        context.session.commit.assert_not_called()

    async def test_upload_rejection_happens_before_quota_reservation(self):
        context = make_context("free")

        with patch(
            "security.account_access.validate_upload_batch",
            side_effect=HTTPException(status_code=413, detail="Too large"),
        ):
            with self.assertRaises(HTTPException) as raised:
                await enforce_tool_access(context, "compress", [make_upload()])

        self.assertEqual(raised.exception.status_code, 413)
        context.session.execute.assert_not_called()
        context.session.commit.assert_not_called()

    async def test_paid_plan_uses_no_free_daily_limit(self):
        context = make_context("paid")
        context.session.execute.return_value.scalar_one_or_none.return_value = 11

        with patch(
            "security.account_access.validate_upload_batch"
        ) as validate:
            validate.return_value = None
            await enforce_tool_access(context, "compress", [make_upload()])

        self.assertIsNone(PAID_POLICY.daily_task_limit)
        self.assertEqual(FREE_POLICY.daily_task_limit, 10)
        context.session.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()

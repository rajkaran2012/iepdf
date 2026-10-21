import unittest

from security.account_access import AccountContext, effective_tool_limit


def make_context(
    plan_id="free",
    special_merge_authorized=False,
    max_files=None,
    max_file_size_bytes=None,
    max_total_size_bytes=None,
):
    return AccountContext(
        user=object(),
        session=object(),
        plan_id=plan_id,
        special_merge_authorized=special_merge_authorized,
        special_merge_max_files=max_files,
        special_merge_max_file_size_bytes=max_file_size_bytes,
        special_merge_max_total_size_bytes=max_total_size_bytes,
    )


class EffectiveAccountLimitTests(unittest.TestCase):
    def test_free_merge_uses_frozen_free_file_limit(self):
        limits = effective_tool_limit(make_context(), "merge")
        self.assertEqual(limits.max_files, 5)
        self.assertEqual(limits.max_file_size_bytes, 25 * 1024 * 1024)
        self.assertEqual(limits.max_total_size_bytes, 50 * 1024 * 1024)

    def test_paid_merge_uses_frozen_paid_file_limit(self):
        limits = effective_tool_limit(make_context("paid"), "merge")
        self.assertEqual(limits.max_files, 100)
        self.assertEqual(limits.max_file_size_bytes, 500 * 1024 * 1024)
        self.assertEqual(limits.max_total_size_bytes, 1024 * 1024 * 1024)

    def test_special_merge_entitlement_is_intersected_with_policy(self):
        context = make_context(
            special_merge_authorized=True,
            max_files=200,
            max_file_size_bytes=15 * 1024 * 1024,
            max_total_size_bytes=200 * 1024 * 1024,
        )
        limits = effective_tool_limit(context, "merge")
        self.assertEqual(limits.max_files, 200)
        self.assertEqual(limits.max_file_size_bytes, 15 * 1024 * 1024)
        self.assertEqual(limits.max_total_size_bytes, 200 * 1024 * 1024)

    def test_entitlement_cannot_raise_special_merge_file_size_limit(self):
        context = make_context(
            plan_id="paid",
            special_merge_authorized=True,
            max_files=200,
            max_file_size_bytes=500 * 1024 * 1024,
            max_total_size_bytes=1024 * 1024 * 1024,
        )
        limits = effective_tool_limit(context, "merge")
        self.assertEqual(limits.max_file_size_bytes, 15 * 1024 * 1024)

    def test_special_merge_entitlement_does_not_raise_other_tool_limits(self):
        context = make_context(
            special_merge_authorized=True,
            max_files=200,
            max_file_size_bytes=15 * 1024 * 1024,
            max_total_size_bytes=200 * 1024 * 1024,
        )
        limits = effective_tool_limit(context, "compress")
        self.assertEqual(limits.max_files, 1)
        self.assertEqual(limits.max_file_size_bytes, 25 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main(verbosity=2)

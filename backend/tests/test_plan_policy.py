import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from security.plan_policy import (
    FREE_POLICY,
    PAID_POLICY,
    SPECIAL_MERGE_LIMIT,
    ToolLimit,
    get_tool_limit,
)


class PlanPolicyTests(unittest.TestCase):
    def test_all_five_tools_are_configured(self):
        expected = {
            "merge", "split", "compress", "pdf-to-jpg", "jpg-to-pdf"
        }
        self.assertEqual(set(FREE_POLICY.tools), expected)
        self.assertEqual(set(PAID_POLICY.tools), expected)

    def test_merge_file_limits(self):
        self.assertEqual(FREE_POLICY.tools["merge"].max_files, 5)
        self.assertEqual(PAID_POLICY.tools["merge"].max_files, 100)

    def test_special_merge_entitlement(self):
        self.assertEqual(SPECIAL_MERGE_LIMIT.max_files, 200)
        self.assertEqual(
            SPECIAL_MERGE_LIMIT.max_total_size_bytes,
            200 * 1024 * 1024,
        )
        self.assertEqual(
            SPECIAL_MERGE_LIMIT.max_file_size_bytes,
            15 * 1024 * 1024,
        )

    def test_special_limit_is_selected_only_for_merge(self):
        self.assertEqual(
            get_tool_limit(
                FREE_POLICY, "merge", special_merge_authorized=True
            ).max_files,
            200,
        )
        self.assertEqual(
            get_tool_limit(
                FREE_POLICY, "compress", special_merge_authorized=True
            ).max_files,
            1,
        )

    def test_invalid_file_count_is_rejected(self):
        with self.assertRaises(ValueError):
            ToolLimit(2, 1, 1024, 2048)

    def test_free_plan_limits(self):
        merge = FREE_POLICY.tools["merge"]
        self.assertEqual(merge.max_files, 5)
        self.assertEqual(merge.max_file_size_bytes, 25 * 1024 * 1024)
        self.assertEqual(merge.max_total_size_bytes, 50 * 1024 * 1024)
        self.assertEqual(FREE_POLICY.daily_task_limit, 10)

    def test_paid_plan_limits(self):
        merge = PAID_POLICY.tools["merge"]
        self.assertEqual(merge.max_files, 100)
        self.assertEqual(merge.max_file_size_bytes, 500 * 1024 * 1024)
        self.assertEqual(merge.max_total_size_bytes, 1024 * 1024 * 1024)
        self.assertIsNone(PAID_POLICY.daily_task_limit)

    def test_special_entitlement_has_exact_limits(self):
        self.assertEqual(SPECIAL_MERGE_LIMIT.min_files, 2)
        self.assertEqual(SPECIAL_MERGE_LIMIT.max_files, 200)
        self.assertEqual(SPECIAL_MERGE_LIMIT.max_file_size_bytes, 15 * 1024 * 1024)
        self.assertEqual(SPECIAL_MERGE_LIMIT.max_total_size_bytes, 200 * 1024 * 1024)

    def test_special_entitlement_does_not_change_other_tools(self):
        for tool_id in ("split", "compress", "pdf-to-jpg", "jpg-to-pdf"):
            self.assertEqual(
                get_tool_limit(FREE_POLICY, tool_id, special_merge_authorized=True),
                FREE_POLICY.tools[tool_id],
            )

if __name__ == "__main__":
    unittest.main(verbosity=2)

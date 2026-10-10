import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from models import Base


class ModelMetadataTests(unittest.TestCase):
    def test_expected_tables_exist(self):
        self.assertEqual(
            set(Base.metadata.tables),
            {"users", "subscriptions", "usage_records", "payments", "entitlements"},
        )

    def test_usage_count_allows_zero_but_rejects_negative_values(self):
        table = Base.metadata.tables["usage_records"]
        checks = {
            constraint.name: str(constraint.sqltext)
            for constraint in table.constraints
            if constraint.__class__.__name__ == "CheckConstraint"
        }
        self.assertIn("ck_usage_task_count_nonnegative", checks)
        self.assertIn(">= 0", checks["ck_usage_task_count_nonnegative"])

    def test_subscription_date_order_constraint_exists(self):
        table = Base.metadata.tables["subscriptions"]
        names = {constraint.name for constraint in table.constraints}
        self.assertIn("ck_subscription_date_order", names)

    def test_entitlement_limits_must_be_positive_when_supplied(self):
        table = Base.metadata.tables["entitlements"]
        names = {constraint.name for constraint in table.constraints}
        self.assertIn("ck_entitlement_max_files_positive", names)
        self.assertIn("ck_entitlement_file_size_positive", names)
        self.assertIn("ck_entitlement_total_size_positive", names)

    def test_daily_usage_is_unique_per_user_and_date(self):
        table = Base.metadata.tables["usage_records"]
        unique_columns = {
            tuple(column.name for column in constraint.columns)
            for constraint in table.constraints
            if constraint.__class__.__name__ == "UniqueConstraint"
        }
        self.assertIn(("user_id", "usage_date"), unique_columns)


if __name__ == "__main__":
    unittest.main(verbosity=2)

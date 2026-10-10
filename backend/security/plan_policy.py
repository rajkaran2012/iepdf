"""Centralized iePDF plan-policy definitions.

Configuration foundation only: authentication and enforcement are added
separately. These values do not change existing tool limits by themselves.
"""

from dataclasses import dataclass
from typing import Literal

MB = 1024 * 1024
GB = 1024 * MB

ToolId = Literal[
    "merge",
    "split",
    "compress",
    "pdf-to-jpg",
    "jpg-to-pdf",
]

PlanId = Literal["free", "paid"]


@dataclass(frozen=True)
class ToolLimit:
    min_files: int
    max_files: int
    max_file_size_bytes: int
    max_total_size_bytes: int

    def __post_init__(self) -> None:
        if self.min_files < 1:
            raise ValueError("min_files must be at least 1")
        if self.max_files < self.min_files:
            raise ValueError("max_files must be >= min_files")
        if self.max_file_size_bytes < 1:
            raise ValueError("max_file_size_bytes must be positive")
        if self.max_total_size_bytes < self.max_file_size_bytes:
            raise ValueError(
                "max_total_size_bytes must be >= max_file_size_bytes"
            )


@dataclass(frozen=True)
class PlanPolicy:
    plan_id: PlanId
    daily_task_limit: int | None
    show_ads: bool
    watermark_enabled: bool
    priority_eligible: bool
    tools: dict[ToolId, ToolLimit]


def _tool_limits(
    *,
    merge_files: int,
    image_files: int,
    max_file_mb: int,
    max_total_mb: int,
) -> dict[ToolId, ToolLimit]:
    file_size = max_file_mb * MB
    total_size = max_total_mb * MB

    return {
        "merge": ToolLimit(2, merge_files, file_size, total_size),
        "split": ToolLimit(1, 1, file_size, total_size),
        "compress": ToolLimit(1, 1, file_size, total_size),
        "pdf-to-jpg": ToolLimit(1, 1, file_size, total_size),
        "jpg-to-pdf": ToolLimit(1, image_files, file_size, total_size),
    }


FREE_POLICY = PlanPolicy(
    plan_id="free",
    daily_task_limit=10,
    show_ads=True,
    watermark_enabled=True,
    priority_eligible=False,
    tools=_tool_limits(
        merge_files=5,
        image_files=5,
        max_file_mb=25,
        max_total_mb=50,
    ),
)

PAID_POLICY = PlanPolicy(
    plan_id="paid",
    daily_task_limit=None,
    show_ads=False,
    watermark_enabled=False,
    priority_eligible=True,
    tools=_tool_limits(
        merge_files=100,
        image_files=100,
        max_file_mb=500,
        max_total_mb=1024,
    ),
)

# Account-specific entitlement target. It is not active until the backend
# authenticates the account and explicitly authorizes this override.
SPECIAL_MERGE_LIMIT = ToolLimit(
    min_files=2,
    max_files=200,
    max_file_size_bytes=15 * MB,
    max_total_size_bytes=200 * MB,
)


def get_tool_limit(
    plan: PlanPolicy,
    tool_id: ToolId,
    *,
    special_merge_authorized: bool = False,
) -> ToolLimit:
    """Return configured limits; authorization must be established separately."""
    if special_merge_authorized and tool_id == "merge":
        return SPECIAL_MERGE_LIMIT

    return plan.tools[tool_id]

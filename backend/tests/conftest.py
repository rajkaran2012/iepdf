from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

LEGACY_PDF_MODULES = {
    "test_compress_endpoint",
    "test_conversion_endpoints",
    "test_merge_endpoint",
    "test_split_endpoint",
}

PDF_ROUTERS = (
    "routers.compress",
    "routers.jpg_to_pdf",
    "routers.pdf_to_jpg",
    "routers.merge",
    "routers.split",
)


@pytest.fixture(autouse=True)
def legacy_pdf_test_account(request):
    if request.module.__name__.split(".")[-1] not in LEGACY_PDF_MODULES:
        yield
        return

    from main import app
    from security.account_access import require_account

    account = SimpleNamespace(
        user=SimpleNamespace(id=999),
        session=MagicMock(),
        plan_id="free",
        special_merge_authorized=False,
        special_merge_max_files=None,
        special_merge_max_file_size_bytes=None,
        special_merge_max_total_size_bytes=None,
    )

    app.dependency_overrides[require_account] = lambda: account

    patches = [
        patch(f"{router}.enforce_tool_access", new_callable=AsyncMock)
        for router in PDF_ROUTERS
    ]

    for active_patch in patches:
        active_patch.start()

    try:
        yield
    finally:
        for active_patch in reversed(patches):
            active_patch.stop()
        app.dependency_overrides.pop(require_account, None)

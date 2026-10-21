"""Reusable upload validation helpers.

These helpers validate upload metadata and file sizes before processing.
They do not authenticate users or authorize plan entitlements.
"""

from collections.abc import Sequence

from fastapi import HTTPException, UploadFile

from security.plan_policy import ToolLimit


async def validate_upload_batch(
    files: Sequence[UploadFile],
    limits: ToolLimit,
) -> None:
    """Validate file count, per-file size, and combined upload size."""
    file_count = len(files)

    if file_count < limits.min_files or file_count > limits.max_files:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This tool requires between {limits.min_files} "
                f"and {limits.max_files} file(s)."
            ),
        )

    total_size = 0

    for upload in files:
        upload.file.seek(0, 2)
        size = upload.file.tell()
        upload.file.seek(0)

        if size > limits.max_file_size_bytes:
            raise HTTPException(
                status_code=413,
                detail="An uploaded file exceeds the maximum allowed file size.",
            )

        total_size += size

        if total_size > limits.max_total_size_bytes:
            raise HTTPException(
                status_code=413,
                detail="The combined uploads exceed the maximum allowed total size.",
            )

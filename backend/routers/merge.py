import os
from typing import List

from fastapi import APIRouter, File, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse
from pypdf import PdfReader, PdfWriter

from config import TEMP_FOLDER, OUTPUT_FOLDER, MAX_FILE_SIZE
from security.plan_policy import MB, ToolLimit
from security.upload_validation import validate_upload_batch
from utils import (
    save_upload_file,
    safe_delete,
    unique_filename,
)

router = APIRouter()

# Conservative limits for the existing unauthenticated endpoint.
# These do not grant paid-plan or special-merge authorization.
MERGE_UPLOAD_LIMITS = ToolLimit(
    min_files=2,
    max_files=5,
    max_file_size_bytes=MAX_FILE_SIZE,
    max_total_size_bytes=50 * MB,
)


@router.post("/merge-pdf")
async def merge_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    await validate_upload_batch(files, MERGE_UPLOAD_LIMITS)

    writer = PdfWriter()
    temp_files = []

    try:
        for file in files:
            temp_name = unique_filename(file.filename or "upload.pdf")
            temp_path = os.path.join(TEMP_FOLDER, temp_name)

            save_upload_file(file, temp_path)
            temp_files.append(temp_path)

            reader = PdfReader(temp_path)

            for page in reader.pages:
                writer.add_page(page)

        output_name = unique_filename("merged.pdf")
        output_path = os.path.join(OUTPUT_FOLDER, output_name)

        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        background_tasks.add_task(safe_delete, output_path)

        return FileResponse(
            path=output_path,
            filename="merged.pdf",
            media_type="application/pdf",
            background=background_tasks,
        )
    finally:
        for temp_path in temp_files:
            safe_delete(temp_path)

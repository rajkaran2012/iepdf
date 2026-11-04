import os
import zipfile

from fastapi import APIRouter, File, UploadFile, BackgroundTasks, Depends
from security.account_access import AccountContext, require_account, enforce_tool_access
from fastapi.responses import FileResponse
from pypdf import PdfReader, PdfWriter

from config import TEMP_FOLDER, OUTPUT_FOLDER, MAX_FILE_SIZE
from utils import (
    validate_upload,
    save_upload_file,
    safe_delete,
    unique_filename,
)

router = APIRouter()


def _cleanup_split_file(path: str) -> None:
    """Attempt temporary-file cleanup without masking processing errors."""
    try:
        safe_delete(path)
    except OSError:
        pass


@router.post("/split-pdf")
async def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    account: AccountContext = Depends(require_account),
):
    await enforce_tool_access(account, "split", [file])
    await validate_upload(file)

    temp_name = unique_filename(file.filename)
    pdf_path = os.path.join(TEMP_FOLDER, temp_name)

    zip_name = unique_filename("split_pages.zip")
    zip_path = os.path.join(OUTPUT_FOLDER, zip_name)

    page_paths = []
    response_ready = False

    try:
        save_upload_file(file, pdf_path, max_bytes=MAX_FILE_SIZE)
        reader = PdfReader(pdf_path)

        with zipfile.ZipFile(zip_path, "w") as zipf:
            for i, page in enumerate(reader.pages):
                writer = PdfWriter()
                writer.add_page(page)

                page_name = unique_filename(f"page_{i + 1}.pdf")
                page_path = os.path.join(TEMP_FOLDER, page_name)
                page_paths.append(page_path)

                with open(page_path, "wb") as out:
                    writer.write(out)

                zipf.write(
                    page_path,
                    arcname=f"page_{i + 1}.pdf",
                )

        response = FileResponse(
            path=zip_path,
            filename="split_pages.zip",
            media_type="application/zip",
            background=background_tasks,
        )

        background_tasks.add_task(safe_delete, zip_path)
        response_ready = True
        return response

    finally:
        _cleanup_split_file(pdf_path)

        for page_path in page_paths:
            _cleanup_split_file(page_path)

        if not response_ready:
            _cleanup_split_file(zip_path)

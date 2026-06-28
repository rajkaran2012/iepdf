import os
import zipfile

from fastapi import APIRouter, File, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse
from pypdf import PdfReader, PdfWriter

from config import TEMP_FOLDER, OUTPUT_FOLDER
from utils import (
    validate_upload,
    save_upload_file,
    safe_delete,
    unique_filename,
)

router = APIRouter()


@router.post("/split-pdf")
async def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):

    # Validate uploaded PDF
    await validate_upload(file)

    # Save uploaded PDF
    temp_name = unique_filename(file.filename)
    pdf_path = os.path.join(TEMP_FOLDER, temp_name)

    save_upload_file(file, pdf_path)

    reader = PdfReader(pdf_path)

    # Create unique ZIP file
    zip_name = unique_filename("split_pages.zip")
    zip_path = os.path.join(OUTPUT_FOLDER, zip_name)

    with zipfile.ZipFile(zip_path, "w") as zipf:

        for i, page in enumerate(reader.pages):

            writer = PdfWriter()
            writer.add_page(page)

            page_name = unique_filename(f"page_{i+1}.pdf")
            page_path = os.path.join(TEMP_FOLDER, page_name)

            with open(page_path, "wb") as out:
                writer.write(out)

            zipf.write(
                page_path,
                arcname=f"page_{i+1}.pdf"
            )

            safe_delete(page_path)

    # Delete uploaded PDF
    safe_delete(pdf_path)

    # Delete ZIP after download
    background_tasks.add_task(
        safe_delete,
        zip_path
    )

    return FileResponse(
        path=zip_path,
        filename="split_pages.zip",
        media_type="application/zip",
        background=background_tasks,
    )
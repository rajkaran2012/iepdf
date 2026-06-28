import os
from typing import List

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


@router.post("/merge-pdf")
async def merge_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...)
):

    writer = PdfWriter()
    temp_files = []

    for file in files:

        await validate_upload(file)

        temp_name = unique_filename(file.filename)
        temp_path = os.path.join(TEMP_FOLDER, temp_name)

        save_upload_file(file, temp_path)

        reader = PdfReader(temp_path)

        for page in reader.pages:
            writer.add_page(page)

        temp_files.append(temp_path)

    output_name = unique_filename("merged.pdf")
    output_path = os.path.join(
        OUTPUT_FOLDER,
        output_name
    )

    with open(output_path, "wb") as f:
        writer.write(f)

    for temp in temp_files:
        safe_delete(temp)

    background_tasks.add_task(
        safe_delete,
        output_path
    )

    return FileResponse(
        path=output_path,
        filename="merged.pdf",
        media_type="application/pdf",
        background=background_tasks
    )
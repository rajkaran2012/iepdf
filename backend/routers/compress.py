import os
import shutil
import subprocess
import platform

from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse

from utils import validate_upload, delete_file
from config import GHOSTSCRIPT_PATH

router = APIRouter()


@router.post("/compress-pdf")
async def compress_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    # Validate uploaded file
    await validate_upload(file)

    input_pdf = "input.pdf"

    with open(input_pdf, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    output_pdf = "compressed.pdf"

    # Windows -> use installed Ghostscript
    if platform.system() == "Windows":
        gs_command = GHOSTSCRIPT_PATH
    else:
        # Linux (Render)
        gs_command = "gs"

    subprocess.run(
        [
            gs_command,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            "-dPDFSETTINGS=/ebook",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={output_pdf}",
            input_pdf,
        ],
        check=True,
    )

    background_tasks.add_task(delete_file, input_pdf)
    background_tasks.add_task(delete_file, output_pdf)

    return FileResponse(
        path=output_pdf,
        media_type="application/pdf",
        filename="compressed.pdf",
        background=background_tasks,
    )
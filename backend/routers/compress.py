
import subprocess
import shutil

from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse

from utils import validate_upload, delete_file

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

    # Ghostscript Path
    gs_path = r"C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe"

    subprocess.run(
        [
            gs_path,
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

    # Delete temporary files after download
    background_tasks.add_task(delete_file, input_pdf)
    background_tasks.add_task(delete_file, output_pdf)

    return FileResponse(
        path=output_pdf,
        media_type="application/pdf",
        filename="compressed.pdf",
        background=background_tasks
    )


import os
import shutil
import subprocess
import tempfile

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pypdf import PdfReader
from pypdf.errors import PdfReadError, FileNotDecryptedError

from utils import validate_upload
from config import GHOSTSCRIPT_PATH, TEMP_FOLDER


router = APIRouter()

GHOSTSCRIPT_TIMEOUT_SECONDS = 120


def validate_pdf_input(path: str) -> None:
    if not os.path.isfile(path):
        raise HTTPException(
            status_code=400,
            detail="Unable to read the supplied PDF."
        )

    try:
        size = os.path.getsize(path)

        if size <= 0:
            raise HTTPException(
                status_code=400,
                detail="The supplied PDF is empty."
            )

        with open(path, "rb") as pdf_file:
            header = pdf_file.read(5)

        if header != b"%PDF-":
            raise HTTPException(
                status_code=400,
                detail="The supplied file is not a valid PDF."
            )

        reader = PdfReader(path)

        if reader.is_encrypted:
            raise HTTPException(
                status_code=400,
                detail="The supplied PDF is password protected. Please unlock it before compression."
            )

        if len(reader.pages) == 0:
            raise HTTPException(
                status_code=400,
                detail="The supplied PDF contains no pages."
            )

    except FileNotDecryptedError:
        raise HTTPException(
            status_code=400,
            detail="The supplied PDF is password protected. Please unlock it before compression."
        )

    except PdfReadError:
        raise HTTPException(
            status_code=400,
            detail="The supplied PDF is not valid or is corrupted."
        )

    except HTTPException:
        raise

    except (OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Unable to read the supplied PDF."
        )

def validate_pdf_output(path: str) -> bool:
    if not os.path.isfile(path):
        return False

    try:
        size = os.path.getsize(path)

        if size <= 0:
            return False

        with open(path, "rb") as pdf_file:
            header = pdf_file.read(5)

        return header == b"%PDF-"
    except OSError:
        return False


def cleanup_workspace(path: str) -> None:
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)


@router.post("/compress-pdf")
async def compress_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    await validate_upload(file)

    if not os.path.isfile(GHOSTSCRIPT_PATH):
        raise HTTPException(
            status_code=503,
            detail="PDF compression service is temporarily unavailable."
        )

    workspace = tempfile.mkdtemp(
        prefix="compress-",
        dir=TEMP_FOLDER
    )

    input_pdf = os.path.join(workspace, "input.pdf")
    output_pdf = os.path.join(workspace, "compressed.pdf")

    try:
        with open(input_pdf, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        validate_pdf_input(input_pdf)

        gs_command = [
            GHOSTSCRIPT_PATH,
            "-dSAFER",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            "-dPDFSETTINGS=/ebook",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={output_pdf}",
            input_pdf,
        ]

        try:
            result = subprocess.run(
                gs_command,
                check=False,
                capture_output=True,
                text=True,
                timeout=GHOSTSCRIPT_TIMEOUT_SECONDS,
                shell=False,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=504,
                detail="PDF compression timed out."
            )
        except OSError:
            raise HTTPException(
                status_code=503,
                detail="PDF compression service is temporarily unavailable."
            )

        if result.returncode != 0:
            raise HTTPException(
                status_code=400,
                detail="Unable to compress the supplied PDF."
            )

        if not validate_pdf_output(output_pdf):
            raise HTTPException(
                status_code=500,
                detail="PDF compression produced an invalid output."
            )

        background_tasks.add_task(cleanup_workspace, workspace)

        return FileResponse(
            path=output_pdf,
            media_type="application/pdf",
            filename="compressed.pdf",
            background=background_tasks,
        )

    except HTTPException:
        cleanup_workspace(workspace)
        raise
    except Exception:
        cleanup_workspace(workspace)
        raise HTTPException(
            status_code=500,
            detail="Unable to process the PDF."
        )

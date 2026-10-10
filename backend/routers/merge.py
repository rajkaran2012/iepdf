import os
from typing import List

from fastapi import APIRouter, File, UploadFile, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pypdf import PdfReader, PdfWriter
from pypdf.errors import FileNotDecryptedError, PdfReadError

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


def validate_pdf_input(path: str) -> PdfReader:
    """Validate a PDF before adding its pages to the merge."""
    try:
        if not os.path.isfile(path) or os.path.getsize(path) <= 0:
            raise HTTPException(
                status_code=400,
                detail="A supplied PDF is empty or cannot be read.",
            )

        with open(path, "rb") as pdf_file:
            header = pdf_file.read(5)

        if header != b"%PDF-":
            raise HTTPException(
                status_code=400,
                detail="A supplied file is not a valid PDF.",
            )

        reader = PdfReader(path, strict=True)

        if reader.is_encrypted:
            raise HTTPException(
                status_code=400,
                detail="Password-protected PDFs must be unlocked before merging.",
            )

        if len(reader.pages) == 0:
            raise HTTPException(
                status_code=400,
                detail="A supplied PDF contains no pages.",
            )

        return reader

    except HTTPException:
        raise
    except FileNotDecryptedError:
        raise HTTPException(
            status_code=400,
            detail="Password-protected PDFs must be unlocked before merging.",
        ) from None
    except (PdfReadError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="A supplied PDF is invalid, corrupted, or unreadable.",
        ) from None


@router.post("/merge-pdf")
async def merge_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    await validate_upload_batch(files, MERGE_UPLOAD_LIMITS)

    writer = PdfWriter()
    temp_files = []
    output_path = None
    response_created = False

    try:
        for file in files:
            temp_name = unique_filename(file.filename or "upload.pdf")
            temp_path = os.path.join(TEMP_FOLDER, temp_name)

            temp_files.append(temp_path)
            save_upload_file(file, temp_path)

            reader = validate_pdf_input(temp_path)

            for page in reader.pages:
                writer.add_page(page)

        output_name = unique_filename("merged.pdf")
        output_path = os.path.join(OUTPUT_FOLDER, output_name)

        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        if not os.path.isfile(output_path) or os.path.getsize(output_path) <= 0:
            raise HTTPException(
                status_code=500,
                detail="PDF merging did not produce a valid output.",
            )

        with open(output_path, "rb") as output_file:
            if output_file.read(5) != b"%PDF-":
                raise HTTPException(
                    status_code=500,
                    detail="PDF merging did not produce a valid output.",
                )

        response = FileResponse(
            path=output_path,
            filename="merged.pdf",
            media_type="application/pdf",
            background=background_tasks,
        )
        background_tasks.add_task(safe_delete, output_path)
        response_created = True
        return response

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to process the supplied PDFs.",
        ) from None
    finally:
        for temp_path in temp_files:
            safe_delete(temp_path)

        if output_path and not response_created:
            safe_delete(output_path)

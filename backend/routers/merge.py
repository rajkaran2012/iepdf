import os
from typing import List

from fastapi import (
    APIRouter,
    File,
    UploadFile,
    BackgroundTasks,
    HTTPException,
)
from fastapi.responses import (
    FileResponse,
    JSONResponse,
)

from services.password_service import (
    is_pdf_encrypted,
)
from models.password_response import (
    PasswordRequiredResponse,
    EncryptedFile,
)
from pypdf import PdfReader, PdfWriter
from pypdf.errors import (
    PdfReadError,
    FileNotDecryptedError,
)

from config import TEMP_FOLDER, OUTPUT_FOLDER

from services.password_service import (
    is_pdf_encrypted,
)

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

    if len(files) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please upload at least two PDF files."
        )

    writer = PdfWriter()
    temp_files = []
    output_path = None

    try:

        for file in files:

            await validate_upload(file)

            temp_name = unique_filename(file.filename)
            temp_path = os.path.join(
                TEMP_FOLDER,
                temp_name,
            )

            save_upload_file(file, temp_path)
            temp_files.append(temp_path)

            try:

                reader = PdfReader(temp_path)

                if is_pdf_encrypted(temp_path):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f'"{file.filename}" '
                            "is password protected. "
                            "Please unlock it before merging."
                        ),
                    )

                if len(reader.pages) == 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f'"{file.filename}" contains no pages.'
                    )

                for page in reader.pages:
                    writer.add_page(page)

            except FileNotDecryptedError:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f'"{file.filename}" is password protected.'
                    ),
                )

            except PdfReadError:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f'"{file.filename}" is not a valid PDF '
                        "or is corrupted."
                    ),
                )

            except HTTPException:
                raise

            except Exception as e:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f'Unable to process "{file.filename}". '
                        f"{str(e)}"
                    ),
                )

        output_name = unique_filename("merged.pdf")

        output_path = os.path.join(
            OUTPUT_FOLDER,
            output_name,
        )

        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        background_tasks.add_task(
            safe_delete,
            output_path,
        )

        return FileResponse(
            path=output_path,
            filename="merged.pdf",
            media_type="application/pdf",
            background=background_tasks,
        )

    finally:

        for temp in temp_files:
            safe_delete(temp)
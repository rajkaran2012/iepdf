import os
from typing import List

from fastapi import (
    APIRouter,
    File,
    UploadFile,
    HTTPException,
)

from services.password_service import is_pdf_encrypted

from utils import (
    validate_upload,
    save_upload_file,
    safe_delete,
    unique_filename,
)

from config import TEMP_FOLDER

router = APIRouter()


@router.post("/check-passwords")
async def check_passwords(
    files: List[UploadFile] = File(...)
):
    encrypted_files = []
    temp_files = []

    try:

        for index, file in enumerate(files):

            await validate_upload(file)

            temp_name = unique_filename(file.filename)

            temp_path = os.path.join(
                TEMP_FOLDER,
                temp_name,
            )

            save_upload_file(file, temp_path)

            temp_files.append(temp_path)

            if is_pdf_encrypted(temp_path):

                encrypted_files.append(
                    {
                        "index": index,
                        "name": file.filename,
                    }
                )

        return {
            "needs_password": len(encrypted_files) > 0,
            "encrypted_files": encrypted_files,
        }

    finally:

        for temp in temp_files:
            safe_delete(temp)
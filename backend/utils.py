from fastapi import UploadFile, HTTPException
from config import MAX_FILE_SIZE
import os
import shutil
import uuid
from fastapi import UploadFile

from config import (
    UPLOAD_FOLDER,
    OUTPUT_FOLDER,
    TEMP_FOLDER,
    LOG_FOLDER,
)

# ==========================================
# CREATE REQUIRED FOLDERS
# ==========================================

def ensure_directories():
    """
    Create required folders if they don't exist.
    """
    folders = [
        UPLOAD_FOLDER,
        OUTPUT_FOLDER,
        TEMP_FOLDER,
        LOG_FOLDER,
    ]

    for folder in folders:
        os.makedirs(folder, exist_ok=True)


# ==========================================
# GENERATE UNIQUE FILENAME
# ==========================================

def unique_filename(original_name: str) -> str:
    """
    Example:
    report.pdf

    becomes

    a9f2c31d_report.pdf
    """

    return f"{uuid.uuid4().hex}_{original_name}"


# ==========================================
# SAVE UPLOADED FILE
# ==========================================

def save_upload_file(
    upload_file: UploadFile,
    destination: str,
    max_bytes: int = MAX_FILE_SIZE,
):
    """Save an upload in bounded chunks, enforcing a byte limit."""
    if max_bytes < 1:
        raise ValueError("max_bytes must be positive")

    bytes_written = 0

    try:
        with open(destination, "wb") as buffer:
            while True:
                chunk = upload_file.file.read(1024 * 1024)
                if not chunk:
                    break

                if bytes_written + len(chunk) > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail="An uploaded file exceeds the maximum allowed file size.",
                    )

                buffer.write(chunk)
                bytes_written += len(chunk)

    except Exception:
        try:
            os.remove(destination)
        except OSError:
            pass
        raise


# ==========================================
# SAFE DELETE
# ==========================================

def safe_delete(path: str):
    """
    Delete file only if it exists.
    """

    if os.path.exists(path):
        os.remove(path)


# ==========================================
# FILE SIZE VALIDATION
# ==========================================

async def validate_upload(upload_file: UploadFile):
    """
    Prevent uploads larger than 15 MB.
    """

    upload_file.file.seek(0, 2)
    size = upload_file.file.tell()
    upload_file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum allowed file size is 15 MB."
        )


# ==========================================
# DELETE FILE
# ==========================================

def delete_file(path: str):
    """
    Delete file if it exists.
    """

    if os.path.exists(path):
        os.remove(path)
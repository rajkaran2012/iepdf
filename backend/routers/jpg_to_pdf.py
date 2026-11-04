import os
import shutil
import tempfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError

from config import MAX_FILE_SIZE, TEMP_FOLDER
from security.account_access import AccountContext, enforce_tool_access, require_account
from utils import save_upload_file, validate_upload

router = APIRouter()


def cleanup_workspace(workspace: str) -> None:
    shutil.rmtree(workspace, ignore_errors=True)


@router.post("/jpg-to-pdf")
async def jpg_to_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    account: AccountContext = Depends(require_account),
):
    await enforce_tool_access(account, "jpg-to-pdf", files)

    if not files:
        raise HTTPException(
            status_code=422,
            detail="At least one image is required.",
        )

    os.makedirs(TEMP_FOLDER, exist_ok=True)
    workspace = tempfile.mkdtemp(prefix="jpg-to-pdf-", dir=TEMP_FOLDER)
    image_list = []
    temp_files = []
    output_pdf = str(Path(workspace) / "converted.pdf")

    try:
        # Validate every upload before creating temporary files.
        for file in files:
            await validate_upload(file)

        for index, file in enumerate(files, start=1):
            temp_path = str(Path(workspace) / f"input_{index}.img")
            temp_files.append(temp_path)
            save_upload_file(file, temp_path, max_bytes=MAX_FILE_SIZE)

            try:
                with Image.open(temp_path) as source:
                    image_list.append(source.convert("RGB"))
            except (UnidentifiedImageError, OSError, ValueError) as exc:
                raise HTTPException(
                    status_code=422,
                    detail="One or more uploaded files are not valid supported images.",
                ) from exc

        if not image_list:
            raise HTTPException(
                status_code=422,
                detail="At least one valid image is required.",
            )

        if len(image_list) == 1:
            image_list[0].save(output_pdf, "PDF")
        else:
            image_list[0].save(
                output_pdf,
                "PDF",
                save_all=True,
                append_images=image_list[1:],
            )

        for image in image_list:
            image.close()
        image_list.clear()

        # Workspace cleanup runs after the response has been sent.
        background_tasks.add_task(cleanup_workspace, workspace)

        return FileResponse(
            path=output_pdf,
            media_type="application/pdf",
            filename="converted.pdf",
            background=background_tasks,
        )

    except HTTPException:
        for image in image_list:
            try:
                image.close()
            except Exception:
                pass
        cleanup_workspace(workspace)
        raise

    except Exception as exc:
        for image in image_list:
            try:
                image.close()
            except Exception:
                pass
        cleanup_workspace(workspace)
        raise HTTPException(
            status_code=500,
            detail="Unable to convert the uploaded images to PDF.",
        ) from exc

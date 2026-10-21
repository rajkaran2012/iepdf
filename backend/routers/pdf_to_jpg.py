import platform
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pdf2image import convert_from_path

from config import MAX_FILE_SIZE, POPPLER_PATH, TEMP_FOLDER
from security.account_access import AccountContext, enforce_tool_access, require_account
from utils import safe_delete, save_upload_file, unique_filename, validate_upload

router = APIRouter()


def cleanup_workspace(workspace: str) -> None:
    shutil.rmtree(workspace, ignore_errors=True)


@router.post("/pdf-to-jpg")
async def pdf_to_jpg(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    account: AccountContext = Depends(require_account),
):
    await enforce_tool_access(account, "pdf-to-jpg", [file])
    await validate_upload(file)

    workspace = tempfile.mkdtemp(prefix="pdf-to-jpg-", dir=TEMP_FOLDER)
    pdf_path = str(Path(workspace) / Path(unique_filename("input.pdf")).name)
    zip_path = str(Path(workspace) / "jpg_pages.zip")
    images = []

    try:
        save_upload_file(file, pdf_path, max_bytes=MAX_FILE_SIZE)

        if platform.system() == "Windows":
            images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
        else:
            images = convert_from_path(pdf_path)

        if not images:
            raise HTTPException(status_code=400, detail="The PDF contains no pages.")

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
            for index, image in enumerate(images, start=1):
                image_path = Path(workspace) / f"page_{index}.jpg"
                image.save(str(image_path), "JPEG")
                zipf.write(str(image_path), arcname=f"page_{index}.jpg")
                safe_delete(str(image_path))

        for image in images:
            image.close()
        images.clear()

        background_tasks.add_task(cleanup_workspace, workspace)

        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename="jpg_pages.zip",
            background=background_tasks,
        )

    except HTTPException:
        for image in images:
            try:
                image.close()
            except Exception:
                pass
        cleanup_workspace(workspace)
        raise
    except Exception:
        for image in images:
            try:
                image.close()
            except Exception:
                pass
        cleanup_workspace(workspace)
        raise HTTPException(
            status_code=400,
            detail="Unable to convert the supplied PDF to JPG images.",
        ) from None

import os
import shutil
import tempfile
import zipfile
import platform

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pdf2image import convert_from_path

from utils import validate_upload
from config import POPPLER_PATH, TEMP_FOLDER

router = APIRouter()


def cleanup_workspace(path: str) -> None:
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)


def validate_zip_output(path: str) -> bool:
    if not os.path.isfile(path):
        return False

    try:
        if os.path.getsize(path) <= 0:
            return False

        with zipfile.ZipFile(path, "r") as zip_file:
            names = zip_file.namelist()

            if not names:
                return False

            for name in names:
                if not name.lower().endswith(".jpg"):
                    return False

                with zip_file.open(name) as image_file:
                    signature = image_file.read(3)

                if signature != b"\xff\xd8\xff":
                    return False

        return True

    except (OSError, zipfile.BadZipFile):
        return False


@router.post("/pdf-to-jpg")
async def pdf_to_jpg(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    await validate_upload(file)

    workspace = tempfile.mkdtemp(
        prefix="pdf-to-jpg-",
        dir=TEMP_FOLDER,
    )

    images = []

    try:
        pdf_path = os.path.join(workspace, "input.pdf")
        zip_path = os.path.join(workspace, "jpg_pages.zip")

        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            if platform.system() == "Windows":
                images = convert_from_path(
                    pdf_path,
                    poppler_path=POPPLER_PATH,
                )
            else:
                images = convert_from_path(pdf_path)

        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Unable to convert the supplied PDF.",
            )

        if not images:
            raise HTTPException(
                status_code=400,
                detail="The supplied PDF contains no renderable pages.",
            )

        with zipfile.ZipFile(
            zip_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
        ) as zip_file:

            for index, image in enumerate(images):
                image_path = os.path.join(
                    workspace,
                    f"page_{index + 1}.jpg",
                )

                try:
                    image.save(
                        image_path,
                        "JPEG",
                        quality=90,
                    )

                    zip_file.write(
                        image_path,
                        arcname=f"page_{index + 1}.jpg",
                    )

                finally:
                    try:
                        image.close()
                    except Exception:
                        pass

                    try:
                        if os.path.exists(image_path):
                            os.remove(image_path)
                    except OSError:
                        pass

        images.clear()

        if not validate_zip_output(zip_path):
            raise HTTPException(
                status_code=500,
                detail="JPG conversion produced an invalid output.",
            )

        background_tasks.add_task(
            cleanup_workspace,
            workspace,
        )

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
            status_code=500,
            detail="Unable to process the supplied PDF.",
        )

import os
import shutil
import tempfile
from typing import List

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError

from config import TEMP_FOLDER
from utils import validate_upload

router = APIRouter()


def cleanup_workspace(path: str) -> None:
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)


def validate_pdf_output(path: str) -> bool:
    if not os.path.isfile(path):
        return False

    try:
        if os.path.getsize(path) <= 0:
            return False

        with open(path, "rb") as pdf_file:
            return pdf_file.read(5) == b"%PDF-"
    except OSError:
        return False


@router.post("/jpg-to-pdf")
async def jpg_to_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(
            status_code=400,
            detail="Please upload at least one image.",
        )

    workspace = tempfile.mkdtemp(
        prefix="jpg-to-pdf-",
        dir=TEMP_FOLDER,
    )

    image_list = []

    try:
        for index, file in enumerate(files):
            await validate_upload(file)

            safe_input_name = f"input_{index + 1}.img"
            input_path = os.path.join(workspace, safe_input_name)

            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            try:
                with Image.open(input_path) as source_image:
                    source_image.verify()

                with Image.open(input_path) as source_image:
                    image = source_image.convert("RGB")

            except (UnidentifiedImageError, OSError):
                raise HTTPException(
                    status_code=400,
                    detail=f'"{file.filename}" is not a valid image.',
                )

            image_list.append(image)

        output_pdf = os.path.join(workspace, "converted.pdf")

        if len(image_list) == 1:
            image_list[0].save(
                output_pdf,
                "PDF",
            )
        else:
            image_list[0].save(
                output_pdf,
                "PDF",
                save_all=True,
                append_images=image_list[1:],
            )

        if not validate_pdf_output(output_pdf):
            raise HTTPException(
                status_code=500,
                detail="PDF generation produced an invalid output.",
            )

        for image in image_list:
            image.close()

        background_tasks.add_task(
            cleanup_workspace,
            workspace,
        )

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

    except Exception:
        for image in image_list:
            try:
                image.close()
            except Exception:
                pass

        cleanup_workspace(workspace)

        raise HTTPException(
            status_code=500,
            detail="Unable to convert the supplied images to PDF.",
        )

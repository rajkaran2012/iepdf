import os
import uuid
from typing import List

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError

from config import TEMP_FOLDER, OUTPUT_FOLDER
from utils import validate_upload, save_upload_file, delete_file

router = APIRouter()


@router.post("/jpg-to-pdf")
async def jpg_to_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(status_code=422, detail="At least one image is required.")

    temp_files = []
    image_list = []
    output_pdf = os.path.join(OUTPUT_FOLDER, f"{uuid.uuid4().hex}.pdf")
    output_created = False

    try:
        os.makedirs(TEMP_FOLDER, exist_ok=True)
        os.makedirs(OUTPUT_FOLDER, exist_ok=True)

        # Validate every upload before creating any temporary files.
        for file in files:
            await validate_upload(file)

        for file in files:
            temp_path = os.path.join(TEMP_FOLDER, f"{uuid.uuid4().hex}.upload")
            temp_files.append(temp_path)
            save_upload_file(file, temp_path)

            try:
                with Image.open(temp_path) as source:
                    converted = source.convert("RGB")
                image_list.append(converted)
            except (UnidentifiedImageError, OSError, ValueError) as exc:
                raise HTTPException(
                    status_code=422,
                    detail="One or more uploaded files are not valid supported images.",
                ) from exc

        if len(image_list) == 1:
            image_list[0].save(output_pdf, "PDF")
        else:
            image_list[0].save(
                output_pdf,
                "PDF",
                save_all=True,
                append_images=image_list[1:],
            )

        output_created = True

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to convert the uploaded images to PDF.",
        ) from exc
    finally:
        for image in image_list:
            try:
                image.close()
            except Exception:
                pass

        for temp_path in temp_files:
            try:
                delete_file(temp_path)
            except OSError:
                pass

        if not output_created:
            try:
                delete_file(output_pdf)
            except OSError:
                pass

    background_tasks.add_task(delete_file, output_pdf)

    return FileResponse(
        path=output_pdf,
        media_type="application/pdf",
        filename="converted.pdf",
        background=background_tasks,
    )

import os
import shutil
import zipfile
import platform

from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from pdf2image import convert_from_path

from utils import validate_upload, delete_file
from config import POPPLER_PATH

router = APIRouter()


@router.post("/pdf-to-jpg")
async def pdf_to_jpg(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    # Validate uploaded PDF
    await validate_upload(file)

    pdf_path = f"temp_{file.filename}"

    # Save uploaded PDF
    with open(pdf_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Windows uses local Poppler
    if platform.system() == "Windows":
        images = convert_from_path(
            pdf_path,
            poppler_path=POPPLER_PATH
        )
    else:
        # Linux (Render)
        images = convert_from_path(pdf_path)

    zip_name = "jpg_pages.zip"

    with zipfile.ZipFile(zip_name, "w") as zipf:
        for i, image in enumerate(images):
            img_name = f"page_{i+1}.jpg"

            image.save(img_name, "JPEG")

            zipf.write(img_name)

            os.remove(img_name)

    for image in images:
        image.close()

    os.remove(pdf_path)

    background_tasks.add_task(delete_file, zip_name)

    return FileResponse(
        path=zip_name,
        media_type="application/zip",
        filename="jpg_pages.zip",
        background=background_tasks
    )

from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List
from PIL import Image
from utils import validate_upload, delete_file
import shutil
import os

router = APIRouter()


@router.post("/jpg-to-pdf")
async def jpg_to_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...)
):

    # Validate uploaded images
    for file in files:
        await validate_upload(file)

    image_list = []
    temp_files = []

    # Save uploaded images
    for file in files:

        temp_path = f"temp_{file.filename}"

        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        img = Image.open(temp_path).convert("RGB")

        image_list.append(img)
        temp_files.append(temp_path)

    output_pdf = "converted.pdf"

    # Create PDF
    if len(image_list) == 1:
        image_list[0].save(output_pdf, "PDF")
    else:
        image_list[0].save(
            output_pdf,
            save_all=True,
            append_images=image_list[1:]
        )

    # Close images
    for img in image_list:
        img.close()

    # Delete temporary image files
    for temp_file in temp_files:
        os.remove(temp_file)

    # Delete output PDF after download
    background_tasks.add_task(delete_file, output_pdf)

    return FileResponse(
        path=output_pdf,
        media_type="application/pdf",
        filename="converted.pdf",
        background=background_tasks
    )


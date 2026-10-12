import os
import platform
import zipfile

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pdf2image import convert_from_path

from utils import validate_upload, save_upload_file, unique_filename, delete_file
from config import POPPLER_PATH, MAX_FILE_SIZE, TEMP_FOLDER, OUTPUT_FOLDER

router = APIRouter()


@router.post("/pdf-to-jpg")
async def pdf_to_jpg(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    await validate_upload(file)

    os.makedirs(TEMP_FOLDER, exist_ok=True)
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    pdf_path = os.path.join(TEMP_FOLDER, unique_filename("source.pdf"))
    zip_path = os.path.join(OUTPUT_FOLDER, unique_filename("jpg_pages.zip"))
    image_paths = []
    images = []

    try:
        save_upload_file(file, pdf_path, max_bytes=MAX_FILE_SIZE)

        if platform.system() == "Windows":
            images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
        else:
            images = convert_from_path(pdf_path)

        if not images:
            raise HTTPException(status_code=422, detail="The PDF contains no pages to convert.")

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
            for index, image in enumerate(images, start=1):
                image_path = os.path.join(
                    TEMP_FOLDER,
                    unique_filename(f"page_{index}.jpg"),
                )
                image_paths.append(image_path)
                image.save(image_path, "JPEG")
                zipf.write(image_path, arcname=f"page_{index}.jpg")

    except HTTPException:
        delete_file(zip_path)
        raise
    except Exception:
        delete_file(zip_path)
        raise HTTPException(
            status_code=500,
            detail="PDF to JPG conversion failed. Please check the PDF and try again.",
        ) from None
    finally:
        for image in images:
            try:
                image.close()
            except Exception:
                pass

        for path in image_paths:
            delete_file(path)

        delete_file(pdf_path)

    background_tasks.add_task(delete_file, zip_path)

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename="jpg_pages.zip",
        background=background_tasks,
    )

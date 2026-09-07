import json
from io import BytesIO
from typing import Annotated

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from fastapi.responses import StreamingResponse

from pypdf import PdfReader, PdfWriter

router = APIRouter(
    prefix="/merge-pdf",
    tags=["Merge PDF"],
)


@router.post("/unlock")
async def unlock_merge(
    files: Annotated[list[UploadFile], File(...)],
    passwords: str = Form("{}"),
    skipped: str = Form("[]"),
):

    try:

        print("=" * 60)
        print("UNLOCK REQUEST RECEIVED")
        print("=" * 60)

        # --------------------------------------
        # Parse JSON safely
        # --------------------------------------

        try:
            passwords_dict = json.loads(passwords)

        except json.JSONDecodeError:

            raise HTTPException(
                status_code=400,
                detail="Invalid passwords JSON.",
            )

        try:
            skipped_list = json.loads(skipped)

        except json.JSONDecodeError:

            raise HTTPException(
                status_code=400,
                detail="Invalid skipped JSON.",
            )

        print("Files:")

        for file in files:
            print(" -", file.filename)

        print()

        print("Passwords:")
        print(passwords_dict)

        print()

        print("Skipped:")
        print(skipped_list)

        print()
        print("=" * 60)
        print("Checking PDFs...")
        print("=" * 60)

        merge_queue = []

        writer = PdfWriter()

        for file in files:
             print("--------------------------------")
            print("Filename :", file.filename)

            # -----------------------------
            # Skip selected file
            # -----------------------------
            if file.filename in skipped_list:

                print("Status   : Skipped")
                continue

            # -----------------------------
            # Open PDF
            # -----------------------------
            try:

                reader = PdfReader(file.file)

            except Exception as ex:

                print("Status   : Invalid PDF")
                print("Reason   :", ex)
                continue

            # -----------------------------
            # Normal PDF
            # -----------------------------
            if not reader.is_encrypted:

                print("Status   : Normal PDF")
                print("Pages    :", len(reader.pages))

                merge_queue.append(reader)

                for page in reader.pages:
                    writer.add_page(page)

                continue

            # -----------------------------
            # Password Protected PDF
            # -----------------------------
            print("Status   : Password Protected")

            password = passwords_dict.get(
                file.filename,
                "",
            )

            if password == "":

                print("Result   : Password Missing")
                continue

            try:

                result = reader.decrypt(password)

            except Exception as ex:

                print("Result   : Decrypt Error")
                print("Reason   :", ex)
                continue

            if result:

                print("Result   : Password Correct")
                print("Pages    :", len(reader.pages))

                merge_queue.append(reader)

                for page in reader.pages:
                    writer.add_page(page)

            else:

                print("Result   : Password Incorrect")

        print()
        print("=" * 60)
        print("Merge Queue Size:", len(merge_queue))
        print("=" * 60)

        buffer = BytesIO()

        writer.write(buffer)

        buffer.seek(0)
         print()
        print("=" * 60)
        print(
            "Merged PDF Size:",
            buffer.getbuffer().nbytes,
            "bytes",
        )
        print("=" * 60)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="merged.pdf"',
            },
        )

    except HTTPException:
        raise

    except Exception as ex:

        print()
        print("=" * 60)
        print("UNEXPECTED ERROR")
        print("=" * 60)
        print(type(ex).__name__)
        print(str(ex))
        print("=" * 60)

        raise HTTPException(
            status_code=500,
            detail=str(ex),
        )
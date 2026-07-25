from io import BytesIO
from uuid import uuid4

from pypdf import PdfReader
from fastapi import UploadFile

from models.merge_models import (
    PDFFileMetadata,
    PDFStatus,
    ScanResponse,
)


class PDFScanner:

    @staticmethod
    async def scan_file(file: UploadFile) -> PDFFileMetadata:
        """
        Scan a single uploaded PDF and return metadata.
        """

        file_id = str(uuid4())

        extension = "." + file.filename.split(".")[-1].lower()

        try:
            data = await file.read()

            size = len(data)

            reader = PdfReader(BytesIO(data))

            encrypted = reader.is_encrypted

            pages = 0

            if not encrypted:
                pages = len(reader.pages)

            await file.seek(0)

            return PDFFileMetadata(
                id=file_id,
                filename=file.filename,
                extension=extension,
                size=size,
                pages=pages,
                encrypted=encrypted,
                corrupted=False,
                status=(
                    PDFStatus.PASSWORD_REQUIRED
                    if encrypted
                    else PDFStatus.READY
                ),
                message=None,
            )

        except Exception as e:

            await file.seek(0)

            return PDFFileMetadata(
                id=file_id,
                filename=file.filename,
                extension=extension,
                size=0,
                pages=0,
                encrypted=False,
                corrupted=True,
                status=PDFStatus.CORRUPTED,
                message=str(e),
            )

    @staticmethod
    async def scan_files(files: list[UploadFile]) -> ScanResponse:
        """
        Scan multiple PDFs.
        """

        scanned_files = []

        ready = 0
        protected = 0
        corrupted = 0

        for file in files:

            result = await PDFScanner.scan_file(file)

            scanned_files.append(result)

            if result.status == PDFStatus.READY:
                ready += 1

            elif result.status == PDFStatus.PASSWORD_REQUIRED:
                protected += 1

            elif result.status == PDFStatus.CORRUPTED:
                corrupted += 1

        return ScanResponse(
            success=True,
            total_files=len(scanned_files),
            ready_files=ready,
            protected_files=protected,
            corrupted_files=corrupted,
            files=scanned_files,
        )
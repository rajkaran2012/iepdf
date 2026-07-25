from typing import List

from fastapi import APIRouter, File, UploadFile

from services.pdf_scanner import PDFScanner
from models.merge_models import ScanResponse

router = APIRouter(
    prefix="/merge-pdf",
    tags=["Merge PDF"],
)


@router.post(
    "/scan",
    response_model=ScanResponse,
)
async def scan_pdfs(
    files: List[UploadFile] = File(...)
):
    """
    Scan uploaded PDFs.

    Returns metadata only.
    No merging is performed.
    """

    return await PDFScanner.scan_files(files)
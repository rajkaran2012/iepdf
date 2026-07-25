from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ==========================================
# PDF Status
# ==========================================

class PDFStatus(str, Enum):
    READY = "ready"
    PASSWORD_REQUIRED = "password_required"
    CORRUPTED = "corrupted"
    INVALID = "invalid"
    SKIPPED = "skipped"


# ==========================================
# Single PDF Metadata
# ==========================================

class PDFFileMetadata(BaseModel):
    id: str = Field(..., description="Temporary unique ID")
    filename: str
    extension: str

    size: int
    pages: int

    encrypted: bool
    corrupted: bool

    status: PDFStatus

    message: Optional[str] = None


# ==========================================
# Scan Response
# ==========================================

class ScanResponse(BaseModel):
    success: bool = True

    total_files: int

    ready_files: int

    protected_files: int

    corrupted_files: int

    files: List[PDFFileMetadata]


# ==========================================
# Password Entry
# ==========================================

class PasswordEntry(BaseModel):
    file_id: str
    password: str


# ==========================================
# Merge Request
# ==========================================

class MergeRequest(BaseModel):
    passwords: List[PasswordEntry] = []

    skipped_files: List[str] = []
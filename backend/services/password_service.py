from typing import Dict, List

from pypdf import PdfReader


def is_pdf_encrypted(pdf_path: str) -> bool:
    """
    Check whether a PDF is encrypted.
    """

    reader = PdfReader(pdf_path)

    return reader.is_encrypted


def decrypt_pdf(reader: PdfReader, password: str) -> bool:
    """
    Try to decrypt a PDF.

    Returns:
        True if password is correct.
        False otherwise.
    """

    try:
        return reader.decrypt(password) != 0

    except Exception:
        return False


def get_encrypted_files(file_paths: List[str]) -> List[Dict]:
    """
    Returns all encrypted PDFs.

    Example:

    [
        {
            "index": 0,
            "name": "Aadhaar.pdf"
        },
        {
            "index": 2,
            "name": "Bank.pdf"
        }
    ]
    """

    encrypted_files = []

    for index, path in enumerate(file_paths):

        reader = PdfReader(path)

        if reader.is_encrypted:

            encrypted_files.append(
                {
                    "index": index,
                    "name": path.split("\\")[-1],
                }
            )

    return encrypted_files


def validate_passwords(
    file_paths: List[str],
    passwords: Dict[int, str],
):
    """
    Validate passwords for encrypted PDFs.

    Returns:

    {
        "success": True
    }

    OR

    {
        "success": False,
        "errors": {
            1: "Incorrect password",
            3: "Incorrect password"
        }
    }
    """

    errors = {}

    for index, path in enumerate(file_paths):

        reader = PdfReader(path)

        if not reader.is_encrypted:
            continue

        password = passwords.get(index, "")

        if not decrypt_pdf(reader, password):

            errors[index] = "Incorrect password"

    if errors:

        return {
            "success": False,
            "errors": errors,
        }

    return {
        "success": True,
    }
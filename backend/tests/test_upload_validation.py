import io
import unittest
from unittest.mock import patch

from fastapi import HTTPException, UploadFile

from config import MAX_FILE_SIZE
from utils import validate_upload


class UploadValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_accepts_upload_below_limit(self):
        upload = UploadFile(
            filename="small.pdf",
            file=io.BytesIO(b"x" * 1024),
        )

        await validate_upload(upload)

        self.assertEqual(upload.file.tell(), 0)

    async def test_accepts_upload_at_exact_limit(self):
        upload = UploadFile(
            filename="limit.pdf",
            file=io.BytesIO(b"x" * MAX_FILE_SIZE),
        )

        await validate_upload(upload)

        self.assertEqual(upload.file.tell(), 0)

    async def test_rejects_upload_above_limit(self):
        upload = UploadFile(
            filename="large.pdf",
            file=io.BytesIO(b"x" * (MAX_FILE_SIZE + 1)),
        )

        with self.assertRaises(HTTPException) as context:
            await validate_upload(upload)

        self.assertEqual(context.exception.status_code, 413)

    async def test_restores_file_position_after_validation(self):
        upload = UploadFile(
            filename="position.pdf",
            file=io.BytesIO(b"abcdef"),
        )
        upload.file.seek(3)

        await validate_upload(upload)

        self.assertEqual(upload.file.tell(), 0)


if __name__ == "__main__":
    unittest.main()

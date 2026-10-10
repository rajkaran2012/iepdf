import io
import unittest
from unittest.mock import patch

from fastapi import HTTPException, UploadFile

from config import MAX_FILE_SIZE
from utils import save_upload_file, validate_upload


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


    def test_bounded_copy_rejects_oversize_and_removes_partial_file(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory

        upload = UploadFile(
            filename="too-large.pdf",
            file=io.BytesIO(b"0123456789"),
        )

        with TemporaryDirectory() as directory:
            destination = Path(directory) / "partial.pdf"

            with self.assertRaises(HTTPException) as context:
                save_upload_file(upload, str(destination), max_bytes=5)

            self.assertEqual(context.exception.status_code, 413)
            self.assertFalse(destination.exists())

    def test_bounded_copy_accepts_exact_limit(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory

        content = b"12345"
        upload = UploadFile(
            filename="within-limit.pdf",
            file=io.BytesIO(content),
        )

        with TemporaryDirectory() as directory:
            destination = Path(directory) / "valid.pdf"
            save_upload_file(upload, str(destination), max_bytes=len(content))

            self.assertEqual(destination.read_bytes(), content)


    def test_bounded_copy_removes_partial_file_after_write_failure(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory

        upload = UploadFile(
            filename="write-failure.pdf",
            file=io.BytesIO(b"valid test bytes"),
        )

        with TemporaryDirectory() as directory:
            destination = Path(directory) / "partial.pdf"

            from unittest.mock import mock_open

            fake_file = mock_open()
            fake_file.return_value.write.side_effect = OSError(
                "simulated disk write failure"
            )

            with patch("builtins.open", fake_file):

                with self.assertRaisesRegex(
                    OSError, "simulated disk write failure"
                ):
                    save_upload_file(upload, str(destination), max_bytes=100)

            self.assertFalse(destination.exists())


if __name__ == "__main__":
    unittest.main()

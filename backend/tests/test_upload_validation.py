import io
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException, UploadFile

from config import MAX_FILE_SIZE
from security.plan_policy import ToolLimit
from security.upload_validation import validate_upload_batch
from utils import save_upload_file, validate_upload


def make_upload(name: str, size: int) -> UploadFile:
    return UploadFile(filename=name, file=io.BytesIO(b"x" * size))


class UploadValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_accepts_upload_below_limit(self):
        upload = UploadFile(filename="small.pdf", file=io.BytesIO(b"x" * 1024))
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
        upload = UploadFile(filename="position.pdf", file=io.BytesIO(b"abcdef"))
        upload.file.seek(3)
        await validate_upload(upload)
        self.assertEqual(upload.file.tell(), 0)

    def test_bounded_copy_rejects_oversize_and_removes_partial_file(self):
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
        upload = UploadFile(
            filename="write-failure.pdf",
            file=io.BytesIO(b"valid test bytes"),
        )
        with TemporaryDirectory() as directory:
            destination = Path(directory) / "partial.pdf"
            fake_file = unittest.mock.mock_open()
            fake_file.return_value.write.side_effect = OSError(
                "simulated disk write failure"
            )
            with patch("builtins.open", fake_file):
                with self.assertRaisesRegex(
                    OSError, "simulated disk write failure"
                ):
                    save_upload_file(upload, str(destination), max_bytes=100)
            self.assertFalse(destination.exists())


class UploadBatchValidationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.limits = ToolLimit(
            min_files=1,
            max_files=3,
            max_file_size_bytes=10,
            max_total_size_bytes=20,
        )

    async def test_accepts_valid_batch_and_resets_file_positions(self):
        files = [make_upload("a.jpg", 8), make_upload("b.jpg", 9)]
        await validate_upload_batch(files, self.limits)
        self.assertEqual([f.file.tell() for f in files], [0, 0])

    async def test_rejects_too_few_files(self):
        with self.assertRaises(HTTPException) as raised:
            await validate_upload_batch([], self.limits)
        self.assertEqual(raised.exception.status_code, 400)

    async def test_rejects_too_many_files(self):
        files = [make_upload(f"{i}.jpg", 1) for i in range(4)]
        with self.assertRaises(HTTPException) as raised:
            await validate_upload_batch(files, self.limits)
        self.assertEqual(raised.exception.status_code, 400)

    async def test_rejects_file_over_individual_limit(self):
        with self.assertRaises(HTTPException) as raised:
            await validate_upload_batch([make_upload("large.jpg", 11)], self.limits)
        self.assertEqual(raised.exception.status_code, 413)

    async def test_rejects_combined_size_over_limit(self):
        files = [make_upload("a.jpg", 10), make_upload("b.jpg", 11)]
        with self.assertRaises(HTTPException) as raised:
            await validate_upload_batch(files, self.limits)
        self.assertEqual(raised.exception.status_code, 413)

    async def test_accepts_exact_file_and_total_boundaries(self):
        files = [make_upload("a.jpg", 10), make_upload("b.jpg", 10)]
        await validate_upload_batch(files, self.limits)


if __name__ == "__main__":
    unittest.main(verbosity=2)

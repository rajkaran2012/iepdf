import io
import unittest

from fastapi import HTTPException, UploadFile

from security.plan_policy import ToolLimit
from security.upload_validation import validate_upload_batch


def make_upload(name: str, size: int) -> UploadFile:
    return UploadFile(filename=name, file=io.BytesIO(b"x" * size))


class UploadBatchValidationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.limits = ToolLimit(
            min_files=1,
            max_files=3,
            max_file_size_bytes=10,
            max_total_size_bytes=20,
        )

    async def test_accepts_valid_batch(self):
        files = [make_upload("a.pdf", 10), make_upload("b.pdf", 10)]
        await validate_upload_batch(files, self.limits)
        self.assertEqual([f.file.tell() for f in files], [0, 0])

    async def test_rejects_too_few_files(self):
        with self.assertRaises(HTTPException) as context:
            await validate_upload_batch([], self.limits)
        self.assertEqual(context.exception.status_code, 400)

    async def test_rejects_too_many_files(self):
        files = [make_upload(f"{i}.pdf", 1) for i in range(4)]
        with self.assertRaises(HTTPException) as context:
            await validate_upload_batch(files, self.limits)
        self.assertEqual(context.exception.status_code, 400)

    async def test_rejects_file_over_limit(self):
        files = [make_upload("large.pdf", 11)]
        with self.assertRaises(HTTPException) as context:
            await validate_upload_batch(files, self.limits)
        self.assertEqual(context.exception.status_code, 413)

    async def test_rejects_total_size_over_limit(self):
        files = [make_upload("a.pdf", 10), make_upload("b.pdf", 11)]
        with self.assertRaises(HTTPException) as context:
            await validate_upload_batch(files, self.limits)
        self.assertEqual(context.exception.status_code, 413)

    async def test_accepts_exact_file_and_total_limits(self):
        limits = ToolLimit(
            min_files=2,
            max_files=2,
            max_file_size_bytes=10,
            max_total_size_bytes=20,
        )
        files = [make_upload("a.pdf", 10), make_upload("b.pdf", 10)]
        await validate_upload_batch(files, limits)

    async def test_resets_file_position_when_file_is_rejected(self):
        upload = make_upload("large.pdf", 11)
        with self.assertRaises(HTTPException):
            await validate_upload_batch([upload], self.limits)
        self.assertEqual(upload.file.tell(), 0)


if __name__ == "__main__":
    unittest.main()

import io
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from pypdf import PdfReader

from config import TEMP_FOLDER
from main import app


ROOT = Path(r"C:\IEPDF")
PDF_A = ROOT / "test-merge-A.pdf"
PDF_B = ROOT / "test-merge-B.pdf"
MAX_FILE_SIZE = 15 * 1024 * 1024


class MergeEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def temp_names(self):
        folder = Path(TEMP_FOLDER)
        return {p.name for p in folder.iterdir() if p.is_file()} if folder.exists() else set()

    def test_two_valid_pdfs_merge_into_three_pages(self):
        with PDF_A.open("rb") as a, PDF_B.open("rb") as b:
            response = self.client.post(
                "/merge-pdf",
                files=[
                    ("files", ("test-merge-A.pdf", a, "application/pdf")),
                    ("files", ("test-merge-B.pdf", b, "application/pdf")),
                ],
            )

        self.assertEqual(response.status_code, 200, response.text[:500])
        self.assertTrue(
            response.headers.get("content-type", "").startswith("application/pdf")
        )
        merged = PdfReader(io.BytesIO(response.content), strict=True)
        self.assertEqual(len(merged.pages), 3)

    def test_one_file_is_rejected(self):
        with PDF_A.open("rb") as a:
            response = self.client.post(
                "/merge-pdf",
                files=[("files", ("test-merge-A.pdf", a, "application/pdf"))],
            )

        self.assertEqual(response.status_code, 400)

    def test_six_files_are_rejected(self):
        with PDF_A.open("rb") as a:
            payload = a.read()

        response = self.client.post(
            "/merge-pdf",
            files=[
                ("files", (f"copy-{i}.pdf", io.BytesIO(payload), "application/pdf"))
                for i in range(6)
            ],
        )

        self.assertEqual(response.status_code, 400)

    def test_file_over_15_mib_is_rejected(self):
        oversized = io.BytesIO(b"x" * (MAX_FILE_SIZE + 1))
        with PDF_B.open("rb") as b:
            response = self.client.post(
                "/merge-pdf",
                files=[
                    ("files", ("oversized.pdf", oversized, "application/pdf")),
                    ("files", ("test-merge-B.pdf", b, "application/pdf")),
                ],
            )

        self.assertEqual(response.status_code, 413)

    def test_malformed_pdf_returns_error_and_cleans_temp_files(self):
        before = self.temp_names()

        with PDF_B.open("rb") as b:
            response = self.client.post(
                "/merge-pdf",
                files=[
                    ("malformed.pdf", ("malformed.pdf", io.BytesIO(b"not a PDF"), "application/pdf")),
                    ("files", ("test-merge-B.pdf", b, "application/pdf")),
                ],
            )

        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)
        self.assertEqual(self.temp_names(), before)


if __name__ == "__main__":
    unittest.main()
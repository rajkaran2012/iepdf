import io
import unittest
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter

from config import TEMP_FOLDER
from main import app


PDF_A = None
PDF_B = None
MAX_FILE_SIZE = 50 * 1024 * 1024


class MergeEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global PDF_A, PDF_B
        cls.client = TestClient(app)
        cls.fixture_dir = tempfile.TemporaryDirectory(prefix="iepdf-merge-tests-")
        fixture_root = Path(cls.fixture_dir.name)

        PDF_A = fixture_root / "test-merge-A.pdf"
        PDF_B = fixture_root / "test-merge-B.pdf"

        writer_a = PdfWriter()
        writer_a.add_blank_page(width=72, height=72)
        with PDF_A.open("wb") as output:
            writer_a.write(output)

        writer_b = PdfWriter()
        writer_b.add_blank_page(width=72, height=72)
        writer_b.add_blank_page(width=72, height=72)
        with PDF_B.open("wb") as output:
            writer_b.write(output)

    @classmethod
    def tearDownClass(cls):
        cls.fixture_dir.cleanup()

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
                    ("files", ("malformed.pdf", io.BytesIO(b"not a PDF"), "application/pdf")),
                    ("files", ("test-merge-B.pdf", b, "application/pdf")),
                ],
            )

        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)
        self.assertEqual(self.temp_names(), before)


    def test_empty_pdf_is_rejected(self):
        with PDF_B.open("rb") as b:
            response = self.client.post(
                "/merge-pdf",
                files=[
                    ("files", ("empty.pdf", io.BytesIO(b""), "application/pdf")),
                    ("files", ("test-merge-B.pdf", b, "application/pdf")),
                ],
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", response.json()["detail"].lower())

    def test_encrypted_pdf_is_rejected(self):
        from pypdf import PdfWriter

        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        writer.encrypt("test-password")
        encrypted = io.BytesIO()
        writer.write(encrypted)
        encrypted.seek(0)

        with PDF_B.open("rb") as b:
            response = self.client.post(
                "/merge-pdf",
                files=[
                    ("files", ("encrypted.pdf", encrypted, "application/pdf")),
                    ("files", ("test-merge-B.pdf", b, "application/pdf")),
                ],
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.json()["detail"].lower())

    def test_corrupted_pdf_returns_error_and_cleans_temp_files(self):
        before = self.temp_names()

        with PDF_B.open("rb") as b:
            response = self.client.post(
                "/merge-pdf",
                files=[
                    ("files", ("corrupted.pdf", io.BytesIO(b"%PDF-1.4\n%%EOF"), "application/pdf")),
                    ("files", ("test-merge-B.pdf", b, "application/pdf")),
                ],
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.temp_names(), before)

    def test_invalid_generated_output_is_rejected_and_deleted(self):
        from unittest.mock import patch
        import routers.merge as merge_router

        output_folder = Path(merge_router.OUTPUT_FOLDER)
        output_folder.mkdir(parents=True, exist_ok=True)
        before = {p.name for p in output_folder.iterdir() if p.is_file()}

        real_writer = merge_router.PdfWriter

        class InvalidOutputWriter:
            def __init__(self):
                self._writer = real_writer()

            def add_page(self, page):
                self._writer.add_page(page)

            def write(self, output_file):
                output_file.write(b"%PDF-1.4\n%%EOF")

        with PDF_A.open("rb") as a, PDF_B.open("rb") as b:
            with patch.object(merge_router, "PdfWriter", InvalidOutputWriter):
                response = self.client.post(
                    "/merge-pdf",
                    files=[
                        ("files", ("test-merge-A.pdf", a, "application/pdf")),
                        ("files", ("test-merge-B.pdf", b, "application/pdf")),
                    ],
                )

        self.assertEqual(response.status_code, 500, response.text[:500])
        after = {p.name for p in output_folder.iterdir() if p.is_file()}
        self.assertEqual(after, before)
if __name__ == "__main__":
    unittest.main()

from io import BytesIO
import unittest
import zipfile

from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter

from config import MAX_FILE_SIZE
from main import app


class SplitEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def make_pdf(self, page_count=2):
        writer = PdfWriter()
        for _ in range(page_count):
            writer.add_blank_page(width=300, height=400)

        output = BytesIO()
        writer.write(output)
        return output.getvalue()

    def test_valid_pdf_returns_zip_with_expected_pages(self):
        pdf_bytes = self.make_pdf(page_count=2)

        response = self.client.post(
            "/split-pdf",
            files={
                "file": ("two-pages.pdf", BytesIO(pdf_bytes), "application/pdf")
            },
        )

        self.assertEqual(response.status_code, 200, response.text[:500])
        self.assertTrue(
            response.headers.get("content-type", "").startswith("application/zip")
        )

        with zipfile.ZipFile(BytesIO(response.content)) as archive:
            self.assertEqual(
                sorted(archive.namelist()),
                ["page_1.pdf", "page_2.pdf"],
            )
            for name in archive.namelist():
                reader = PdfReader(BytesIO(archive.read(name)), strict=True)
                self.assertEqual(len(reader.pages), 1)

    def test_upload_over_15_mib_is_rejected(self):
        oversized = BytesIO(b"x" * (MAX_FILE_SIZE + 1))

        response = self.client.post(
            "/split-pdf",
            files={
                "file": ("oversized.pdf", oversized, "application/pdf")
            },
        )

        self.assertEqual(response.status_code, 413)


if __name__ == "__main__":
    unittest.main()
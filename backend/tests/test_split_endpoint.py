from io import BytesIO
import os
import unittest
import zipfile
from unittest.mock import patch

from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter

from config import MAX_FILE_SIZE, TEMP_FOLDER, OUTPUT_FOLDER
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

    def folder_snapshot(self, folder):
        return set(os.listdir(folder))

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

    def test_parser_failure_cleans_uploaded_pdf_and_partial_zip(self):
        temp_before = self.folder_snapshot(TEMP_FOLDER)
        output_before = self.folder_snapshot(OUTPUT_FOLDER)
        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "routers.split.PdfReader",
            side_effect=ValueError("simulated PDF parsing failure"),
        ):
            response = client.post(
                "/split-pdf",
                files={
                    "file": (
                        "parser-failure.pdf",
                        BytesIO(self.make_pdf()),
                        "application/pdf",
                    )
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            self.folder_snapshot(TEMP_FOLDER),
            temp_before,
            "Temporary files leaked after parser failure.",
        )
        self.assertEqual(
            self.folder_snapshot(OUTPUT_FOLDER),
            output_before,
            "Output files leaked after parser failure.",
        )

    def test_zip_write_failure_cleans_input_page_and_partial_zip(self):
        temp_before = self.folder_snapshot(TEMP_FOLDER)
        output_before = self.folder_snapshot(OUTPUT_FOLDER)
        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "routers.split.zipfile.ZipFile.write",
            side_effect=OSError("simulated ZIP write failure"),
        ):
            response = client.post(
                "/split-pdf",
                files={
                    "file": (
                        "zip-failure.pdf",
                        BytesIO(self.make_pdf()),
                        "application/pdf",
                    )
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            self.folder_snapshot(TEMP_FOLDER),
            temp_before,
            "Temporary input or page PDFs leaked after ZIP failure.",
        )
        self.assertEqual(
            self.folder_snapshot(OUTPUT_FOLDER),
            output_before,
            "Partial ZIP leaked after ZIP-writing failure.",
        )


if __name__ == "__main__":
    unittest.main()

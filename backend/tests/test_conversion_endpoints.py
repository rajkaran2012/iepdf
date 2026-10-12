import io
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter

from config import MAX_FILE_SIZE, OUTPUT_FOLDER, TEMP_FOLDER
from main import app


class PdfToJpgEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, raise_server_exceptions=False)

    def file_snapshot(self, folder):
        path = Path(folder)
        return {item.name for item in path.iterdir() if item.is_file()} if path.exists() else set()

    def make_pdf(self):
        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        output = io.BytesIO()
        writer.write(output)
        return output.getvalue()

    def test_successful_conversion_returns_jpeg_zip(self):
        pdf_bytes = self.make_pdf()

        def fake_convert(*args, **kwargs):
            return [Image.new("RGB", (8, 8), "white")]

        with patch("routers.pdf_to_jpg.convert_from_path", side_effect=fake_convert):
            response = self.client.post(
                "/pdf-to-jpg",
                files={"file": ("sample.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            )

        self.assertEqual(response.status_code, 200, response.text[:500])
        self.assertTrue(response.headers.get("content-type", "").startswith("application/zip"))

    def test_upload_over_15_mib_is_rejected(self):
        response = self.client.post(
            "/pdf-to-jpg",
            files={"file": ("oversized.pdf", io.BytesIO(b"x" * (MAX_FILE_SIZE + 1)), "application/pdf")},
        )
        self.assertEqual(response.status_code, 413)

    def test_conversion_failure_returns_controlled_error_and_cleans_files(self):
        import uuid

        pdf_bytes = self.make_pdf()
        before_temp = self.file_snapshot(TEMP_FOLDER)
        before_output = self.file_snapshot(OUTPUT_FOLDER)
        backend_root = Path(__file__).resolve().parents[1]
        upload_name = f"failure-cleanup-{uuid.uuid4().hex}.pdf"
        test_temp_path = backend_root / f"temp_{upload_name}"
        self.assertFalse(test_temp_path.exists(), "Generated test path unexpectedly exists.")

        with patch(
            "routers.pdf_to_jpg.convert_from_path",
            side_effect=RuntimeError("simulated conversion failure"),
        ):
            response = self.client.post(
                "/pdf-to-jpg",
                files={"file": (upload_name, io.BytesIO(pdf_bytes), "application/pdf")},
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(self.file_snapshot(TEMP_FOLDER), before_temp)
        self.assertEqual(self.file_snapshot(OUTPUT_FOLDER), before_output)
        self.assertFalse(test_temp_path.exists(), "Failed conversion left its uploaded PDF behind.")

if __name__ == "__main__":
    unittest.main()


class JpgToPdfEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, raise_server_exceptions=False)

    def file_snapshot(self, folder):
        path = Path(folder)
        return {item.name for item in path.iterdir() if item.is_file()} if path.exists() else set()

    def make_jpeg(self):
        output = io.BytesIO()
        Image.new("RGB", (8, 8), "white").save(output, format="JPEG")
        return output.getvalue()

    def test_successful_conversion_returns_pdf(self):
        response = self.client.post(
            "/jpg-to-pdf",
            files=[("files", ("sample.jpg", io.BytesIO(self.make_jpeg()), "image/jpeg"))],
        )

        self.assertEqual(response.status_code, 200, response.text[:500])
        self.assertTrue(response.headers.get("content-type", "").startswith("application/pdf"))
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_upload_over_15_mib_is_rejected(self):
        response = self.client.post(
            "/jpg-to-pdf",
            files=[("files", ("oversized.jpg", io.BytesIO(b"x" * (MAX_FILE_SIZE + 1)), "image/jpeg"))],
        )

        self.assertEqual(response.status_code, 413)

    def test_invalid_image_returns_error_and_cleans_temporary_files(self):
        import uuid

        before_temp = self.file_snapshot(TEMP_FOLDER)
        before_output = self.file_snapshot(OUTPUT_FOLDER)
        backend_root = Path(__file__).resolve().parents[1]
        upload_name = f"invalid-image-{uuid.uuid4().hex}.jpg"
        test_temp_path = backend_root / f"temp_{upload_name}"
        self.assertFalse(test_temp_path.exists(), "Generated test path unexpectedly exists.")

        response = self.client.post(
            "/jpg-to-pdf",
            files=[("files", (upload_name, io.BytesIO(b"not an image"), "image/jpeg"))],
        )

        self.assertGreaterEqual(response.status_code, 400)
        self.assertEqual(self.file_snapshot(TEMP_FOLDER), before_temp)
        self.assertEqual(self.file_snapshot(OUTPUT_FOLDER), before_output)
        self.assertFalse(test_temp_path.exists(), "Invalid image upload was left behind.")

    def test_pdf_save_failure_cleans_temporary_files(self):
        import uuid

        before_temp = self.file_snapshot(TEMP_FOLDER)
        before_output = self.file_snapshot(OUTPUT_FOLDER)
        upload_name = f"write-failure-{uuid.uuid4().hex}.jpg"
        jpeg_bytes = self.make_jpeg()

        with patch(
            "routers.jpg_to_pdf.Image.Image.save",
            side_effect=OSError("simulated PDF write failure"),
        ):
            response = self.client.post(
                "/jpg-to-pdf",
                files=[("files", (upload_name, io.BytesIO(jpeg_bytes), "image/jpeg"))],
            )

        self.assertGreaterEqual(response.status_code, 400)
        self.assertEqual(self.file_snapshot(TEMP_FOLDER), before_temp)
        self.assertEqual(self.file_snapshot(OUTPUT_FOLDER), before_output)

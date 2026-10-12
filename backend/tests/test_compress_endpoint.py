from io import BytesIO
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from config import MAX_FILE_SIZE, TEMP_FOLDER
from main import app


class CompressEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, raise_server_exceptions=False)

    def folder_snapshot(self):
        return set(os.listdir(TEMP_FOLDER))

    def test_upload_over_15_mib_is_rejected(self):
        oversized = BytesIO(b"x" * (MAX_FILE_SIZE + 1))

        response = self.client.post(
            "/compress-pdf",
            files={
                "file": ("oversized.pdf", oversized, "application/pdf")
            },
        )

        self.assertEqual(response.status_code, 413)

    def test_copy_failure_cleans_compression_workspace(self):
        temp_before = self.folder_snapshot()

        with patch(
            "routers.compress.save_upload_file",
            side_effect=OSError("simulated bounded-copy failure"),
        ), patch(
            "routers.compress.os.path.isfile",
            return_value=True,
        ):
            response = self.client.post(
                "/compress-pdf",
                files={
                    "file": (
                        "copy-failure.pdf",
                        BytesIO(b"test input"),
                        "application/pdf",
                    )
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            self.folder_snapshot(),
            temp_before,
            "Compression workspace leaked after upload-copy failure.",
        )


if __name__ == "__main__":
    unittest.main()
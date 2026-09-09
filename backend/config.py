import os
import shutil

# ==========================================
# PROJECT ROOT
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ==========================================
# FOLDERS
# ==========================================

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "outputs")
TEMP_FOLDER = os.path.join(BASE_DIR, "temp")
LOG_FOLDER = os.path.join(BASE_DIR, "logs")

# ==========================================
# FILE SIZE LIMIT
# ==========================================

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

# ==========================================
# POPPLER
# ==========================================

POPPLER_PATH = r"C:\poppler\Library\bin"

# ==========================================
# GHOSTSCRIPT
# ==========================================

_WINDOWS_GHOSTSCRIPT_PATH = (
    r"C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe"
)

GHOSTSCRIPT_PATH = (
    os.environ.get("GHOSTSCRIPT_PATH")
    or shutil.which("gs")
    or _WINDOWS_GHOSTSCRIPT_PATH
)

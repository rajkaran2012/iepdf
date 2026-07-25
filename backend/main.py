from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utils import ensure_directories

# ==========================================
# IMPORT ROUTERS
# ==========================================

from routers.merge import router as merge_router
from routers.merge_scan import router as merge_scan_router
from routers.merge_unlock import router as merge_unlock_router
from routers.check_passwords import router as check_passwords_router
from routers.split import router as split_router
from routers.pdf_to_jpg import router as pdf_to_jpg_router
from routers.jpg_to_pdf import router as jpg_to_pdf_router
from routers.compress import router as compress_router

# ==========================================
# CREATE FASTAPI APP
# ==========================================

app = FastAPI(
    title="iePDF API",
    version="2.0.0",
    description="Backend API for iePDF Professional PDF Toolkit",
)

# ==========================================
# CREATE REQUIRED FOLDERS
# ==========================================

ensure_directories()

# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Production
        "https://iepdf.com",
        "https://www.iepdf.com",
        "https://iepdf.vercel.app",
        "https://iepdf-web.vercel.app",

        # Local Development
        "http://localhost:3000",
        "http://127.0.0.1:3000",

        # Local Network
        "http://192.168.2.3:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# REGISTER ROUTERS
# ==========================================

app.include_router(merge_router)
app.include_router(merge_scan_router)
app.include_router(merge_unlock_router)
app.include_router(check_passwords_router)
app.include_router(split_router)
app.include_router(pdf_to_jpg_router)
app.include_router(jpg_to_pdf_router)
app.include_router(compress_router)

# ==========================================
# ROOT ENDPOINT
# ==========================================

@app.get("/")
def home():
    return {
        "status": "Backend Running",
        "application": "iePDF Backend",
        "version": "2.0.0",
    }
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utils import ensure_directories

from routers.merge import router as merge_router
from routers.split import router as split_router
from routers.pdf_to_jpg import router as pdf_to_jpg_router
from routers.jpg_to_pdf import router as jpg_to_pdf_router
from routers.compress import router as compress_router

# ==========================================
# CREATE FASTAPI APP
# ==========================================

app = FastAPI()

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
        "https://iepdf-web.vercel.app",
        "https://iepdf.vercel.app",
        "https://iepdf.com",
        "https://www.iepdf.com",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# ROUTERS
# ==========================================

app.include_router(merge_router)
app.include_router(split_router)
app.include_router(pdf_to_jpg_router)
app.include_router(jpg_to_pdf_router)
app.include_router(compress_router)

# ==========================================
# ROOT
# ==========================================

@app.get("/")
def home():
    return {"status": "Backend Running"}
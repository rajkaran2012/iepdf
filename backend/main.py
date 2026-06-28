
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pypdf import PdfReader, PdfWriter


from utils import validate_upload, delete_file


from routers.merge import router as merge_router
from routers.split import router as split_router
from routers.pdf_to_jpg import router as pdf_to_jpg_router
from routers.jpg_to_pdf import router as jpg_to_pdf_router
from routers.compress import router as compress_router


app = FastAPI()
app.include_router(merge_router)
app.include_router(split_router)
app.include_router(pdf_to_jpg_router)
app.include_router(jpg_to_pdf_router)
app.include_router(compress_router)

@app.get("/")
def home():
    return {"status": "Backend Running"}

# ==========================================
# ROOT
# ==========================================
@app.get("/")
def home():
    return {"status": "Backend Running"}
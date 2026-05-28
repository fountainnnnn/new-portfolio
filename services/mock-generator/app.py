# app.py
# -*- coding: utf-8 -*-
"""
Mock Paper Generator API
- Accepts PDF/DOCX uploads
- Extracts + cleans text (EasyOCR fallback for scanned PDFs)
- Generates mock exam papers using OpenAI models
- Returns generated papers as a zip download
"""

import os
import io
import time
import asyncio
import tempfile
import zipfile
import traceback
import shutil
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

# --------------------------------------------------------
# Load .env from either ./ or repo root
# --------------------------------------------------------
candidates = [
    Path(__file__).resolve().parent / ".env",         # ./app/.env
    Path(__file__).resolve().parent.parent / ".env",  # repo root .env
]
for env_path in candidates:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        print(f"[DEBUG] Loaded .env from {env_path}")
        break
else:
    load_dotenv(override=True)  # fallback: current working dir

if os.getenv("OPENAI_API_KEY"):
    print("[DEBUG] OPENAI_API_KEY loaded (hidden)")
else:
    print("[DEBUG] OPENAI_API_KEY not set")

# --------------------------------------------------------
# Import pipeline and EasyOCR bootstrap
# --------------------------------------------------------
try:
    from src.core.pipeline import run_pipeline_end_to_end
except Exception as e:
    raise RuntimeError(f"Failed to import pipeline: {e}")

try:
    from src.core.bootstrap import ensure_easyocr_weights
except Exception as e:
    ensure_easyocr_weights = None
    print(f"[WARN] EasyOCR bootstrap unavailable: {e}")

# =========================
# App setup
# =========================
app = FastAPI(title="Mock Paper Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ngyuhang.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_MODEL_NAME = os.getenv("MOCK_GENERATOR_MODEL", "gpt-4.1")
MAX_UPLOAD_BYTES = int(os.getenv("MOCK_GENERATOR_MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
RATE_BUCKETS: dict[str, list[float]] = {}
RATE_LIMITS = {
    ("POST", "/generate"): (
        int(os.getenv("MOCK_GENERATOR_RATE_MAX", "3")),
        int(os.getenv("MOCK_GENERATOR_RATE_WINDOW_SECONDS", "60")),
    ),
}


def _client_id(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded_for or (request.client.host if request.client else "local")


def _allow_rate(request: Request) -> tuple[bool, int]:
    limit = RATE_LIMITS.get((request.method, request.url.path))
    if not limit:
        return True, 0

    max_requests, window_seconds = limit
    now = time.time()
    bucket_key = f"{request.method}:{request.url.path}:{_client_id(request)}"
    timestamps = [ts for ts in RATE_BUCKETS.get(bucket_key, []) if now - ts < window_seconds]
    if len(timestamps) >= max_requests:
        retry_after = max(1, int(window_seconds - (now - timestamps[0])))
        RATE_BUCKETS[bucket_key] = timestamps
        return False, retry_after

    timestamps.append(now)
    RATE_BUCKETS[bucket_key] = timestamps
    return True, 0


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    allowed, retry_after = _allow_rate(request)
    if not allowed:
        return JSONResponse(
            {"status": "error", "message": "Rate limit exceeded. Try again shortly."},
            status_code=429,
            headers={"Retry-After": str(retry_after)},
        )
    return await call_next(request)


# --------------------------------------------------------
# Warm-up hook for EasyOCR
# --------------------------------------------------------
@app.on_event("startup")
def warm_up():
    if os.getenv("MOCK_GENERATOR_WARM_EASYOCR", "0") != "1":
        print("[STARTUP] EasyOCR warm-up skipped")
        return
    if ensure_easyocr_weights is None:
        print("[STARTUP] EasyOCR warm-up unavailable; skipping")
        return
    print("[STARTUP] Preloading EasyOCR...")
    try:
        reader = ensure_easyocr_weights(lang="en")

        # Dummy warm-up read on a small black image
        import numpy as np
        dummy = np.zeros((10, 10, 3), dtype=np.uint8)
        _ = reader.readtext(dummy)

        print("[STARTUP] EasyOCR warm-up complete")
    except Exception as e:
        print(f"[STARTUP] Warm-up failed (non-critical): {e}")

# --------------------------------------------------------
# Routes
# --------------------------------------------------------
@app.get("/")
def index():
    """Root endpoint with API info."""
    return {
        "message": "Mock Paper Generator API is running",
        "endpoints": ["/generate", "/healthz"],
    }

@app.post("/generate")
async def generate(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("en"),
    dpi: int = Form(220),
    openai_api_key: Optional[str] = Form(None),
    model_name: str = Form(DEFAULT_MODEL_NAME),
    num_mocks: int = Form(1),
    difficulty: str = Form("same"),
):
    """
    Upload a source exam paper (PDF/DOCX).
    Generates cleaned text and new mock exam papers.
    Returns a zip file containing generated PDFs.
    """
    if Path(file.filename or "").suffix.lower() not in {".pdf", ".docx"}:
        raise HTTPException(status_code=400, detail="Upload a PDF or DOCX file.")
    num_mocks = max(1, min(int(num_mocks), 3))
    dpi = max(120, min(int(dpi), 300))

    # --- create temp dir for this request
    tmpdir = Path(tempfile.mkdtemp(prefix="mockpaper_"))

    # Save uploaded file inside temp dir
    content = await file.read()
    if not content:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        shutil.rmtree(tmpdir, ignore_errors=True)
        mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File is too large. Max size is {mb}MB.")
    tmp_in = tmpdir / f"upload_{file.filename}"
    tmp_in.write_bytes(content)

    # API key resolution (ignore Swagger’s "string")
    if openai_api_key and openai_api_key.strip().lower() != "string":
        key = openai_api_key.strip()
    else:
        key = (os.getenv("OPENAI_API_KEY") or "").strip()

    if not key:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return JSONResponse(
            {"status": "error", "message": "OPENAI_API_KEY missing. Provide via .env or form."},
            status_code=400,
        )
    os.environ["OPENAI_API_KEY"] = key

    # Run pipeline
    try:
        pdf_paths, concat_txt_path, out_dir = await asyncio.to_thread(
            run_pipeline_end_to_end,
            files=[tmp_in],
            language=language,
            dpi=dpi,
            openai_api_key=key,
            model_name=model_name,
            num_mocks=num_mocks,
            difficulty=difficulty,
            out_dir=str(tmpdir),
        )
    except Exception as e:
        print("----- PIPELINE ERROR -----")
        print(traceback.format_exc())
        print("--------------------------")
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {e}")

    if not pdf_paths:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Generation failed: no PDFs produced")

    # --- Bundle all generated PDFs into a zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zipf:
        for p in pdf_paths:
            zipf.write(p, arcname=Path(p).name)
    zip_buffer.seek(0)
    shutil.rmtree(tmpdir, ignore_errors=True)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=mockpapers.zip"},
    )

@app.get("/healthz")
def healthz():
    """Health check endpoint."""
    return {"ok": True}

# -*- coding: utf-8 -*-
"""
Document QA API (with session memory).
- Accepts PDF/DOCX/TXT and PNG/JPEG uploads
- Extracts per-page text; scanned pages and images go through a vision model when configured
- Builds a page-aware retrieval QA pipeline and stores it in memory by session ID
- Answers cite their sources by page, e.g. [p. 3]
"""

import asyncio
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Local development only: Railway injects variables directly and they take precedence.
for env_path in (Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env"):
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)
        break

from src.core.loader import ALLOWED_EXTENSIONS, DocumentError, load_document, sanitize_filename  # noqa: E402
from src.core.qa_chain import get_qa_chain  # noqa: E402
from src.core.sessions import session_store  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("file_chat")

# =========================
# App setup
# =========================
app = FastAPI(title="Document QA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "https://ngyuhang.com").split(",") if o.strip()],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = int(os.getenv("FILE_CHAT_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
MAX_QUESTION_CHARS = int(os.getenv("FILE_CHAT_MAX_QUESTION_CHARS", "1200"))
MAX_API_KEY_CHARS = 256
RATE_BUCKETS: dict[str, list[float]] = {}
RATE_LIMITS = {
    ("POST", "/upload"): (
        int(os.getenv("FILE_CHAT_UPLOAD_RATE_MAX", "4")),
        int(os.getenv("FILE_CHAT_UPLOAD_RATE_WINDOW_SECONDS", "60")),
    ),
    ("POST", "/ask"): (
        int(os.getenv("FILE_CHAT_ASK_RATE_MAX", "30")),
        int(os.getenv("FILE_CHAT_ASK_RATE_WINDOW_SECONDS", "60")),
    ),
}


def _validate_upload(filename: Optional[str], content: bytes) -> None:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Upload a PDF, DOCX, TXT, PNG or JPG file.")
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File is too large. Max size is {mb}MB.")


def _resolve_api_key(form_key: Optional[str]) -> str:
    """Per-request key from the form wins; otherwise the server key. Never stored in os.environ."""
    candidate = (form_key or "").strip()
    if candidate and candidate.lower() != "string":
        if len(candidate) > MAX_API_KEY_CHARS or any(ch.isspace() for ch in candidate):
            raise HTTPException(status_code=400, detail="The API key format is invalid.")
        return candidate
    return (os.getenv("DEEPSEEK_API_KEY") or "").strip()


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
    # Reject oversized bodies before they are parsed (multipart overhead allowance: 256KB).
    if request.method == "POST":
        try:
            length = int(request.headers.get("content-length") or 0)
        except ValueError:
            length = 0
        if length > MAX_UPLOAD_BYTES + 256 * 1024:
            mb = MAX_UPLOAD_BYTES // (1024 * 1024)
            return JSONResponse({"detail": f"File is too large. Max size is {mb}MB."}, status_code=413)
    return await call_next(request)


@app.get("/")
def index():
    """Root endpoint with API info."""
    return {
        "message": "Document QA API is running",
        "endpoints": ["/upload", "/ask", "/healthz"],
    }


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    openai_api_key: Optional[str] = Form(None),
):
    """
    Upload a document (PDF/DOCX/TXT) or an image (PNG/JPG).
    Creates a unique session and stores the QA pipeline in memory.
    """
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    _validate_upload(file.filename, content)
    display_name = sanitize_filename(file.filename)

    key = _resolve_api_key(openai_api_key)
    if not key:
        return JSONResponse(
            {"status": "error", "message": "No API key is configured. Provide a DeepSeek API key."},
            status_code=400,
        )

    try:
        document = await load_document(file.filename, content)
        chain = await asyncio.to_thread(get_qa_chain, document.pages, key)
    except DocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        logger.exception("Upload processing failed for %s", display_name)
        raise HTTPException(status_code=500, detail="Upload failed while processing the file. Please try again.")

    session_id = str(uuid.uuid4())
    session_store.create(session_id, {"chain": chain, "filename": display_name})

    return {
        "session_id": session_id,
        "message": "File uploaded successfully",
        "filename": display_name,
        "kind": document.kind,
        "pages": document.page_count,
        "scanned_pages": document.scanned_pages,
        "vision_pages": document.vision_pages,
        "notices": document.notices,
    }


@app.post("/ask")
async def ask_question(
    session_id: str = Form(..., max_length=64),
    question: str = Form(...),
):
    """
    Ask a question about the uploaded document.
    Returns {"answer", "context", "citations": [{"page", "label", "snippet"}]}.
    """
    entry = session_store.get(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Invalid or expired session ID")
    question = " ".join(question.split()).strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    if len(question) > MAX_QUESTION_CHARS:
        raise HTTPException(status_code=413, detail=f"Question is too long. Max size is {MAX_QUESTION_CHARS} characters.")

    try:
        result = await asyncio.to_thread(entry["chain"], question)
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        logger.warning("QA call failed: %s (status=%s)", type(exc).__name__, status)
        if status == 401:
            raise HTTPException(status_code=401, detail="The API key was rejected by the model provider.")
        raise HTTPException(status_code=502, detail="The answer service is unavailable right now. Please try again.")
    return JSONResponse(result)


@app.get("/healthz")
def healthz():
    """Health check endpoint."""
    return {"ok": True}

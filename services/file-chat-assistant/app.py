# backend/src/app.py
# -*- coding: utf-8 -*-
"""
LangChain QA API (with session memory).
- Accepts PDF/DOCX/TXT uploads
- Extracts + chunks text
- Builds a LangChain QA pipeline
- Stores it in memory by unique session ID
- Allows multi-turn questions per session
"""

import os
import uuid
import traceback
import time
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# --------------------------------------------------------
# Load .env from either backend/.env or repo root
# --------------------------------------------------------
candidates = [
    Path(__file__).resolve().parent.parent / ".env",         # backend/.env
    Path(__file__).resolve().parent.parent.parent / ".env",  # repo root .env
]
for env_path in candidates:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        print(f"[DEBUG] Loaded .env from {env_path}")
        break
else:
    load_dotenv(override=True)  # fallback
print(f"[DEBUG] OPENAI_API_KEY after load: {'FOUND' if os.getenv('OPENAI_API_KEY') else 'MISSING'}")

# --------------------------------------------------------
# Import project modules
# --------------------------------------------------------
try:
    from src.core.loader import load_document
    from src.core.qa_chain import get_qa_chain
    from src.core.sessions import session_store
except Exception as e:
    raise RuntimeError(f"Failed to import core modules: {e}")

# =========================
# App setup
# =========================
app = FastAPI(title="LangChain QA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ngyuhang.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = int(os.getenv("FILE_CHAT_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
MAX_QUESTION_CHARS = int(os.getenv("FILE_CHAT_MAX_QUESTION_CHARS", "1200"))
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
SESSION_TTL_SECONDS = int(os.getenv("FILE_CHAT_SESSION_TTL_SECONDS", "3600"))
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


def _validate_upload(file: UploadFile, content: bytes) -> None:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Upload a PDF, DOCX, or TXT file.")
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File is too large. Max size is {mb}MB.")


def _prune_sessions() -> None:
    now = time.time()
    expired = [
        session_id for session_id, entry in session_store.items()
        if isinstance(entry, dict) and now - entry.get("created_at", now) > SESSION_TTL_SECONDS
    ]
    for session_id in expired:
        del session_store[session_id]


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


@app.get("/")
def index():
    """Root endpoint with API info."""
    return {
        "message": "LangChain QA API is running",
        "endpoints": ["/upload", "/ask", "/healthz"],
    }


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    openai_api_key: Optional[str] = Form(None),
):
    """
    Upload a document (PDF/DOCX/TXT).
    Creates a unique session and stores QA chain in memory.
    """
    try:
        # Read uploaded file
        content = await file.read()
        _validate_upload(file, content)
        _prune_sessions()
        session_id = str(uuid.uuid4())

        # API key resolution
        if openai_api_key and openai_api_key.strip().lower() != "string":
            key = openai_api_key.strip()
        else:
            key = (os.getenv("OPENAI_API_KEY") or "").strip()

        if not key:
            return JSONResponse(
                {"status": "error", "message": "OPENAI_API_KEY missing. Provide via .env or form."},
                status_code=400,
            )
        os.environ["OPENAI_API_KEY"] = key

        # Load document into text
        text = load_document(file.filename, content)

        # Build QA chain
        chain = await asyncio.to_thread(get_qa_chain, text)

        # Store chain in memory by session ID
        session_store[session_id] = {"chain": chain, "created_at": time.time(), "filename": file.filename}

        return {"session_id": session_id, "message": "File uploaded successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print("----- UPLOAD ERROR -----")
        print(traceback.format_exc())
        print("------------------------")
        raise HTTPException(status_code=500, detail=f"Upload error: {e}")


@app.post("/ask")
async def ask_question(
    session_id: str = Form(...),
    question: str = Form(...),
):
    """
    Ask a question about the uploaded document.
    Uses the QA chain stored in memory per session.
    """
    _prune_sessions()
    entry = session_store.get(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Invalid or expired session ID")
    question = " ".join(question.split()).strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    if len(question) > MAX_QUESTION_CHARS:
        raise HTTPException(status_code=413, detail=f"Question is too long. Max size is {MAX_QUESTION_CHARS} characters.")

    chain = entry["chain"] if isinstance(entry, dict) else entry
    try:
        # Only pass the question — session_id is tracked in session_store
        answer = await asyncio.to_thread(chain, question)
        return JSONResponse(answer)
    except Exception as e:
        print("----- QA ERROR -----")
        print(traceback.format_exc())
        print("--------------------")
        raise HTTPException(status_code=500, detail=f"QA error: {e}")


@app.get("/healthz")
def healthz():
    """Health check endpoint."""
    return {"ok": True}

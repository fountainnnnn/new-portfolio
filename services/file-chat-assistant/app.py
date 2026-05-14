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
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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
print("[DEBUG] OPENAI_API_KEY after load: FOUND")

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
        chain = get_qa_chain(text)

        # Store chain in memory by session ID
        session_store[session_id] = chain

        return {"session_id": session_id, "message": "File uploaded successfully"}
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
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Invalid session ID")

    chain = session_store[session_id]
    try:
        # Only pass the question — session_id is tracked in session_store
        answer = chain(question)
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

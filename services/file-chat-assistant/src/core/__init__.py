# -*- coding: utf-8 -*-
"""
Core modules for the document QA API.

- loader: PDF/DOCX/TXT/PNG/JPEG -> per-page text (vision for scanned pages)
- vision: vision-model provider resolution and page transcription
- qa_chain: page-aware chunking, retrieval and cited answers
- sessions: in-memory TTL + capped session store
"""

from .loader import load_document, DocumentError, LoadedDocument, sanitize_filename
from .qa_chain import get_qa_chain
from .sessions import session_store, SessionStore

__all__ = [
    "load_document",
    "DocumentError",
    "LoadedDocument",
    "sanitize_filename",
    "get_qa_chain",
    "session_store",
    "SessionStore",
]

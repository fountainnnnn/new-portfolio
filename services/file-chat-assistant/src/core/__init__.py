# backend/src/core/__init__.py
"""
Core module exports for LangChain QA API.

- Document loading (PDF/DOCX/TXT → text)
- QA chain construction (LangChain pipeline)
- Session management (in-memory store)
"""

# ---- Document loading ----
from .loader import (
    load_document,
)

# ---- QA chain ----
from .qa_chain import (
    get_qa_chain,
)

# ---- Session management ----
from .sessions import (
    session_store,
)

__all__ = [
    # loader
    "load_document",
    # qa_chain
    "get_qa_chain",
    # sessions
    "session_store",
]

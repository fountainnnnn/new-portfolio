# backend/src/core/sessions.py
# -*- coding: utf-8 -*-
"""
Session management for LangChain QA API.
- Stores QA chains per unique session ID
- Session ends when user closes the browser tab (memory only, no persistence)
"""

from typing import Any, Dict

# In-memory session store
# { session_id: <chain> }
session_store: Dict[str, Any] = {}


def create_session(session_id: str, chain: Any) -> None:
    """Register a new session with its QA chain."""
    session_store[session_id] = chain


def get_session(session_id: str) -> Any:
    """Retrieve a QA chain for a given session_id."""
    return session_store.get(session_id)


def delete_session(session_id: str) -> None:
    """Delete a session explicitly (optional cleanup)."""
    if session_id in session_store:
        del session_store[session_id]

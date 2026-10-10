# -*- coding: utf-8 -*-
"""
In-memory session store for the document QA API.

- Each session holds the QA callable for one uploaded document.
- Sessions expire after a period of inactivity (TTL) and the store is capped,
  evicting the least recently used session when full.
- Memory only; nothing is persisted.
"""

import os
import threading
import time
from collections import OrderedDict
from typing import Any, Callable, Optional

DEFAULT_TTL_SECONDS = int(os.getenv("FILE_CHAT_SESSION_TTL_SECONDS", "3600"))
DEFAULT_MAX_SESSIONS = int(os.getenv("FILE_CHAT_MAX_SESSIONS", "50"))


class SessionStore:
    """Thread-safe TTL + LRU-capped session store."""

    def __init__(
        self,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        max_sessions: int = DEFAULT_MAX_SESSIONS,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.ttl_seconds = max(1, int(ttl_seconds))
        self.max_sessions = max(1, int(max_sessions))
        self._clock = clock
        self._lock = threading.Lock()
        self._items: "OrderedDict[str, dict]" = OrderedDict()

    def _prune_locked(self) -> None:
        now = self._clock()
        expired = [
            sid for sid, entry in self._items.items()
            if now - entry["last_used"] > self.ttl_seconds
        ]
        for sid in expired:
            del self._items[sid]

    def prune(self) -> None:
        with self._lock:
            self._prune_locked()

    def create(self, session_id: str, data: dict) -> None:
        with self._lock:
            self._prune_locked()
            while len(self._items) >= self.max_sessions:
                self._items.popitem(last=False)  # evict least recently used
            now = self._clock()
            self._items[session_id] = {**data, "created_at": now, "last_used": now}

    def get(self, session_id: str) -> Optional[dict]:
        with self._lock:
            self._prune_locked()
            entry = self._items.get(session_id)
            if entry is None:
                return None
            entry["last_used"] = self._clock()
            self._items.move_to_end(session_id)
            return entry

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._items.pop(session_id, None)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)

    def __contains__(self, session_id: object) -> bool:
        with self._lock:
            return session_id in self._items


session_store = SessionStore()


def create_session(session_id: str, data: Any) -> None:
    session_store.create(session_id, data if isinstance(data, dict) else {"chain": data})


def get_session(session_id: str) -> Optional[dict]:
    return session_store.get(session_id)


def delete_session(session_id: str) -> None:
    session_store.delete(session_id)

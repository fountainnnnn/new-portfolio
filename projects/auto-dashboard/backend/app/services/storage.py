from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
import io
import json
import logging
import os
from pathlib import Path
import sqlite3
import threading
from typing import Any
from uuid import uuid4

import pandas as pd

logger = logging.getLogger(__name__)

# Size of the process-local dataset/dashboard caches. Each entry keeps a DataFrame
# reference in memory, so the cap stays small. Tune via AUTODASH_RECORD_CACHE_SIZE
# if a deployment has many concurrent sessions on the same worker.
_RECORD_CACHE_SIZE = int(os.environ.get("AUTODASH_RECORD_CACHE_SIZE", "16"))

from app.models.schemas import ChatSessionRequest, ChatSessionResponse, DashboardResponse, DatasetProfile


@dataclass
class DatasetRecord:
    dataset_id: str
    filename: str
    dataframe: pd.DataFrame
    profile: DatasetProfile
    created_at: datetime


@dataclass
class DashboardRecord:
    dashboard_id: str
    dataset_id: str
    dashboard: DashboardResponse
    created_at: datetime
    metadata: dict[str, Any]


class SQLiteStorage:
    def __init__(self, database_path: str | Path | None = None) -> None:
        default_path = Path(__file__).resolve().parents[2] / "data" / "autodash.sqlite"
        self.database_path = Path(database_path or os.environ.get("AUTODASH_DB_PATH", default_path))
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        # Process-local LRU caches. The big win is the dataset cache: deserialising a
        # 20k-row DataFrame from the split-JSON column costs hundreds of milliseconds to
        # several seconds per request, and /dashboard/generate, /refine, /filter all hit
        # get_dataset back-to-back. Caching avoids repeating that work.
        self._dataset_cache: OrderedDict[str, DatasetRecord] = OrderedDict()
        self._dashboard_cache: OrderedDict[str, DashboardRecord] = OrderedDict()
        self._cache_lock = threading.Lock()
        self._initialize()

    # -- Cache helpers -------------------------------------------------------
    def _cache_get(self, cache: OrderedDict, key: str):
        with self._cache_lock:
            value = cache.get(key)
            if value is not None:
                cache.move_to_end(key)
            return value

    def _cache_put(self, cache: OrderedDict, key: str, value) -> None:
        with self._cache_lock:
            cache[key] = value
            cache.move_to_end(key)
            while len(cache) > _RECORD_CACHE_SIZE:
                cache.popitem(last=False)

    def _cache_invalidate(self, cache: OrderedDict, key: str) -> None:
        with self._cache_lock:
            cache.pop(key, None)

    def save_dataset(self, filename: str, dataframe: pd.DataFrame, profile: DatasetProfile) -> DatasetRecord:
        dataset_id = str(uuid4())
        created_at = datetime.now(timezone.utc)
        record = DatasetRecord(
            dataset_id=dataset_id,
            filename=filename,
            dataframe=dataframe,
            profile=profile,
            created_at=created_at,
        )
        # Stash in the cache BEFORE hitting disk: /dashboard/generate is normally invoked
        # immediately after /upload and would otherwise re-read and re-parse the whole
        # DataFrame we already have right here in memory.
        self._cache_put(self._dataset_cache, dataset_id, record)
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO datasets (dataset_id, filename, dataframe_json, profile_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record.dataset_id,
                    record.filename,
                    self._dataframe_to_json(record.dataframe),
                    self._json_dumps(record.profile.model_dump(mode="json")),
                    created_at.isoformat(),
                ),
            )
        return record

    def get_dataset(self, dataset_id: str) -> DatasetRecord | None:
        cached = self._cache_get(self._dataset_cache, dataset_id)
        if cached is not None:
            return cached
        with self._connect() as connection:
            row = connection.execute(
                "SELECT dataset_id, filename, dataframe_json, profile_json, created_at FROM datasets WHERE dataset_id = ?",
                (dataset_id,),
            ).fetchone()
        if not row:
            return None
        profile = DatasetProfile.model_validate(json.loads(row["profile_json"]))
        dataframe = self._dataframe_from_json(row["dataframe_json"], profile)
        record = DatasetRecord(
            dataset_id=row["dataset_id"],
            filename=row["filename"],
            dataframe=dataframe,
            profile=profile,
            created_at=datetime.fromisoformat(row["created_at"]),
        )
        self._cache_put(self._dataset_cache, dataset_id, record)
        return record

    def save_dashboard(
        self,
        dataset_id: str,
        dashboard: DashboardResponse,
        metadata: dict[str, Any] | None = None,
    ) -> DashboardRecord:
        created_at = datetime.now(timezone.utc)
        record = DashboardRecord(
            dashboard_id=dashboard.dashboard_id,
            dataset_id=dataset_id,
            dashboard=dashboard,
            created_at=created_at,
            metadata=metadata or {},
        )
        # Populate the dashboard cache on write so the immediate round-trip
        # (save -> caller returns response -> next request on same dashboard) is instant.
        self._cache_put(self._dashboard_cache, record.dashboard_id, record)
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO dashboards (dashboard_id, dataset_id, dashboard_json, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record.dashboard_id,
                    record.dataset_id,
                    self._json_dumps(record.dashboard.model_dump(mode="json")),
                    self._json_dumps(record.metadata),
                    created_at.isoformat(),
                ),
            )
        return record

    def get_dashboard(self, dashboard_id: str) -> DashboardRecord | None:
        cached = self._cache_get(self._dashboard_cache, dashboard_id)
        if cached is not None:
            return cached
        with self._connect() as connection:
            row = connection.execute(
                "SELECT dashboard_id, dataset_id, dashboard_json, metadata_json, created_at FROM dashboards WHERE dashboard_id = ?",
                (dashboard_id,),
            ).fetchone()
        if not row:
            return None
        record = DashboardRecord(
            dashboard_id=row["dashboard_id"],
            dataset_id=row["dataset_id"],
            dashboard=DashboardResponse.model_validate(json.loads(row["dashboard_json"])),
            created_at=datetime.fromisoformat(row["created_at"]),
            metadata=json.loads(row["metadata_json"] or "{}"),
        )
        self._cache_put(self._dashboard_cache, dashboard_id, record)
        return record

    def save_chat_session(self, session: ChatSessionRequest) -> ChatSessionResponse:
        now = datetime.now(timezone.utc)
        updated_at = session.updated_at or int(now.timestamp() * 1000)
        with self._lock, self._connect() as connection:
            existing = connection.execute(
                "SELECT created_at FROM chat_sessions WHERE session_id = ?",
                (session.session_id,),
            ).fetchone()
            created_at = existing["created_at"] if existing else now.isoformat()
            connection.execute(
                """
                INSERT OR REPLACE INTO chat_sessions (
                    session_id, title, dataset_json, dashboard_json, prompt, messages_json,
                    selected_theme_id, settings_json, updated_at, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session.session_id,
                    session.title,
                    self._json_dumps(session.dataset.model_dump(mode="json")) if session.dataset else None,
                    self._json_dumps(session.dashboard.model_dump(mode="json")) if session.dashboard else None,
                    session.prompt,
                    self._json_dumps([message.model_dump(mode="json") for message in session.messages]),
                    session.selected_theme_id,
                    self._json_dumps(session.settings),
                    updated_at,
                    created_at,
                ),
            )
        payload = session.model_dump(mode="json")
        payload["updated_at"] = updated_at
        payload["created_at"] = created_at
        return ChatSessionResponse(**payload)

    def list_chat_sessions(self) -> list[ChatSessionResponse]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT session_id, title, dataset_json, dashboard_json, prompt, messages_json,
                    selected_theme_id, settings_json, updated_at, created_at
                FROM chat_sessions
                ORDER BY updated_at DESC
                """
            ).fetchall()
        return [self._chat_session_from_row(row) for row in rows]

    def get_chat_session(self, session_id: str) -> ChatSessionResponse | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT session_id, title, dataset_json, dashboard_json, prompt, messages_json,
                    selected_theme_id, settings_json, updated_at, created_at
                FROM chat_sessions
                WHERE session_id = ?
                """,
                (session_id,),
            ).fetchone()
        return self._chat_session_from_row(row) if row else None

    def delete_chat_session(self, session_id: str) -> bool:
        with self._lock, self._connect() as connection:
            cursor = connection.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
            return cursor.rowcount > 0

    def get_chat_session_by_dashboard_id(self, dashboard_id: str) -> ChatSessionResponse | None:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT session_id, title, dataset_json, dashboard_json, prompt, messages_json,
                    selected_theme_id, settings_json, updated_at, created_at
                FROM chat_sessions
                WHERE dashboard_json IS NOT NULL
                ORDER BY updated_at DESC
                """
            ).fetchall()

        for row in rows:
            session = self._chat_session_from_row(row)
            if session.dashboard and session.dashboard.dashboard_id == dashboard_id:
                return session
        return None

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS datasets (
                    dataset_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    dataframe_json TEXT NOT NULL,
                    profile_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS dashboards (
                    dashboard_id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL,
                    dashboard_json TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(dataset_id) REFERENCES datasets(dataset_id)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    session_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    dataset_json TEXT,
                    dashboard_json TEXT,
                    prompt TEXT NOT NULL,
                    messages_json TEXT NOT NULL,
                    selected_theme_id TEXT NOT NULL,
                    settings_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )

    def _chat_session_from_row(self, row: sqlite3.Row) -> ChatSessionResponse:
        return ChatSessionResponse(
            session_id=row["session_id"],
            title=row["title"],
            dataset=json.loads(row["dataset_json"]) if row["dataset_json"] else None,
            dashboard=json.loads(row["dashboard_json"]) if row["dashboard_json"] else None,
            prompt=row["prompt"],
            messages=json.loads(row["messages_json"] or "[]"),
            selected_theme_id=row["selected_theme_id"],
            settings=json.loads(row["settings_json"] or "{}"),
            updated_at=row["updated_at"],
            created_at=row["created_at"],
        )

    def _dataframe_to_json(self, dataframe: pd.DataFrame) -> str:
        return dataframe.to_json(orient="split", date_format="iso")

    def _dataframe_from_json(self, dataframe_json: str, profile: DatasetProfile) -> pd.DataFrame:
        dataframe = pd.read_json(io.StringIO(dataframe_json), orient="split")
        for column in profile.datetime_columns:
            if column in dataframe.columns:
                dataframe[column] = pd.to_datetime(dataframe[column], errors="coerce")
        for column in profile.numeric_columns:
            if column in dataframe.columns:
                dataframe[column] = pd.to_numeric(dataframe[column], errors="coerce")
        return dataframe

    def _json_dumps(self, value: Any) -> str:
        return json.dumps(value, ensure_ascii=False)


storage = SQLiteStorage()

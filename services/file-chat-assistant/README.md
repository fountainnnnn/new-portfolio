---
title: File Chat Assistant
emoji: 🏃
colorFrom: blue
colorTo: pink
sdk: docker
pinned: false
license: mit
---

# File Chat Assistant API

FastAPI service behind the portfolio's Document Q&A page (`/file-chat-assistant/`).
Upload a document or an image of a page, then ask questions about it. Answers come
from DeepSeek (OpenAI-compatible SDK) and cite the pages they used, e.g. `[p. 3]`.

The public portfolio proxies `/api/file-chat-assistant/*` to this service over Railway
private networking (see `/RAILWAY.md`). The service itself only allows CORS from
`https://ngyuhang.com`.

## Features

- **Uploads:** PDF, DOCX, TXT, PNG, JPG/JPEG. The extension must match the file's
  magic bytes; size is capped (`FILE_CHAT_MAX_UPLOAD_BYTES`). Files are parsed in memory,
  and the filename is only used for its extension and a sanitized display name.
- **Scanned pages and images:** PDF pages with little or no text layer
  (`VISION_MIN_TEXT_CHARS`) and uploaded images are rendered and transcribed by a vision
  model (`src/core/vision.py`). Calls run with bounded concurrency, a per-page timeout and
  a page cap. If no vision provider is configured, the upload still works for pages that
  have text and the response explains which pages could not be read. Image-only uploads
  are rejected with a clear message.
- **Page-cited answers:** page numbers stay in chunk metadata through loading, splitting and
  retrieval. The model is told to cite the labels it sees (`[p. 3]`, or `[part 2]` for
  DOCX/TXT, which have no pages). `/ask` returns a structured `citations` list, which the
  frontend shows under each answer.
- **Keys:** an optional per-request key from the upload form is passed explicitly to the
  client. It is never written to `os.environ` and never logged.
- **Sessions:** in memory only, expire after `FILE_CHAT_SESSION_TTL_SECONDS` of inactivity,
  capped at `FILE_CHAT_MAX_SESSIONS` (least recently used evicted).
- **Rate limits:** per client IP on `/upload` and `/ask` (plus the portfolio proxy limits).

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/healthz` | `{"ok": true}` (Railway healthcheck) |
| POST | `/upload` | multipart: `file`, optional `openai_api_key` (a DeepSeek key). Returns `session_id`, `message`, `filename`, `kind`, `pages`, `scanned_pages`, `vision_pages`, `notices` |
| POST | `/ask` | form: `session_id`, `question`. Returns `answer`, `context`, `citations: [{page, label, snippet}]` (`page` is `null` for DOCX/TXT) |

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `7860` | Listen port |
| `DEEPSEEK_API_KEY` | | Chat model key (used when the form key is empty) |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | |
| `VISION_API_KEY` / `VISION_BASE_URL` / `VISION_MODEL` | | Explicit vision provider (any OpenAI-compatible endpoint; model default `gpt-4o-mini`) |
| `OPENROUTER_API_KEY` | | Used if no `VISION_API_KEY`: OpenRouter, `qwen/qwen2.5-vl-72b-instruct` |
| `OPENAI_API_KEY` | | Used if neither of the above: OpenAI, `gpt-4o-mini` |
| `VISION_MAX_PAGES` | `10` | Max scanned pages transcribed per upload |
| `VISION_MAX_CONCURRENCY` | `3` | Parallel vision calls |
| `VISION_TIMEOUT_SECONDS` | `45` | Per-page timeout |
| `VISION_MIN_TEXT_CHARS` | `25` | Pages with less extracted text count as scanned |
| `FILE_CHAT_MAX_UPLOAD_BYTES` | `8388608` | Upload size cap |
| `FILE_CHAT_MAX_TEXT_CHARS` | `180000` | Text kept per document |
| `FILE_CHAT_MAX_PDF_PAGES` | `300` | PDF pages read |
| `FILE_CHAT_MAX_QUESTION_CHARS` | `1200` | |
| `FILE_CHAT_LLM_TIMEOUT_SECONDS` | `60` | Chat call timeout |
| `FILE_CHAT_SESSION_TTL_SECONDS` | `3600` | Idle session expiry |
| `FILE_CHAT_MAX_SESSIONS` | `50` | Session cap |
| `FILE_CHAT_UPLOAD_RATE_MAX` / `_WINDOW_SECONDS` | `4` / `60` | |
| `FILE_CHAT_ASK_RATE_MAX` / `_WINDOW_SECONDS` | `30` / `60` | |

Vision is optional. Without any vision key, text PDFs, DOCX and TXT work as before.

## Run locally

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
DEEPSEEK_API_KEY=... uvicorn app:app --port 8013
curl localhost:8013/healthz
```

The portfolio dev server proxies `/api/file-chat-assistant` to `http://127.0.0.1:8013` by default.

## Tests

Tests mock the chat and vision clients; no network calls are made.

```bash
pip install pytest httpx
python -m pytest -q
```

## Deploy

Railway builds `Dockerfile` (see `railway.json`, watch pattern `/services/file-chat-assistant/**`,
healthcheck `/healthz`). The `tests/` folder is excluded from the image.

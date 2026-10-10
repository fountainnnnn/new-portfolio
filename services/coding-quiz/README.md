---
title: Coding Quiz
emoji: 🐨
colorFrom: blue
colorTo: yellow
sdk: docker
pinned: false
license: mit
---

# Coding Quiz API

FastAPI service behind the portfolio's AI Generated Coding Quiz page (`/coding-quiz/`).
It generates JavaScript, Python or C++ questions (multiple choice, fill-in-the-code,
drag-and-drop ordering) with DeepSeek through the OpenAI SDK, keeps answers server-side,
and checks submissions against them.

The public portfolio proxies `/api/coding-quiz/*` to this service over Railway private
networking (see `/RAILWAY.md`). CORS only allows `https://ngyuhang.com`.

## Features

- **Generation:** questions are requested in parallel batches (`CODING_QUIZ_BATCH_SIZE`,
  `CODING_QUIZ_MAX_PARALLEL_CALLS`, `CODING_QUIZ_DEEPSEEK_TIMEOUT_SECONDS`), validated, topped
  up (`CODING_QUIZ_RETRY_ATTEMPTS`) and padded with local fallback questions if the model falls short.
- **Hints:** each question gets one hint and a topic in the same LLM call. Hints that are
  missing, too long, or contain the answer are replaced with a generic one. Hints stay on
  the server and are only returned by `POST /hint`, which records that a hint was used.
- **Answer + explanation after answering:** `/check_answer` returns the correct answer and
  the explanation in its response. No other endpoint returns them. The frontend shows the
  explanation when you get it right, or offers "Show answer and explanation" after a
  wrong attempt.
- **End-of-quiz review:** `/end_quiz` returns the first-try score, hints used, per-topic and
  per-type breakdowns, weak areas and a per-question review. It is built from recorded
  results, with no extra LLM call.
- **Limits:** per-IP rate limits, request body cap, answer size cap, session TTL and
  session count cap.

## Endpoints

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/healthz` | | `{"ok": true}` |
| POST | `/generate_questions` | `{language, topic, difficulty, n}` | `{status, session_id, questions: [{question_id, type, question, options, code_with_blanks, topic, has_hint}]}` |
| POST | `/hint` | `{session_id, question_id}` | `{status, question_id, hint, hints_used}` |
| POST | `/check_answer` | `{session_id, question_id, user_answer}` | `{status, correct, expected, explanation, correct_answer, attempts, first_try, hint_used}` |
| POST | `/end_quiz` | `?session_id=` or `{session_id}` | `{status, message, score: {wrong_first_try, total_questions, correct_first_try, answered, unanswered, percent}, hints_used, by_topic, by_type, weak_areas, review}` |

`topic`, `has_hint`, `correct_answer`, `attempts`, `first_try`, `hint_used` and everything in
`/end_quiz` beyond `score.wrong_first_try` / `score.total_questions` are new. Existing
fields are unchanged.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `7860` | Listen port |
| `DEEPSEEK_API_KEY` | | Required for generation |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | |
| `CODING_QUIZ_BATCH_SIZE` | `5` | Questions per LLM call |
| `CODING_QUIZ_MAX_PARALLEL_CALLS` | `8` | |
| `CODING_QUIZ_DEEPSEEK_TIMEOUT_SECONDS` | `20` | Per call |
| `CODING_QUIZ_RETRY_ATTEMPTS` | `0` | Top-up rounds for dropped questions |
| `CODING_QUIZ_SESSION_TTL_SECONDS` | `3600` | |
| `CODING_QUIZ_MAX_SESSIONS` | `500` | Oldest evicted beyond this |
| `CODING_QUIZ_MAX_BODY_BYTES` | `65536` | POST body cap |
| `CODING_QUIZ_MAX_ANSWER_CHARS` | `4000` | Total characters in one answer |
| `CODING_QUIZ_MAX_ANSWER_ITEMS` | `50` | Parts in a list answer |
| `CODING_QUIZ_WEAK_AREA_THRESHOLD` | `0.6` | First-try accuracy below this marks a weak topic |
| `CODING_QUIZ_GENERATE_RATE_MAX` / `_WINDOW_SECONDS` | `6` / `60` | |
| `CODING_QUIZ_ANSWER_RATE_MAX` / `_WINDOW_SECONDS` | `120` / `60` | |
| `CODING_QUIZ_HINT_RATE_MAX` / `_WINDOW_SECONDS` | `60` / `60` | |

## Run locally

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
DEEPSEEK_API_KEY=... uvicorn app:app --port 8014
curl localhost:8014/healthz
```

The portfolio dev server proxies `/api/coding-quiz` to `http://127.0.0.1:8014` by default.

## Tests

The LLM client is mocked; no network calls are made.

```bash
pip install pytest httpx
python -m pytest -q
```

## Deploy

Railway builds `Dockerfile` (see `railway.json`, watch pattern `/services/coding-quiz/**`,
healthcheck `/healthz`). The `tests/` folder is excluded from the image.

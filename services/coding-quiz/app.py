# backend/src/app.py

import os, uuid, logging, json, re, time
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.status import HTTP_422_UNPROCESSABLE_ENTITY
from dotenv import load_dotenv

from src.core.schemas import (
    GenerateRequest,
    AnswerRequest,
    HintRequest,
    GenerateResponse,
    CheckAnswerResponse,
    HintResponse,
    EndQuizResponse,
    ID_MAX_LENGTH,
)
from src.core.openai_qg import generate_questions

# ------------------------------------------------------------
# Setup
# ------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("quiz")

app = FastAPI(title="Multi-Language Quiz API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ngyuhang.com"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# In-memory store for answers (never sent to the client until answered):
# { session_id: {"created_at": float, "questions": { qid: {...} } } }
SESSION_STORE: dict[str, dict[str, dict]] = {}
SESSION_TTL_SECONDS = int(os.getenv("CODING_QUIZ_SESSION_TTL_SECONDS", "3600"))
MAX_SESSIONS = int(os.getenv("CODING_QUIZ_MAX_SESSIONS", "500"))
MAX_BODY_BYTES = int(os.getenv("CODING_QUIZ_MAX_BODY_BYTES", str(64 * 1024)))
WEAK_AREA_THRESHOLD = float(os.getenv("CODING_QUIZ_WEAK_AREA_THRESHOLD", "0.6"))
RATE_BUCKETS: dict[str, list[float]] = {}
RATE_LIMITS = {
    ("POST", "/generate_questions"): (
        int(os.getenv("CODING_QUIZ_GENERATE_RATE_MAX", "6")),
        int(os.getenv("CODING_QUIZ_GENERATE_RATE_WINDOW_SECONDS", "60")),
    ),
    ("POST", "/check_answer"): (
        int(os.getenv("CODING_QUIZ_ANSWER_RATE_MAX", "120")),
        int(os.getenv("CODING_QUIZ_ANSWER_RATE_WINDOW_SECONDS", "60")),
    ),
    ("POST", "/hint"): (
        int(os.getenv("CODING_QUIZ_HINT_RATE_MAX", "60")),
        int(os.getenv("CODING_QUIZ_HINT_RATE_WINDOW_SECONDS", "60")),
    ),
}


def prune_sessions() -> None:
    now = time.time()
    expired = [
        sid for sid, entry in SESSION_STORE.items()
        if now - float(entry.get("created_at", now)) > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        del SESSION_STORE[sid]


def make_room_for_session() -> None:
    """Cap memory: evict the oldest sessions when the store is full."""
    while len(SESSION_STORE) >= max(1, MAX_SESSIONS):
        oldest = min(SESSION_STORE, key=lambda sid: SESSION_STORE[sid].get("created_at", 0))
        del SESSION_STORE[oldest]


def client_id_from_request(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded_for or (request.client.host if request.client else "local")


def allow_rate(request: Request) -> tuple[bool, int]:
    limit = RATE_LIMITS.get((request.method, request.url.path))
    if not limit:
        return True, 0

    max_requests, window_seconds = limit
    now = time.time()
    bucket_key = f"{request.method}:{request.url.path}:{client_id_from_request(request)}"
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
    allowed, retry_after = allow_rate(request)
    if not allowed:
        return JSONResponse(
            {"status": "error", "message": "Rate limit exceeded. Try again shortly."},
            status_code=429,
            headers={"Retry-After": str(retry_after)},
        )
    if request.method == "POST":
        try:
            length = int(request.headers.get("content-length") or 0)
        except ValueError:
            length = 0
        if length > MAX_BODY_BYTES:
            return JSONResponse(
                {"status": "error", "message": "Request body is too large."},
                status_code=413,
            )
    return await call_next(request)

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def normalize(s: str) -> str:
    """Lowercase and collapse whitespace for fair comparison."""
    return " ".join(str(s).strip().lower().split())

def normalize_answer(expected, user):
    """Coerce both expected and user answers to normalized lists of strings."""

    def _to_list(val):
        if isinstance(val, list):
            return [str(x).strip(" '\"\n") for x in val]
        if isinstance(val, str):
            s = val.strip()
            if s.startswith("[") and s.endswith("]"):
                try:
                    arr = json.loads(s.replace("'", '"'))
                    if isinstance(arr, list):
                        return [str(x).strip(" '\"\n") for x in arr]
                except Exception:
                    return [x.strip(" '\"\n") for x in re.split(r"[,\n]", s[1:-1]) if x.strip()]
            if "," in s or "\n" in s:
                return [x.strip(" '\"\n") for x in re.split(r"[,\n]", s) if x.strip()]
            return [s.strip(" '\"\n")]
        return [str(val).strip(" '\"\n")]

    expected_list = _to_list(expected)
    user_list = _to_list(user)

    expected_norm = [normalize(x) for x in expected_list]
    user_norm = [normalize(x) for x in user_list]
    return expected_norm, user_norm


def get_question_record(session_id: str, question_id: str) -> dict:
    session = SESSION_STORE.get(session_id)
    record = session.get("questions", {}).get(question_id) if session else None
    if not record:
        raise HTTPException(status_code=404, detail="Question not found or expired")
    return record


def _group_summary(records: list[dict], key: str) -> list[dict]:
    groups: dict[str, dict] = {}
    for record in records:
        name = record.get(key) or "general"
        group = groups.setdefault(name, {"topic": name, "total": 0, "answered": 0, "correct_first_try": 0, "hints_used": 0})
        group["total"] += 1
        group["answered"] += 1 if record["attempts"] > 0 else 0
        group["correct_first_try"] += 1 if record["attempts"] > 0 and not record["first_wrong"] else 0
        group["hints_used"] += 1 if record["hint_used"] else 0
    for group in groups.values():
        # Accuracy over answered questions only; skipped questions are not evidence of weakness.
        group["accuracy"] = round(group["correct_first_try"] / group["answered"], 2) if group["answered"] else 0.0
    return sorted(groups.values(), key=lambda g: (g["accuracy"], -g["total"], g["topic"]))


def build_quiz_summary(questions: dict[str, dict]) -> dict:
    """Score + per-topic review derived from recorded results (no LLM call)."""
    records = list(questions.values())
    total = len(records)
    answered = sum(1 for r in records if r["attempts"] > 0)
    correct_first_try = sum(1 for r in records if r["attempts"] > 0 and not r["first_wrong"])
    wrong_first_try = sum(1 for r in records if r["first_wrong"])
    hints_used = sum(1 for r in records if r["hint_used"])

    by_topic = _group_summary(records, "topic")
    by_type = _group_summary(records, "type")
    weak_areas = [
        g["topic"] for g in by_topic
        if g["answered"] and (g["accuracy"] < WEAK_AREA_THRESHOLD or g["hints_used"] * 2 >= g["total"])
    ]
    review = [
        {
            "question_id": qid,
            "question": r.get("question", ""),
            "topic": r.get("topic") or "general",
            "type": r.get("type") or "",
            "answered": r["attempts"] > 0,
            "correct": bool(r.get("correct")),
            "correct_first_try": r["attempts"] > 0 and not r["first_wrong"],
            "attempts": r["attempts"],
            "hint_used": r["hint_used"],
        }
        for qid, r in questions.items()
    ]
    return {
        "score": {
            "wrong_first_try": wrong_first_try,
            "total_questions": total,
            "correct_first_try": correct_first_try,
            "answered": answered,
            "unanswered": total - answered,
            "percent": round(100 * correct_first_try / total, 1) if total else 0.0,
        },
        "hints_used": hints_used,
        "by_topic": by_topic,
        "by_type": by_type,
        "weak_areas": weak_areas,
        "review": review,
    }

# ------------------------------------------------------------
# Exception handlers
# ------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"loc": list(err.get("loc", [])), "msg": err.get("msg", "invalid"), "type": err.get("type", "")}
        for err in exc.errors()
    ]
    logger.info(f"Validation error on {request.url.path}: {[e['msg'] for e in errors]}")
    return JSONResponse(
        status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "error", "detail": errors},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {type(exc).__name__}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal server error."},
    )

# ------------------------------------------------------------
# Routes
# ------------------------------------------------------------
@app.post("/generate_questions", response_model=GenerateResponse)
async def generate_questions_route(req: GenerateRequest):
    prune_sessions()
    try:
        result = await generate_questions(
            topic=req.topic,
            difficulty=req.difficulty,
            n=req.n,
            language=req.language,
        )
    except RuntimeError as e:
        logger.error(f"RuntimeError: {e}")
        return JSONResponse(
            {"status": "error", "message": "DeepSeek API key is missing."},
            status_code=503,
        )
    except HTTPException:
        raise
    except Exception:
        logger.error("Exception during generate_questions", exc_info=True)
        raise HTTPException(status_code=500, detail="Generation failed. Please try again.")

    make_room_for_session()
    session_id = str(uuid.uuid4())
    SESSION_STORE[session_id] = {"created_at": time.time(), "questions": {}}

    for item in result["secret"]:
        SESSION_STORE[session_id]["questions"][item["question_id"]] = {
            "answer": item["answer"],
            "explanation": item["explanation"],
            "hint": item.get("hint", ""),
            "topic": item.get("topic", "general"),
            "type": item.get("type", ""),
            "question": item.get("question", ""),
            "language": req.language,
            "attempts": 0,
            "first_wrong": False,
            "correct": False,
            "hint_used": False,
        }

    logger.info(f"Session created with {len(SESSION_STORE[session_id]['questions'])} questions")

    # Only the safe view leaves the server: no answers, explanations or hints.
    return {"status": "ok", "session_id": session_id, "questions": result["safe"]}

@app.post("/hint", response_model=HintResponse)
def get_hint(req: HintRequest):
    """Reveal the stored hint for one question and record that it was used."""
    prune_sessions()
    record = get_question_record(req.session_id, req.question_id)
    record["hint_used"] = True
    hints_used = sum(1 for q in SESSION_STORE[req.session_id]["questions"].values() if q["hint_used"])
    return {
        "status": "ok",
        "question_id": req.question_id,
        "hint": record.get("hint") or "Re-read the question and trace the code one line at a time.",
        "hints_used": hints_used,
    }

@app.post("/check_answer", response_model=CheckAnswerResponse)
def check_answer(req: AnswerRequest):
    prune_sessions()
    record = get_question_record(req.session_id, req.question_id)

    expected = record["answer"]
    record["attempts"] += 1

    expected_norm, user_norm = normalize_answer(expected, req.user_answer)
    correct = user_norm == expected_norm

    if record["attempts"] == 1 and not correct:
        record["first_wrong"] = True
    if correct:
        record["correct"] = True

    # The answer and explanation are only ever returned here, i.e. after the user has answered.
    return {
        "status": "ok",
        "correct": correct,
        "expected": expected,
        "explanation": record["explanation"] or "",
        "correct_answer": expected,
        "attempts": record["attempts"],
        "first_try": record["attempts"] == 1 and correct,
        "hint_used": record["hint_used"],
    }

@app.post("/end_quiz", response_model=EndQuizResponse)
async def end_quiz(request: Request, session_id: Optional[str] = Query(None, max_length=ID_MAX_LENGTH)):
    """End a session and return the score plus a per-topic review. Accepts ?session_id= or a JSON body."""
    prune_sessions()
    if not session_id:
        try:
            body = await request.json()
        except Exception:
            body = None
        if isinstance(body, dict) and isinstance(body.get("session_id"), str):
            session_id = body["session_id"][:ID_MAX_LENGTH]
    if not session_id or session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")

    summary = build_quiz_summary(SESSION_STORE[session_id]["questions"])
    del SESSION_STORE[session_id]
    logger.info("Cleared a finished quiz session")

    return {"status": "ok", "message": f"Quiz session {session_id} ended.", **summary}

@app.get("/healthz")
def healthz():
    return {"ok": True}

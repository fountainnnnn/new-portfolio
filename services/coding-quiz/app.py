# backend/src/app.py

import os, uuid, logging, json, re, time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.status import HTTP_422_UNPROCESSABLE_ENTITY
from dotenv import load_dotenv

from src.core.schemas import (
    GenerateRequest,
    AnswerRequest,
    GenerateResponse,
    CheckAnswerResponse,
)
from src.core.openai_qg import generate_questions

# ------------------------------------------------------------
# Setup
# ------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("quiz")

app = FastAPI(title="Multi-Language Quiz API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ngyuhang.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for answers:
# { session_id: {"created_at": float, "questions": { qid: {...} } } }
SESSION_STORE: dict[str, dict[str, dict]] = {}
SESSION_TTL_SECONDS = int(os.getenv("CODING_QUIZ_SESSION_TTL_SECONDS", "3600"))
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
}


def prune_sessions() -> None:
    now = time.time()
    expired = [
        sid for sid, entry in SESSION_STORE.items()
        if now - float(entry.get("created_at", now)) > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        del SESSION_STORE[sid]


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

# ------------------------------------------------------------
# Exception handlers
# ------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()} body={exc.body}")
    return JSONResponse(
        status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "error",
            "detail": exc.errors(),
            "body": exc.body,
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": str(exc)},
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
            {"status": "error", "message": "OpenAI API key is missing."},
            status_code=503,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Exception during generate_questions", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")

    session_id = str(uuid.uuid4())
    SESSION_STORE[session_id] = {"created_at": time.time(), "questions": {}}

    for item in result["secret"]:
        SESSION_STORE[session_id]["questions"][item["question_id"]] = {
            "answer": item["answer"],
            "explanation": item["explanation"],
            "language": req.language,
            "attempts": 0,
            "first_wrong": False,
        }
        logger.debug(f"Stored qid={item['question_id']} for session={session_id}")

    logger.debug(f"Session {session_id} has {len(SESSION_STORE[session_id]['questions'])} questions stored")

    return {"status": "ok", "session_id": session_id, "questions": result["safe"]}

@app.post("/check_answer", response_model=CheckAnswerResponse)
def check_answer(req: AnswerRequest):
    prune_sessions()
    session_id = req.session_id
    session = SESSION_STORE.get(session_id)
    record = session.get("questions", {}).get(req.question_id) if session else None

    if not record:
        logger.warning(f"Question not found for session={session_id}, qid={req.question_id}")
        raise HTTPException(status_code=404, detail="Question not found or expired")

    expected = record["answer"]
    user_ans = req.user_answer
    lang = record.get("language", "javascript")

    record["attempts"] += 1

    logger.debug(
        f"Checking answer for session={session_id}, qid={req.question_id}, "
        f"lang={lang}, expected={expected}, user={user_ans}, attempts={record['attempts']}"
    )

    expected_norm, user_norm = normalize_answer(expected, user_ans)
    correct = user_norm == expected_norm

    if record["attempts"] == 1 and not correct:
        record["first_wrong"] = True

    return {
        "status": "ok",
        "correct": correct,
        "expected": expected,
        "explanation": record["explanation"] or "",
    }

@app.post("/end_quiz")
def end_quiz(session_id: str):
    prune_sessions()
    if session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")

    questions = SESSION_STORE[session_id]["questions"]
    wrong_first_try = sum(1 for q in questions.values() if q["first_wrong"])
    total = len(questions)

    del SESSION_STORE[session_id]
    logger.info(f"Cleared session={session_id}")

    return {
        "status": "ok",
        "message": f"Quiz session {session_id} ended.",
        "score": {
            "wrong_first_try": wrong_first_try,
            "total_questions": total,
        },
    }

@app.get("/healthz")
def healthz():
    return {"ok": True}

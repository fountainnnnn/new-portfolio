import os
import shutil
import time
import asyncio
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv

load_dotenv()

try:
    from src.core import run_pipeline_end_to_end
except Exception as e:
    raise RuntimeError(f"Failed to import pipeline from src.core: {e}")

app = FastAPI(title="Slides → Quiz Deck API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ngyuhang.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)


OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_MODEL_NAME = os.getenv("QUIZ_GENERATOR_MODEL", "gpt-4.1")
RATE_BUCKETS: dict[str, list[float]] = {}
RATE_LIMITS = {
    ("POST", "/generate"): (
        int(os.getenv("QUIZ_GENERATOR_RATE_MAX", "4")),
        int(os.getenv("QUIZ_GENERATOR_RATE_WINDOW_SECONDS", "60")),
    ),
    ("GET", "/files"): (
        int(os.getenv("QUIZ_GENERATOR_FILE_RATE_MAX", "60")),
        int(os.getenv("QUIZ_GENERATOR_FILE_RATE_WINDOW_SECONDS", "60")),
    ),
}


def _client_id(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded_for or (request.client.host if request.client else "local")


def _allow_rate(request: Request) -> tuple[bool, int]:
    path = request.url.path
    key = (request.method, "/files" if path.startswith("/files/") else path)
    limit = RATE_LIMITS.get(key)
    if not limit:
        return True, 0

    max_requests, window_seconds = limit
    now = time.time()
    bucket_key = f"{request.method}:{key[1]}:{_client_id(request)}"
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
    allowed, retry_after = _allow_rate(request)
    if not allowed:
        return JSONResponse(
            {"status": "error", "message": "Rate limit exceeded. Try again shortly."},
            status_code=429,
            headers={"Retry-After": str(retry_after)},
        )
    return await call_next(request)


@app.get("/")
def index():
    return {
        "message": "Slides → Quiz Deck API is running",
        "endpoints": ["/generate", "/files/{filename}", "/healthz"],
    }


@app.post("/generate")
async def generate(
    request: Request,
    file: UploadFile = File(...),
    ocr_engine: str = Form("easyocr"),
    language: str = Form("en"),
    prefer_com: bool = Form(False),
    dpi: int = Form(180),
    openai_api_key: str = Form(""),
    model_name: str = Form(DEFAULT_MODEL_NAME),
    total_questions: int = Form(20),
    mix_mode: str = Form("balanced"),
    mcq_n: int = Form(0),
    theory_n: int = Form(0),
    codefill_n: int = Form(0),
    fillblank_n: int = Form(0),
    difficulty: str = Form("mixed"),
    deck_title: str = Form("Auto Quiz"),
    include_thumbs: bool = Form(True),
    include_explanations: bool = Form(True),
):
    original_name = Path(file.filename or "upload").name
    if Path(original_name).suffix.lower() not in {".pptx", ".pdf"}:
        raise HTTPException(status_code=400, detail="Upload a PPTX or PDF file.")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > int(os.getenv("QUIZ_GENERATOR_MAX_UPLOAD_BYTES", str(15 * 1024 * 1024))):
        raise HTTPException(status_code=413, detail="File is too large. Max size is 15MB.")

    tmp_in = OUTPUT_DIR / f"upload_{original_name}"
    tmp_in.write_bytes(content)

    key = openai_api_key or os.getenv("OPENAI_API_KEY", "")
    if not key:
        return JSONResponse(
            {"status": "error", "message": "OPENAI_API_KEY missing. Provide via form or .env."},
            status_code=400,
        )
    os.environ["OPENAI_API_KEY"] = key

    try:
        with tmp_in.open("rb") as input_file:
            result_pptx, zip_path, out_dir, msg = await asyncio.to_thread(
                run_pipeline_end_to_end,
                pptx_file=input_file,
                ocr_engine=ocr_engine,
                language=language,
                prefer_com=prefer_com,
                dpi=dpi,
                openai_api_key=key,
                model_name=model_name,
                total_questions=total_questions,
                mix_mode=mix_mode,
                mcq_n=mcq_n,
                theory_n=theory_n,
                codefill_n=codefill_n,
                fillblank_n=fillblank_n,
                difficulty=difficulty,
                deck_title=deck_title,
                include_thumbs=include_thumbs and include_explanations,
            )
    except Exception as e:
        tmp_in.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {e}")

    if not result_pptx:
        raise HTTPException(status_code=500, detail=f"Generation failed: {msg}")

    out_name = Path(original_name).stem + "_quizdeck.pptx"
    out_path = OUTPUT_DIR / out_name
    try:
        data = Path(result_pptx).read_bytes()
    except Exception:
        data = result_pptx if isinstance(result_pptx, (bytes, bytearray)) else bytes(result_pptx)
    out_path.write_bytes(data)
    if out_dir:
        shutil.rmtree(out_dir, ignore_errors=True)
    tmp_in.unlink(missing_ok=True)

    # ✅ Always return a public HTTPS link
    public_base_url = (
        request.headers.get("x-forwarded-prefix")
        or os.getenv("PUBLIC_QUIZ_GENERATOR_BASE_URL")
        or str(request.base_url).rstrip("/")
    )
    abs_url = f"{public_base_url}/files/{out_name}"

    return {"status": "ok", "filename": out_name, "url": abs_url}


@app.get("/files/{filename}")
def get_file(filename: str):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = OUTPUT_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=filename,
    )


@app.get("/healthz")
def healthz():
    return {"ok": True}

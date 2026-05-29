from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import threading
import time
from datetime import UTC, datetime
from functools import lru_cache
from io import BytesIO
from pathlib import Path

import requests
from flask import abort, flash, jsonify, redirect, render_template, request, send_file, session, url_for
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from application import app, csrf, db
from application.models import ChatMessage, ChatThread, PredictionHistory, User
from application.oauth import oauth

PROFILE_VERIFY_TTL_SECONDS = 300
OAUTH_NEXT_SESSION_KEY = "oauth_next"

APP_CONTEXT_MAX_CHARS = 12_000
CHAT_HISTORY_MAX_MESSAGES = 24
CHAT_TITLE_MAX_LEN = 60

PREDICTOR_MAX_IMAGE_BYTES = 10 * 1024 * 1024
MODEL_WARMUP_COOLDOWN_SECONDS = 45


_CHAT_IMAGE_PREDICTION_TOKEN_RE = re.compile(r"\[\[image_prediction:(\d+)\]\]")
_CHAT_IMAGE_DATA_TOKEN_RE = re.compile(r"\[\[image_data:[^\]]+\]\]")
# Backward-compatible alias for callers still using the old constant name.
_CHAT_IMAGE_TOKEN_RE = _CHAT_IMAGE_PREDICTION_TOKEN_RE
_MODEL_WARMUP_LOCK = threading.Lock()
_MODEL_WARMUP_LAST_STARTED_AT = 0.0
_PHONE_ALLOWED_RE = re.compile(r"^\+?[0-9][0-9 ().-]{6,24}$")
_PHONE_REGION_RULES = (
    {"code": "US", "label": "United States (+1)", "dial": "+1", "min_digits": 10, "max_digits": 10},
    {"code": "SG", "label": "Singapore (+65)", "dial": "+65", "min_digits": 8, "max_digits": 8},
    {"code": "MY", "label": "Malaysia (+60)", "dial": "+60", "min_digits": 9, "max_digits": 10},
    {"code": "IN", "label": "India (+91)", "dial": "+91", "min_digits": 10, "max_digits": 10},
    {"code": "AU", "label": "Australia (+61)", "dial": "+61", "min_digits": 9, "max_digits": 9},
    {"code": "CN", "label": "China (+86)", "dial": "+86", "min_digits": 11, "max_digits": 11},
    {"code": "JP", "label": "Japan (+81)", "dial": "+81", "min_digits": 10, "max_digits": 10},
    {"code": "KR", "label": "South Korea (+82)", "dial": "+82", "min_digits": 9, "max_digits": 10},
    {"code": "ID", "label": "Indonesia (+62)", "dial": "+62", "min_digits": 9, "max_digits": 12},
    {"code": "TH", "label": "Thailand (+66)", "dial": "+66", "min_digits": 9, "max_digits": 9},
    {"code": "VN", "label": "Vietnam (+84)", "dial": "+84", "min_digits": 9, "max_digits": 10},
    {"code": "PH", "label": "Philippines (+63)", "dial": "+63", "min_digits": 10, "max_digits": 10},
    {"code": "GB", "label": "United Kingdom (+44)", "dial": "+44", "min_digits": 10, "max_digits": 10},
    {"code": "DE", "label": "Germany (+49)", "dial": "+49", "min_digits": 10, "max_digits": 11},
    {"code": "FR", "label": "France (+33)", "dial": "+33", "min_digits": 9, "max_digits": 9},
    {"code": "BR", "label": "Brazil (+55)", "dial": "+55", "min_digits": 10, "max_digits": 11},
    {"code": "INTL", "label": "Other / International (+)", "dial": "+", "min_digits": 6, "max_digits": 15},
)
_PHONE_REGION_RULES_BY_DIAL = {item["dial"]: item for item in _PHONE_REGION_RULES}


def _strip_chat_image_tokens_for_llm(content: str) -> str:
    if not content:
        return ""
    if "[[image_" not in content:
        return content
    cleaned = _CHAT_IMAGE_PREDICTION_TOKEN_RE.sub("[User uploaded an image for prediction]", content)
    cleaned = _CHAT_IMAGE_DATA_TOKEN_RE.sub("[User uploaded an image for prediction]", cleaned)
    return cleaned.strip()


def _build_chat_image_data_token(image_bytes: bytes, image_mime: str | None) -> str:
    mime = str(image_mime or "").strip().lower()
    if mime == "image/jpg":
        mime = "image/jpeg"
    allowed = {"image/png", "image/jpeg", "image/webp", "image/gif"}
    if mime not in allowed:
        mime = "image/png"
    b64 = base64.b64encode(image_bytes).decode("ascii")
    return f"[[image_data:{mime};{b64}]]"


def _get_model_inference_base_url() -> str:
    base_url = str(app.config.get("MODEL_INFERENCE_URL") or os.getenv("MODEL_INFERENCE_URL") or "").strip()
    if not base_url:
        base_url = "http://school-veggie-ai-cnn:8501"
    return base_url


def _schedule_model_warmup() -> bool:
    global _MODEL_WARMUP_LAST_STARTED_AT

    now = time.time()
    with _MODEL_WARMUP_LOCK:
        if now - _MODEL_WARMUP_LAST_STARTED_AT < MODEL_WARMUP_COOLDOWN_SECONDS:
            return False
        _MODEL_WARMUP_LAST_STARTED_AT = now

    def _ping_model() -> None:
        base_url = _get_model_inference_base_url().rstrip("/")
        urls = (
            f"{base_url}/health",
            f"{base_url}/v1/models",
            base_url,
        )
        for url in urls:
            try:
                requests.get(url, timeout=(2, 4))
                return
            except requests.RequestException:
                continue
            except Exception:
                app.logger.debug("Model warmup ping failed", exc_info=True)
                return

    threading.Thread(target=_ping_model, name="model-warmup", daemon=True).start()
    return True


def _parse_bool(value) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _validate_phone(value: str) -> tuple[bool, str]:
    phone = str(value or "").strip()
    if not phone:
        return True, ""

    if not _PHONE_ALLOWED_RE.fullmatch(phone):
        return False, "Phone can only contain digits, spaces, parentheses, +, dots, and dashes."

    digit_count = len(re.sub(r"\D", "", phone))
    if digit_count < 8 or digit_count > 15:
        return False, "Phone must contain between 8 and 15 digits."

    return True, ""


def _split_phone_for_form(value: str) -> tuple[str, str]:
    raw = str(value or "").strip()
    if not raw:
        return "", ""

    digits_only = re.sub(r"\D", "", raw)
    if raw.startswith("+"):
        compact_digits = re.sub(r"\D", "", raw[1:])
        compact = f"+{compact_digits}"
        for item in sorted(_PHONE_REGION_RULES, key=lambda entry: len(str(entry["dial"])), reverse=True):
            dial = str(item["dial"])
            if compact.startswith(dial):
                return dial, compact[len(dial) :]
        return "+", re.sub(r"\D", "", raw[1:])

    if digits_only:
        return "+", digits_only

    return "", ""


def _validate_phone_with_region(region_dial: str, local_number: str) -> tuple[bool, str, str]:
    local_raw = str(local_number or "").strip()
    if not local_raw:
        return True, "", ""

    region = str(region_dial or "").strip()
    if not region:
        return False, "Select a phone region code.", ""

    region_rule = _PHONE_REGION_RULES_BY_DIAL.get(region)
    if not region_rule:
        return False, "Selected phone region is invalid.", ""

    if not re.fullmatch(r"\d+", local_raw):
        return False, "Phone number must only contain digits after the region code.", ""

    digits_count = len(local_raw)
    min_digits = int(region_rule["min_digits"])
    max_digits = int(region_rule["max_digits"])
    if digits_count < min_digits or digits_count > max_digits:
        if min_digits == max_digits:
            return False, f"Phone number for this region must be exactly {min_digits} digits.", ""
        return False, f"Phone number for this region must be {min_digits} to {max_digits} digits.", ""

    normalized = f"{region}{local_raw}"
    return True, "", normalized


def _apply_variant_transform(img, *, variant: str, seed_hex: str, sensitivity_percent: int):
    # Local import so the app still starts even if Pillow isn't installed until requirements are applied.
    from PIL import Image, ImageFilter, ImageOps  # type: ignore
    import numpy as np  # type: ignore

    try:
        bilinear = Image.Resampling.BILINEAR  # Pillow >= 10
    except Exception:
        bilinear = Image.BILINEAR  # Pillow < 10

    img = ImageOps.exif_transpose(img)
    try:
        img = img.convert("RGB")
    except Exception:
        pass

    variant = (variant or "base").strip().lower()

    # Deterministic per-image transforms (so results are reproducible).
    seed = int(seed_hex[:8], 16) if seed_hex else 0

    # Sensitivity: downscale then upscale before model resize.
    if sensitivity_percent < 100:
        pct = max(35, min(100, int(sensitivity_percent)))
        scale = max(0.35, min(1.0, pct / 100.0))
        w, h = img.size
        tw = max(2, int(round(w * scale)))
        th = max(2, int(round(h * scale)))
        img = img.resize((tw, th), resample=bilinear).resize((w, h), resample=bilinear)

    if variant in {"base", ""}:
        return img

    if variant == "blur":
        return img.filter(ImageFilter.GaussianBlur(radius=1.6))

    if variant == "noise":
        arr = np.asarray(img.convert("RGB"), dtype=np.int16)
        rng = np.random.default_rng(seed)
        noise = rng.normal(0.0, 18.0, size=arr.shape)
        out = np.clip(arr + noise, 0, 255).astype(np.uint8)
        from PIL import Image  # type: ignore

        return Image.fromarray(out, mode="RGB")

    if variant == "rotate":
        # Small rotation with black fill.
        angle = ((seed % 9) - 4) * 2  # -8..+8 degrees
        return img.rotate(angle, resample=bilinear, expand=False, fillcolor=(0, 0, 0))

    if variant == "crop":
        w, h = img.size
        crop_pct = 0.82
        cw = int(w * crop_pct)
        ch = int(h * crop_pct)
        ox = int((seed % 17) - 8)
        oy = int(((seed // 17) % 17) - 8)
        left = max(0, min(w - cw, (w - cw) // 2 + ox))
        top = max(0, min(h - ch, (h - ch) // 2 + oy))
        return img.crop((left, top, left + cw, top + ch)).resize((w, h), resample=bilinear)

    if variant == "pad":
        w, h = img.size
        pad = int(round(min(w, h) * 0.06))
        return ImageOps.expand(img, border=pad, fill=(0, 0, 0)).resize((w, h), resample=bilinear)

    if variant == "resize":
        w, h = img.size
        tw = max(2, int(round(w * 0.75)))
        th = max(2, int(round(h * 0.75)))
        return img.resize((tw, th), resample=bilinear).resize((w, h), resample=bilinear)

    return img


@csrf.exempt
@app.post("/api/infer")
def api_infer():
    """Run vegetable classification via the deployed TF Serving model.

    Accepts multipart form data:
      - image: file
      - model: "23" or "101" (default "101")
      - compare: "1" to run both models (optional)
      - variant: "base|blur|noise|crop|rotate|pad|resize" (optional)
      - sensitivity: integer percent 35..100 (optional, default 100)
      - save: "1" to save to DB when authenticated (optional)
    """

    image_file = request.files.get("image")
    if not image_file:
        return jsonify({"ok": False, "error": "image_required", "message": "Image is required."}), 400

    model = str(request.form.get("model") or "101").strip()
    if model not in {"23", "101"}:
        return jsonify({"ok": False, "error": "invalid_model", "message": "Model must be 23 or 101."}), 400

    compare = _parse_bool(request.form.get("compare"))
    save = _parse_bool(request.form.get("save"))
    variant = str(request.form.get("variant") or "base").strip().lower()
    sensitivity_percent = _parse_int(request.form.get("sensitivity"), 100)
    sensitivity_percent = max(35, min(100, sensitivity_percent))

    predict_mode = str(request.form.get("predict_mode") or "").strip().lower()
    fridge_run_id = str(request.form.get("fridge_run_id") or "").strip()
    fridge_source = str(request.form.get("fridge_source") or "").strip()
    fridge_tile_index = _parse_int(request.form.get("fridge_tile_index"), 0)
    fridge_tile_total = _parse_int(request.form.get("fridge_tile_total"), 0)
    fridge_crop_norm_raw = request.form.get("fridge_crop_norm")

    try:
        image_bytes = image_file.read()
    except Exception:
        return jsonify({"ok": False, "error": "invalid_image", "message": "Unable to read image."}), 400

    if not image_bytes:
        return jsonify({"ok": False, "error": "invalid_image", "message": "Empty image upload."}), 400
    if len(image_bytes) > PREDICTOR_MAX_IMAGE_BYTES:
        return (
            jsonify({"ok": False, "error": "image_too_large", "message": "Image exceeds 10MB limit."}),
            413,
        )

    image_mime = image_file.mimetype or "application/octet-stream"
    image_filename = image_file.filename
    image_size_bytes = len(image_bytes)
    image_sha256 = hashlib.sha256(image_bytes).hexdigest()

    user = _current_user()
    base_url = _get_model_inference_base_url()

    try:
        from PIL import Image  # type: ignore

        from application.veggie_inference import (
            VeggieInferenceError,
            predict_veggie_tfserving,
            preprocess_pil_to_bhwc,
        )
    except Exception:
        return jsonify({"ok": False, "error": "inference_dependencies_missing", "message": "Server is missing inference dependencies."}), 500

    try:
        img = Image.open(BytesIO(image_bytes))
        img.load()
    except Exception:
        return jsonify({"ok": False, "error": "invalid_image", "message": "Unsupported or corrupted image."}), 400

    try:
        # Apply optional quality/robustness transforms.
        img = _apply_variant_transform(img, variant=variant, seed_hex=image_sha256, sensitivity_percent=sensitivity_percent)
    except Exception:
        return jsonify({"ok": False, "error": "transform_failed", "message": "Unable to process consideration settings for this image."}), 400

    def _run(resolution: str):
        size_hw = (23, 23) if resolution == "23" else (101, 101)
        x = preprocess_pil_to_bhwc(img, size_hw=size_hw)
        return predict_veggie_tfserving(base_url=base_url, model_resolution=resolution, image_bhwc=x)

    try:
        if compare:
            p23 = _run("23")
            p101 = _run("101")
            primary = p23 if model == "23" else p101
            compare_payload = {
                "p23": {"label": p23.label, "confidence": p23.confidence},
                "p101": {"label": p101.label, "confidence": p101.confidence},
                "agrees": p23.label == p101.label,
                "gap": abs(float(p101.confidence) - float(p23.confidence)),
            }
        else:
            primary = _run(model)
            compare_payload = None
    except VeggieInferenceError as exc:
        code = str(exc.args[0]) if exc.args else "inference_error"
        return jsonify({"ok": False, "error": code, "message": "Inference service unavailable. Please try again."}), 502
    except Exception:
        app.logger.exception("Predictor inference failed")
        return jsonify({"ok": False, "error": "inference_error", "message": "Unable to run inference right now."}), 502

    topk = [{"label": t["label"], "score": float(t["score"])} for t in (primary.topk or [])]
    client_meta: dict[str, object] = {}
    if predict_mode in {"single", "fridge"}:
        client_meta["predict_mode"] = predict_mode
    if fridge_run_id:
        client_meta["fridge_run_id"] = fridge_run_id[:80]
    if fridge_source:
        client_meta["fridge_source"] = fridge_source[:40]
    if fridge_tile_index > 0:
        client_meta["fridge_tile_index"] = fridge_tile_index
    if fridge_tile_total > 0:
        client_meta["fridge_tile_total"] = fridge_tile_total
    if fridge_crop_norm_raw:
        try:
            crop_payload = json.loads(fridge_crop_norm_raw) if isinstance(fridge_crop_norm_raw, str) else None
        except json.JSONDecodeError:
            crop_payload = None
        if isinstance(crop_payload, dict):
            try:
                x = float(crop_payload.get("x", 0.0))
                y = float(crop_payload.get("y", 0.0))
                w = float(crop_payload.get("w", 0.0))
                h = float(crop_payload.get("h", 0.0))
                if 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0:
                    client_meta["fridge_crop_norm"] = {"x": x, "y": y, "w": w, "h": h}
            except (TypeError, ValueError):
                pass
    prediction_payload = {
        "model": primary.model,
        "label": primary.label,
        "confidence": float(primary.confidence),
        "sensitivity": float(sensitivity_percent) / 100.0,
        "topK": topk,
        "metrics": {
            "latency_ms": float(primary.latency_ms),
            "source": "tfserving",
            "endpoint": base_url,
            "variant": variant,
            "sensitivity_percent": sensitivity_percent,
            **({"client": client_meta} if client_meta else {}),
        },
        "compare": compare_payload,
        "ts": datetime.now(UTC).isoformat(),
    }

    if user and save:
        now = datetime.now(UTC)
        record = PredictionHistory(
            user_id=user.id,
            model=str(primary.model),
            label=str(primary.label),
            original_label=str(primary.label),
            is_corrected=False,
            corrected_at=None,
            confidence=float(primary.confidence),
            sensitivity=float(sensitivity_percent) / 100.0,
            top_k=topk,
            metrics=prediction_payload.get("metrics"),
            compare=compare_payload,
            image_bytes=image_bytes,
            image_mime=image_mime,
            image_filename=image_filename,
            image_sha256=image_sha256,
            image_size_bytes=image_size_bytes,
            created_at=now,
        )
        db.session.add(record)
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify({"ok": False, "error": "db_error", "message": "Unable to save prediction right now."}), 500

        return jsonify({"ok": True, "prediction": _prediction_to_dict(record)})

    return jsonify({"ok": True, "prediction": prediction_payload})


@lru_cache(maxsize=1)
def _load_app_chat_context() -> str:
    path = Path(__file__).resolve().parent / "chat_context.md"
    try:
        content = path.read_text(encoding="utf-8")
    except OSError:
        return ""
    content = content.strip()
    if not content:
        return ""
    return content[:APP_CONTEXT_MAX_CHARS]


def _parse_iso_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        cleaned = value.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        parsed = datetime.fromisoformat(cleaned)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _current_user() -> User | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.session.get(User, user_id)


def _is_safe_next(target: str | None) -> bool:
    if not target:
        return False
    return target.startswith("/") and not target.startswith("//")


def login_required(view):
    def wrapped(*args, **kwargs):
        user = _current_user()
        if user:
            return view(*args, **kwargs)
        if request.headers.get("Accept") == "application/json" or request.path.startswith("/api/"):
            return jsonify({"ok": False, "error": "not_authenticated"}), 401
        return redirect(url_for("login", next=request.full_path))

    wrapped.__name__ = getattr(view, "__name__", "wrapped")
    return wrapped


def _issue_profile_verification() -> str:
    nonce = secrets.token_urlsafe(32)
    session["profile_verify_nonce"] = nonce
    session["profile_verify_at"] = int(time.time())
    return nonce


def _profile_verification_valid(nonce: str | None) -> bool:
    if not nonce:
        return False
    expected = session.get("profile_verify_nonce")
    issued_at = session.get("profile_verify_at")
    if not expected or not issued_at:
        return False
    if nonce != expected:
        return False
    try:
        age = time.time() - int(issued_at)
    except (TypeError, ValueError):
        return False
    return age <= PROFILE_VERIFY_TTL_SECONDS


def _consume_profile_verification() -> None:
    session.pop("profile_verify_nonce", None)
    session.pop("profile_verify_at", None)


def _normalize_username(value: str) -> str:
    candidate = (value or "").strip().lower()
    candidate = re.sub(r"[^a-z0-9_]+", "_", candidate)
    candidate = re.sub(r"_+", "_", candidate).strip("_")
    return candidate


def _suggest_username(email: str) -> str:
    local = (email.split("@", 1)[0] if email else "").strip()
    local = _normalize_username(local)
    return local[:30] if local else ""


def _google_client():
    return oauth.create_client("google")


def _get_oauth_next() -> str | None:
    target = session.get(OAUTH_NEXT_SESSION_KEY)
    return target if isinstance(target, str) else None


def _set_oauth_next(target: str | None) -> None:
    if _is_safe_next(target):
        session[OAUTH_NEXT_SESSION_KEY] = target
    else:
        session.pop(OAUTH_NEXT_SESSION_KEY, None)


def _clear_oauth_next() -> None:
    session.pop(OAUTH_NEXT_SESSION_KEY, None)


def _unique_username(base: str) -> str:
    base = _normalize_username(base)[:30]
    if not base:
        base = "user"
    if not User.query.filter_by(username=base).first():
        return base

    for _ in range(50):
        candidate = f"{base[:24]}_{secrets.randbelow(10_000):04d}"
        if not User.query.filter_by(username=candidate).first():
            return candidate
    return f"user_{secrets.randbelow(1_000_000):06d}"


@app.context_processor
def inject_user():
    return {"current_user": _current_user()}


@app.get("/")
def home():
    return render_template("index.html")


@csrf.exempt
@app.post("/api/model/warmup")
def api_model_warmup():
    _schedule_model_warmup()
    return jsonify({"ok": True}), 202


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if _current_user():
            return redirect(url_for("profile"))
        return render_template("login.html", next_url=request.args.get("next"))

    errors: list[str] = []
    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    next_url = request.args.get("next") or request.form.get("next")

    if not username:
        errors.append("Username is required.")
    if not password:
        errors.append("Password is required.")

    if errors:
        return render_template(
            "login.html",
            login_errors=errors,
            login_defaults={"username": username},
            next_url=next_url,
        )

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        if user and user.oauth_provider == "google" and user.oauth_subject and not getattr(user, "password_set", True):
            return render_template(
                "login.html",
                login_errors=["This account uses Google sign-in. Please continue with Google."],
                login_defaults={"username": username},
                next_url=next_url,
            )
        return render_template(
            "login.html",
            login_errors=["Invalid username or password."],
            login_defaults={"username": username},
            next_url=next_url,
        )

    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["user_name"] = user.full_name or user.username

    if _is_safe_next(next_url):
        return redirect(next_url)
    return redirect(url_for("profile"))


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        if _current_user():
            return redirect(url_for("profile"))
        return render_template("signup.html")

    errors: list[str] = []
    full_name = (request.form.get("full_name") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    confirm_password = request.form.get("confirm_password") or ""

    defaults = {"full_name": full_name, "email": email, "username": username}

    if not full_name:
        errors.append("Full name is required.")
    if not email:
        errors.append("Email is required.")
    if not username:
        errors.append("Username is required.")
    if not password:
        errors.append("Password is required.")
    if password and len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if password != confirm_password:
        errors.append("Passwords do not match.")

    if errors:
        return render_template("signup.html", signup_errors=errors, signup_defaults=defaults)

    user = User(username=username, email=email, full_name=full_name, password_set=True)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return render_template(
            "signup.html",
            signup_errors=["Username or email already exists."],
            signup_defaults=defaults,
        )
    except SQLAlchemyError:
        db.session.rollback()
        return render_template(
            "signup.html",
            signup_errors=["Unable to create account right now. Please try again."],
            signup_defaults=defaults,
        )

    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["user_name"] = user.full_name or user.username
    return redirect(url_for("profile"))


@app.get("/auth/google")
def auth_google():
    client = _google_client()
    if not client:
        flash("Google sign-in is not configured.", "danger")
        return redirect(url_for("login"))

    _set_oauth_next(request.args.get("next"))
    redirect_uri = url_for("auth_google_callback", _external=True)
    return client.authorize_redirect(redirect_uri)


@app.get("/auth/google/callback")
def auth_google_callback():
    client = _google_client()
    if not client:
        flash("Google sign-in is not configured.", "danger")
        return redirect(url_for("login"))

    try:
        token = client.authorize_access_token()
    except Exception:
        flash("Unable to sign in with Google right now.", "danger")
        return redirect(url_for("login"))

    userinfo = token.get("userinfo") if isinstance(token, dict) else None
    if not userinfo:
        try:
            userinfo = client.parse_id_token(token)
        except Exception:
            userinfo = None
    if not userinfo:
        try:
            userinfo = client.get("userinfo").json()
        except Exception:
            userinfo = {}

    sub = (userinfo.get("sub") or "").strip()
    email = (userinfo.get("email") or "").strip().lower()
    full_name = (userinfo.get("name") or userinfo.get("given_name") or "").strip()
    email_verified = bool(userinfo.get("email_verified"))

    if not sub or not email:
        flash("Google did not return required profile information.", "danger")
        return redirect(url_for("login"))

    linked = User.query.filter_by(oauth_provider="google", oauth_subject=sub).first()
    if linked:
        session.clear()
        session.permanent = True
        session["user_id"] = linked.id
        session["user_name"] = linked.full_name or linked.username
        target = _get_oauth_next()
        _clear_oauth_next()
        return redirect(target) if _is_safe_next(target) else redirect(url_for("profile"))

    existing = User.query.filter_by(email=email).first()
    if existing:
        if existing.oauth_provider and existing.oauth_provider != "google":
            flash("This email is already linked to a different sign-in method.", "danger")
            return redirect(url_for("login"))

        existing.oauth_provider = "google"
        existing.oauth_subject = sub
        existing.oauth_email_verified = email_verified
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            flash("Unable to link Google account right now.", "danger")
            return redirect(url_for("login"))

        session.clear()
        session.permanent = True
        session["user_id"] = existing.id
        session["user_name"] = existing.full_name or existing.username
        target = _get_oauth_next()
        _clear_oauth_next()
        return redirect(target) if _is_safe_next(target) else redirect(url_for("profile"))

    username = _unique_username(_suggest_username(email) or "user")
    user = User(
        username=username,
        email=email,
        full_name=full_name or None,
        oauth_provider="google",
        oauth_subject=sub,
        oauth_email_verified=email_verified,
        password_set=False,
    )
    user.set_password(secrets.token_urlsafe(48))

    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        flash("Unable to create account. Please try again.", "danger")
        return redirect(url_for("login"))
    except SQLAlchemyError:
        db.session.rollback()
        flash("Unable to create account right now. Please try again.", "danger")
        return redirect(url_for("login"))

    target = _get_oauth_next()
    _clear_oauth_next()

    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["user_name"] = user.full_name or user.username
    return redirect(target) if _is_safe_next(target) else redirect(url_for("profile"))


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))


@app.get("/predictor")
def predictor():
    return render_template("predict.html")


@app.get("/live-predictor")
def live_predictor():
    return render_template("live_predictor.html")


@app.get("/chat")
def chat():
    return render_template("chat.html")


@app.get("/profile")
def profile():
    user = _current_user()
    if not user:
        return redirect(url_for("login"))
    selected_phone_region, selected_phone_local = _split_phone_for_form(getattr(user, "phone", "") or "")
    return render_template(
        "profile.html",
        user=user,
        phone_regions=_PHONE_REGION_RULES,
        selected_phone_region=selected_phone_region,
        selected_phone_local=selected_phone_local,
    )


@app.get("/profile/report.pdf")
def profile_report_pdf():
    user = _current_user()
    if not user:
        return redirect(url_for("login"))

    limit = _parse_int(request.args.get("limit"), 250)
    limit = max(1, min(1000, limit))

    total_count = PredictionHistory.query.filter_by(user_id=user.id).count()
    records = (
        PredictionHistory.query.filter_by(user_id=user.id)
        .order_by(PredictionHistory.created_at.desc())
        .limit(limit)
        .all()
    )

    try:
        from application.reporting import build_prediction_report_pdf

        pdf_bytes = build_prediction_report_pdf(user=user, predictions=records, total_count=total_count)
    except RuntimeError as exc:
        if str(exc) == "pdf_dependency_missing":
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "pdf_dependency_missing",
                        "message": "PDF generation dependencies are missing. Install requirements and try again.",
                    }
                ),
                500,
            )
        raise

    safe_username = "".join(ch for ch in (user.username or "user") if ch.isalnum() or ch in {"-", "_"}).strip() or "user"
    filename = f"veggieai-report-{safe_username}.pdf"
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        download_name=filename,
        as_attachment=True,
        max_age=0,
    )


@app.post("/profile/verify-password")
def verify_profile_password():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    if not getattr(user, "password_set", True):
        return jsonify({"ok": False, "error": "password_not_set"}), 400

    payload = request.get_json(silent=True) or {}
    password = payload.get("password") or ""
    if not password:
        return jsonify({"ok": False, "error": "password_required"}), 400

    if not user.check_password(password):
        return jsonify({"ok": False, "error": "invalid_password"}), 400

    nonce = _issue_profile_verification()
    return jsonify({"ok": True, "nonce": nonce, "ttl_seconds": PROFILE_VERIFY_TTL_SECONDS})


@app.post("/profile/set-password")
def set_profile_password():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    payload = request.get_json(silent=True) or {}
    new_password = payload.get("new_password") or ""
    confirm_password = payload.get("confirm_password") or ""

    if not new_password or len(new_password) < 8:
        return jsonify({"ok": False, "error": "password_too_short"}), 400
    if new_password != confirm_password:
        return jsonify({"ok": False, "error": "password_mismatch"}), 400

    user.set_password(new_password)
    user.password_set = True
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "db_error"}), 500

    nonce = _issue_profile_verification()
    return jsonify({"ok": True, "nonce": nonce, "ttl_seconds": PROFILE_VERIFY_TTL_SECONDS})


@app.post("/profile/update")
def update_profile():
    user = _current_user()
    if not user:
        return redirect(url_for("login", next=request.full_path))

    nonce = request.form.get("verify_nonce")
    if not _profile_verification_valid(nonce):
        flash("Please verify your password to update your profile.", "danger")
        return redirect(url_for("profile"))

    errors: list[str] = []
    full_name = (request.form.get("full_name") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    phone_region = (request.form.get("phone_region") or "").strip()
    phone_local = (request.form.get("phone_local") or "").strip()
    phone_legacy = (request.form.get("phone") or "").strip()
    location = (request.form.get("location") or "").strip()
    preferred_model = (request.form.get("preferred_model") or "").strip()

    if not full_name:
        errors.append("Full name is required.")
    if not email:
        errors.append("Email is required.")

    if email and User.query.filter(User.email == email, User.id != user.id).first():
        errors.append("Email is already in use.")

    phone = ""
    if phone_local or phone_region:
        phone_ok, phone_error, normalized_phone = _validate_phone_with_region(phone_region, phone_local)
        if not phone_ok and phone_error:
            errors.append(phone_error)
        phone = normalized_phone
    else:
        phone_ok, phone_error = _validate_phone(phone_legacy)
        if not phone_ok and phone_error:
            errors.append(phone_error)
        phone = phone_legacy

    if preferred_model and preferred_model not in {"23", "101"}:
        errors.append("Preferred model must be 23 or 101.")

    if errors:
        flash(", ".join(errors), "danger")
        return redirect(url_for("profile"))

    user.full_name = full_name
    user.email = email
    user.phone = phone or None
    user.location = location or None
    user.preferred_model = preferred_model or None

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        flash("Unable to update profile right now.", "danger")
        return redirect(url_for("profile"))

    _consume_profile_verification()
    session["user_name"] = user.full_name or user.username
    flash("Profile updated.", "success")
    return redirect(url_for("profile"))


@app.post("/profile/update-password")
def update_password():
    user = _current_user()
    if not user:
        return redirect(url_for("login", next=request.full_path))

    nonce = request.form.get("verify_nonce")
    if not _profile_verification_valid(nonce):
        flash("Please verify your password to update your password.", "danger")
        return redirect(url_for("profile"))

    errors: list[str] = []
    new_password = request.form.get("new_password") or ""
    confirm_password = request.form.get("confirm_password") or ""

    if not new_password:
        errors.append("New password is required.")
    if new_password and len(new_password) < 8:
        errors.append("New password must be at least 8 characters long.")
    if new_password != confirm_password:
        errors.append("Passwords do not match.")

    if errors:
        flash(", ".join(errors), "danger")
        return redirect(url_for("profile"))

    user.set_password(new_password)
    user.password_set = True
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        flash("Unable to update password right now.", "danger")
        return redirect(url_for("profile"))

    _consume_profile_verification()
    flash("Password updated.", "success")
    return redirect(url_for("profile"))


def _prediction_to_dict(record: PredictionHistory) -> dict:
    ts = record.created_at
    if ts and ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    corrected_at = record.corrected_at
    if corrected_at and corrected_at.tzinfo is None:
        corrected_at = corrected_at.replace(tzinfo=UTC)
    return {
        "id": record.id,
        "ts": ts.isoformat() if ts else None,
        "model": record.model,
        "label": record.label,
        "original_label": record.original_label or record.label,
        "is_corrected": bool(record.is_corrected),
        "corrected_at": corrected_at.isoformat() if corrected_at else None,
        "confidence": record.confidence,
        "sensitivity": record.sensitivity,
        "topK": record.top_k,
        "metrics": record.metrics,
        "compare": record.compare,
        "image_url": url_for("prediction_image", prediction_id=record.id) if record.image_bytes else None,
    }


@app.post("/api/chat")
def api_chat():
    payload: dict = {}
    history_raw: list | str = []
    thread_id_raw = None
    image_file = None

    if request.is_json:
        payload = request.get_json(silent=True) or {}
        history_raw = payload.get("history") or []
        thread_id_raw = payload.get("thread_id")
    else:
        thread_id_raw = request.form.get("thread_id")
        history_raw = request.form.get("history") or []
        payload = {"message": request.form.get("message")}
        image_file = request.files.get("image")

    message = str(payload.get("message") or "").strip()
    user_message = message

    if not user_message and not image_file:
        return jsonify({"ok": False, "error": "message_required", "message": "Message or image is required."}), 400
    if len(user_message) > 6000:
        return jsonify({"ok": False, "error": "message_too_long", "message": "Message is too long."}), 400

    user = _current_user()

    history: list[dict[str, str]] = []
    thread: ChatThread | None = None
    thread_id: int | None = None

    if user:
        try:
            if thread_id_raw not in (None, ""):
                thread_id = int(thread_id_raw)
        except (TypeError, ValueError):
            thread_id = None

        if thread_id is not None:
            thread = ChatThread.query.filter_by(id=thread_id, user_id=user.id).first()

        if not thread:
            thread = ChatThread(user_id=user.id, title="New chat")
            db.session.add(thread)
            try:
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                return jsonify({"ok": False, "error": "db_error", "message": "Database unavailable."}), 500

        thread_id = thread.id

        existing = (
            ChatMessage.query.filter_by(thread_id=thread.id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(CHAT_HISTORY_MAX_MESSAGES)
            .all()
        )
        for msg in reversed(existing):
            history.append({"role": msg.role, "content": _strip_chat_image_tokens_for_llm(msg.content)})
    else:
        if isinstance(history_raw, str) and history_raw:
            try:
                history_raw = json.loads(history_raw)
            except json.JSONDecodeError:
                history_raw = []
        if isinstance(history_raw, list):
            for item in history_raw[-CHAT_HISTORY_MAX_MESSAGES:]:
                if not isinstance(item, dict):
                    continue
                role = item.get("role")
                content = item.get("content")
                if role not in {"user", "assistant"}:
                    continue
                if not isinstance(content, str):
                    continue
                content = content.strip()
                if not content:
                    continue
                content = _strip_chat_image_tokens_for_llm(content)
                if not content:
                    continue
                history.append({"role": role, "content": content[:6000]})

    image_bytes = None
    image_mime = None
    image_filename = None
    image_sha256 = None
    image_size_bytes = None

    if image_file:
        try:
            image_bytes = image_file.read()
        except Exception:
            image_bytes = None
        if not image_bytes:
            return jsonify({"ok": False, "error": "invalid_image", "message": "Unable to read the uploaded image."}), 400
        image_mime = image_file.mimetype
        image_filename = image_file.filename
        image_size_bytes = len(image_bytes)
        image_sha256 = hashlib.sha256(image_bytes).hexdigest()

    api_key = app.config.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "openai_not_configured",
                    "message": "OpenAI is not configured. Set OPENAI_API_KEY in your environment.",
                }
            ),
            500,
        )

    model = str(app.config.get("OPENAI_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini").strip() or "gpt-4o-mini"
    system_prompt = str(app.config.get("OPENAI_CHAT_SYSTEM_PROMPT") or "").strip()
    app_context = _load_app_chat_context()

    try:
        from openai import OpenAI  # type: ignore
    except Exception:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "openai_sdk_missing",
                    "message": "OpenAI SDK is not installed. Add 'openai' to requirements.",
                }
            ),
            500,
        )

    client = OpenAI(api_key=api_key)
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if app_context:
        messages.append(
            {
                "role": "system",
                "content": (
                    "App context (read-only). Use this to answer site-specific questions accurately.\n\n" + app_context
                ),
            }
        )
    messages.extend(history)

    prediction_record: PredictionHistory | None = None
    prediction_payload: dict | None = None

    if image_bytes:
        base_url = _get_model_inference_base_url()

        preferred = (user.preferred_model if user else None) or "23"
        model_resolution = preferred if preferred in {"23", "101"} else "101"
        size_hw = (23, 23) if model_resolution == "23" else (101, 101)

        try:
            from application.veggie_inference import (
                VeggieInferenceError,
                predict_veggie_tfserving,
                preprocess_image_bytes_to_bhwc,
            )

            image_bhwc = preprocess_image_bytes_to_bhwc(image_bytes, size_hw=size_hw)
            pred = predict_veggie_tfserving(
                base_url=base_url,
                model_resolution=model_resolution,
                image_bhwc=image_bhwc,
            )

            prediction_payload = {
                "model": pred.model,
                "label": pred.label,
                "confidence": pred.confidence,
                "topK": pred.topk,
                "metrics": {"latency_ms": pred.latency_ms, "source": "tfserving", "endpoint": base_url},
            }
        except Exception as exc:  # noqa: BLE001
            code = "inference_error"
            if hasattr(exc, "args") and exc.args:
                code = str(exc.args[0])
            prediction_payload = {
                "error": code,
                "message": "Unable to run image prediction right now.",
                "metrics": {"source": "tfserving", "endpoint": base_url},
            }

        messages.append(
            {
                "role": "system",
                "content": (
                    "Image upload detected. The backend ran VeggieAI's vegetable classifier (TensorFlow Serving).\n"
                    "Treat the following result as factual and explain it clearly to the user.\n\n"
                    + json.dumps(prediction_payload, ensure_ascii=False, indent=2)
                ),
            }
        )

    llm_message = user_message
    if not llm_message and image_bytes:
        llm_message = "I uploaded an image for prediction. Tell me what the model predicted and what it means."
    messages.append({"role": "user", "content": llm_message})

    if user and thread:
        now = datetime.now(UTC)
        user_message_content = user_message

        if image_bytes and prediction_payload and not prediction_payload.get("error") and user:
            try:
                prediction_record = PredictionHistory(
                    user_id=user.id,
                    model=str(prediction_payload.get("model") or "101"),
                    label=str(prediction_payload.get("label") or "Unknown"),
                    original_label=str(prediction_payload.get("label") or "Unknown"),
                    is_corrected=False,
                    corrected_at=None,
                    confidence=float(prediction_payload.get("confidence") or 0.0),
                    sensitivity=None,
                    top_k=prediction_payload.get("topK"),
                    metrics=prediction_payload.get("metrics"),
                    compare=None,
                    image_bytes=image_bytes,
                    image_mime=image_mime,
                    image_filename=image_filename,
                    image_sha256=image_sha256,
                    image_size_bytes=image_size_bytes,
                    created_at=now,
                )
                db.session.add(prediction_record)
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                prediction_record = None

        if image_bytes:
            try:
                token = _build_chat_image_data_token(image_bytes, image_mime)
                user_message_content = token + (("\n" + user_message) if user_message else "")
            except Exception:
                pass

        if not user_message_content.strip() and image_bytes:
            user_message_content = "Uploaded an image for prediction."

        db.session.add(ChatMessage(thread_id=thread.id, role="user", content=user_message_content))
        thread.updated_at = now
        if (thread.title or "New chat") == "New chat":
            title_seed = user_message.strip() if user_message.strip() else ("Image prediction" if image_bytes else "New chat")
            thread.title = title_seed[:CHAT_TITLE_MAX_LEN] or "New chat"
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.35,
            max_tokens=650,
        )
        reply = (response.choices[0].message.content or "").strip()
    except Exception as exc:
        status_code = getattr(exc, "status_code", None) or getattr(exc, "status", None)
        error_code = getattr(exc, "code", None) or getattr(getattr(exc, "body", None), "code", None)
        diagnostic_code = f"chat_upstream_http_{status_code}" if status_code else "chat_upstream_error"
        app.logger.exception(
            "OpenAI chat request failed",
            extra={"status_code": status_code, "error_code": error_code, "diagnostic_code": diagnostic_code},
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "openai_error",
                    "code": diagnostic_code,
                    "message": "Assistant is unavailable right now. Please try again in a moment.",
                }
            ),
            502,
        )

    if not reply:
        reply = "I'm here — try rephrasing that question?"

    if user and thread:
        now = datetime.now(UTC)
        db.session.add(ChatMessage(thread_id=thread.id, role="assistant", content=reply))
        thread.updated_at = now
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()

        return jsonify(
            {
                "ok": True,
                "reply": reply,
                "model": model,
                "thread_id": thread.id,
                "title": thread.title,
                "prediction": _prediction_to_dict(prediction_record) if prediction_record else prediction_payload,
                "user_message": user_message_content if "user_message_content" in locals() else message,
            }
        )

    return jsonify(
        {
            "ok": True,
            "reply": reply,
            "model": model,
            "thread_id": None,
            "prediction": prediction_payload,
            "user_message": message,
        }
    )


@app.get("/api/chat/threads")
@login_required
def api_chat_threads_list():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    threads = (
        ChatThread.query.filter_by(user_id=user.id).order_by(ChatThread.updated_at.desc(), ChatThread.id.desc()).limit(200).all()
    )
    return jsonify(
        {
            "ok": True,
            "threads": [
                {
                    "id": t.id,
                    "title": t.title,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                    "message_count": t.messages.count(),
                }
                for t in threads
            ],
        }
    )


@app.post("/api/chat/threads")
@login_required
def api_chat_threads_create():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title") or "").strip()
    title = title[:CHAT_TITLE_MAX_LEN] if title else "New chat"

    now = datetime.now(UTC)
    thread = ChatThread(user_id=user.id, title=title, created_at=now, updated_at=now)
    db.session.add(thread)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "db_error"}), 500

    db.session.add(ChatMessage(thread_id=thread.id, role="assistant", content="Hi! I'm VeggieAI. Ask me anything about veggies, recipes, or how to use the app."))
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(
        {
            "ok": True,
            "thread": {
                "id": thread.id,
                "title": thread.title,
                "created_at": thread.created_at.isoformat() if thread.created_at else None,
                "updated_at": thread.updated_at.isoformat() if thread.updated_at else None,
            },
        }
    )


@app.get("/api/chat/threads/<int:thread_id>")
@login_required
def api_chat_threads_get(thread_id: int):
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    thread = ChatThread.query.filter_by(id=thread_id, user_id=user.id).first()
    if not thread:
        return jsonify({"ok": False, "error": "not_found"}), 404

    messages = (
        ChatMessage.query.filter_by(thread_id=thread.id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .limit(500)
        .all()
    )
    return jsonify(
        {
            "ok": True,
            "thread": {
                "id": thread.id,
                "title": thread.title,
                "created_at": thread.created_at.isoformat() if thread.created_at else None,
                "updated_at": thread.updated_at.isoformat() if thread.updated_at else None,
            },
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
            ],
        }
    )


@app.delete("/api/chat/threads/<int:thread_id>")
@login_required
def api_chat_threads_delete(thread_id: int):
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    thread = ChatThread.query.filter_by(id=thread_id, user_id=user.id).first()
    if not thread:
        return jsonify({"ok": False, "error": "not_found"}), 404

    db.session.delete(thread)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "db_error"}), 500

    return jsonify({"ok": True, "deleted_id": thread_id})


@csrf.exempt
@app.get("/api/profile")
def api_profile():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    return jsonify(
        {
            "ok": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "phone": user.phone,
                "location": user.location,
                "preferred_model": user.preferred_model,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
        }
    )


@csrf.exempt
@app.get("/api/predictions")
def api_predictions_list():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    try:
        limit = int(request.args.get("limit", "60"))
    except ValueError:
        limit = 60
    limit = max(1, min(200, limit))

    records = (
        PredictionHistory.query.filter_by(user_id=user.id)
        .order_by(PredictionHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify({"ok": True, "predictions": [_prediction_to_dict(r) for r in records]})


@csrf.exempt
@app.post("/api/predictions")
def api_predictions_create():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    entry: dict = {}
    if request.is_json:
        entry = request.get_json(silent=True) or {}
    else:
        raw_entry = request.form.get("entry") or ""
        if raw_entry:
            try:
                entry = json.loads(raw_entry)
            except json.JSONDecodeError:
                return jsonify({"ok": False, "error": "invalid_entry"}), 400

    model = str(entry.get("model") or request.form.get("model") or "").strip() or "101"
    label = str(entry.get("label") or request.form.get("label") or "").strip()
    confidence_raw = entry.get("confidence", request.form.get("confidence"))
    sensitivity_raw = entry.get("sensitivity", request.form.get("sensitivity"))

    try:
        confidence = float(confidence_raw)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "invalid_confidence"}), 400

    sensitivity = None
    if sensitivity_raw not in (None, ""):
        try:
            sensitivity = float(sensitivity_raw)
        except (TypeError, ValueError):
            sensitivity = None

    if not label:
        return jsonify({"ok": False, "error": "label_required"}), 400

    created_at = _parse_iso_timestamp(entry.get("ts")) or datetime.now(UTC)

    image_bytes = None
    image_mime = None
    image_filename = None
    image_sha256 = None
    image_size_bytes = None

    if request.is_json:
        # Optional JSON base64 support (e.g. {"image_base64": "...", "image_mime": "image/png"})
        image_b64 = entry.get("image_base64")
        if image_b64:
            if not isinstance(image_b64, str):
                return jsonify({"ok": False, "error": "invalid_image_base64"}), 400
            try:
                image_bytes = base64.b64decode(image_b64)
            except (ValueError, TypeError):
                return jsonify({"ok": False, "error": "invalid_image_base64"}), 400
            image_mime = entry.get("image_mime") or "application/octet-stream"
            image_filename = entry.get("image_filename")
    else:
        image_file = request.files.get("image")
        if image_file:
            image_bytes = image_file.read()
            image_mime = image_file.mimetype or request.form.get("image_mime")
            image_filename = image_file.filename

    if image_bytes:
        image_size_bytes = len(image_bytes)
        image_sha256 = hashlib.sha256(image_bytes).hexdigest()

    record = PredictionHistory(
        user_id=user.id,
        model=model,
        label=label,
        original_label=label,
        is_corrected=False,
        corrected_at=None,
        confidence=confidence,
        sensitivity=sensitivity,
        top_k=entry.get("topK") or entry.get("top_k"),
        metrics=entry.get("metrics"),
        compare=entry.get("compare"),
        image_bytes=image_bytes,
        image_mime=image_mime,
        image_filename=image_filename,
        image_sha256=image_sha256,
        image_size_bytes=image_size_bytes,
        created_at=created_at,
    )

    db.session.add(record)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "db_error"}), 500

    return jsonify({"ok": True, "prediction": _prediction_to_dict(record)})


@csrf.exempt
@app.delete("/api/predictions")
def api_predictions_clear():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    try:
        PredictionHistory.query.filter_by(user_id=user.id).delete()
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "db_error"}), 500

    return jsonify({"ok": True})


@csrf.exempt
@app.delete("/api/predictions/<int:prediction_id>")
def api_predictions_delete(prediction_id: int):
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    record = PredictionHistory.query.filter_by(user_id=user.id, id=prediction_id).first()
    if not record:
        return jsonify({"ok": False, "error": "not_found"}), 404

    db.session.delete(record)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "db_error"}), 500

    return jsonify({"ok": True, "deleted_id": prediction_id})


@csrf.exempt
@app.post("/api/predictions/<int:prediction_id>/correct")
def api_predictions_correct(prediction_id: int):
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "error": "not_authenticated"}), 401

    record = PredictionHistory.query.filter_by(user_id=user.id, id=prediction_id).first()
    if not record:
        return jsonify({"ok": False, "error": "not_found"}), 404

    payload = request.get_json(silent=True) or {}
    corrected_label = str(payload.get("label") or request.form.get("label") or "").strip()
    if not corrected_label:
        return jsonify({"ok": False, "error": "label_required", "message": "Corrected label is required."}), 400
    corrected_label = corrected_label[:120]

    original_label = str(record.original_label or record.label or "").strip()
    if not original_label:
        original_label = corrected_label
    record.original_label = original_label
    record.label = corrected_label
    record.is_corrected = corrected_label != original_label
    record.corrected_at = datetime.now(UTC) if record.is_corrected else None

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "db_error", "message": "Unable to save correction right now."}), 500

    return jsonify({"ok": True, "prediction": _prediction_to_dict(record)})


@csrf.exempt
@app.get("/api/predictions/<int:prediction_id>/image")
def prediction_image(prediction_id: int):
    user = _current_user()
    if not user:
        abort(401)

    record = PredictionHistory.query.filter_by(user_id=user.id, id=prediction_id).first()
    if not record or not record.image_bytes:
        abort(404)

    return send_file(
        BytesIO(record.image_bytes),
        mimetype=record.image_mime or "application/octet-stream",
        download_name=record.image_filename or f"prediction-{prediction_id}",
        as_attachment=False,
        max_age=0,
    )


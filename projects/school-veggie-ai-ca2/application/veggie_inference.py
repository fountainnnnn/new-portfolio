from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import time
from typing import Any

import numpy as np
import requests
from PIL import Image

CLASS_NAMES: list[str] = [
    "Bean",
    "Bitter_Gourd",
    "Brinjal",
    "Cabbage",
    "Capsicum",
    "Cauliflower_Broccoli",
    "Cucumber_BottleGourd",
    "Potato",
    "Pumpkin",
    "Radish_Carrot",
    "Tomato",
]


class VeggieInferenceError(RuntimeError):
    pass


@dataclass(frozen=True)
class VeggiePrediction:
    model: str
    label: str
    confidence: float
    topk: list[dict[str, Any]]
    latency_ms: float


_SESSION = requests.Session()


def _nearest_resample() -> int:
    try:
        return int(Image.Resampling.NEAREST)  # Pillow >= 10
    except Exception:
        return int(Image.NEAREST)  # Pillow < 10


def preprocess_image_bytes_to_bhwc(image_bytes: bytes, *, size_hw: tuple[int, int]) -> np.ndarray:
    """Preprocess an uploaded image to match the deployed CNN input.

    - Convert to grayscale (1 channel)
    - Resize using nearest interpolation
    - Keep pixel values in [0..255] float32 (model handles rescaling internally)
    - Output shape: (1, H, W, 1)
    """

    try:
        img = Image.open(BytesIO(image_bytes))
        img.load()
    except Exception as exc:  # noqa: BLE001
        raise VeggieInferenceError("invalid_image") from exc

    height, width = size_hw
    img = img.convert("L").resize((width, height), resample=_nearest_resample())
    arr = np.asarray(img, dtype=np.float32)
    if arr.ndim != 2:
        raise VeggieInferenceError("invalid_image_shape")
    arr = np.expand_dims(arr, axis=-1)  # HWC with C=1
    return np.expand_dims(arr, axis=0)  # BHWC


def preprocess_pil_to_bhwc(img: Image.Image, *, size_hw: tuple[int, int]) -> np.ndarray:
    height, width = size_hw
    img = img.convert("L").resize((width, height), resample=_nearest_resample())
    arr = np.asarray(img, dtype=np.float32)
    if arr.ndim != 2:
        raise VeggieInferenceError("invalid_image_shape")
    arr = np.expand_dims(arr, axis=-1)  # HWC with C=1
    return np.expand_dims(arr, axis=0)  # BHWC


def _format_topk(probabilities: np.ndarray, *, k: int = 3) -> list[dict[str, Any]]:
    probabilities = np.asarray(probabilities, dtype=np.float32).reshape(-1)
    idx = np.argsort(-probabilities)[:k]
    out: list[dict[str, Any]] = []
    for i in idx:
        ii = int(i)
        label = CLASS_NAMES[ii] if 0 <= ii < len(CLASS_NAMES) else str(ii)
        out.append({"index": ii, "label": label, "score": float(probabilities[ii])})
    return out


def predict_veggie_tfserving(
    *,
    base_url: str,
    model_resolution: str,
    image_bhwc: np.ndarray,
    timeout_seconds: float = 60,
) -> VeggiePrediction:
    if model_resolution not in {"23", "101"}:
        raise VeggieInferenceError("invalid_model_resolution")

    model_name = f"vege_classifier_{model_resolution}"
    url = f"{base_url.rstrip('/')}/v1/models/{model_name}:predict"

    try:
        instance = image_bhwc.tolist()[0]
    except Exception as exc:  # noqa: BLE001
        raise VeggieInferenceError("invalid_preprocessed_image") from exc

    payload = {"signature_name": "serving_default", "instances": [{"image": instance}]}

    t0 = time.perf_counter()
    try:
        r = _SESSION.post(url, json=payload, timeout=(5, timeout_seconds))
        latency_ms = (time.perf_counter() - t0) * 1000
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as exc:
        raise VeggieInferenceError("inference_service_unavailable") from exc
    except ValueError as exc:
        raise VeggieInferenceError("inference_bad_response") from exc

    try:
        probs = np.asarray(data["predictions"], dtype=np.float32)[0]
    except Exception as exc:  # noqa: BLE001
        raise VeggieInferenceError("inference_bad_response") from exc

    pred_idx = int(np.argmax(probs))
    pred_label = CLASS_NAMES[pred_idx] if 0 <= pred_idx < len(CLASS_NAMES) else str(pred_idx)
    pred_prob = float(probs[pred_idx])
    return VeggiePrediction(
        model=model_resolution,
        label=pred_label,
        confidence=pred_prob,
        topk=_format_topk(probs, k=3),
        latency_ms=float(latency_ms),
    )

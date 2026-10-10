# -*- coding: utf-8 -*-
"""
Vision transcription for scanned PDF pages and uploaded images.

Provider resolution (first match wins):
1. VISION_API_KEY (+ optional VISION_BASE_URL, VISION_MODEL)
2. OPENROUTER_API_KEY -> https://openrouter.ai/api/v1, qwen/qwen2.5-vl-72b-instruct
3. OPENAI_API_KEY     -> OpenAI, gpt-4o-mini
4. none               -> vision is skipped and the caller tells the user why

All providers are called through the OpenAI-compatible SDK. Calls are bounded
by a concurrency semaphore, a per-page timeout, and a page cap.
"""

import asyncio
import base64
import io
import logging
import os
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_DEFAULT_MODEL = "qwen/qwen2.5-vl-72b-instruct"
OPENAI_DEFAULT_MODEL = "gpt-4o-mini"

NO_VISION_MESSAGE = (
    "This file has scanned or image-only pages, but image reading is not "
    "configured on this server, so those pages could not be read."
)

TRANSCRIBE_PROMPT = (
    "Transcribe all readable text on this document page exactly as written, in "
    "reading order. Keep headings, lists and table rows on separate lines. "
    "Describe charts or figures in one short sentence only if they carry "
    "information. Output only the transcription, with no commentary. If the page "
    "has no readable content, output nothing."
)


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def max_vision_pages() -> int:
    return max(1, _int_env("VISION_MAX_PAGES", 10))


def max_concurrency() -> int:
    return max(1, _int_env("VISION_MAX_CONCURRENCY", 3))


def page_timeout_seconds() -> float:
    return max(1.0, _float_env("VISION_TIMEOUT_SECONDS", 45.0))


def min_text_chars() -> int:
    """Pages with fewer extracted characters than this are treated as scanned."""
    return max(0, _int_env("VISION_MIN_TEXT_CHARS", 25))


@dataclass(frozen=True)
class VisionProvider:
    name: str
    api_key: str
    base_url: Optional[str]
    model: str

    def __repr__(self) -> str:  # never print the key
        return f"VisionProvider(name={self.name!r}, base_url={self.base_url!r}, model={self.model!r})"


def resolve_vision_provider(env: Optional[Mapping[str, str]] = None) -> Optional[VisionProvider]:
    env = os.environ if env is None else env
    get = lambda key: (env.get(key) or "").strip()  # noqa: E731

    if get("VISION_API_KEY"):
        return VisionProvider(
            name="custom",
            api_key=get("VISION_API_KEY"),
            base_url=get("VISION_BASE_URL") or None,
            model=get("VISION_MODEL") or OPENAI_DEFAULT_MODEL,
        )
    if get("OPENROUTER_API_KEY"):
        return VisionProvider(
            name="openrouter",
            api_key=get("OPENROUTER_API_KEY"),
            base_url=OPENROUTER_BASE_URL,
            model=get("VISION_MODEL") or OPENROUTER_DEFAULT_MODEL,
        )
    if get("OPENAI_API_KEY"):
        return VisionProvider(
            name="openai",
            api_key=get("OPENAI_API_KEY"),
            base_url=None,
            model=get("VISION_MODEL") or OPENAI_DEFAULT_MODEL,
        )
    return None


def make_client(provider: VisionProvider) -> Any:
    from openai import AsyncOpenAI

    kwargs: dict = {
        "api_key": provider.api_key,
        "timeout": page_timeout_seconds(),
        "max_retries": 1,
    }
    if provider.base_url:
        kwargs["base_url"] = provider.base_url
    return AsyncOpenAI(**kwargs)


# ---------------------------------------------------------------------------
# Image preparation
# ---------------------------------------------------------------------------
MAX_IMAGE_SIDE = 1600


def _to_jpeg_data_url(image: Any) -> str:
    """Downscale a PIL image and encode it as a base64 JPEG data URL."""
    from PIL import Image

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def image_bytes_to_data_url(content: bytes) -> str:
    """Validate an uploaded PNG/JPEG and return a normalized JPEG data URL."""
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs
    with Image.open(io.BytesIO(content)) as image:
        if image.format not in {"PNG", "JPEG"}:
            raise ValueError("Only PNG and JPEG images are supported.")
        image.load()
        return _to_jpeg_data_url(image)


def render_pdf_pages(content: bytes, page_numbers: Iterable[int], scale: float = 1.5) -> dict[int, str]:
    """Render the given 1-based PDF pages to JPEG data URLs."""
    import pypdfium2 as pdfium

    rendered: dict[int, str] = {}
    pdf = pdfium.PdfDocument(content)
    try:
        for page_number in page_numbers:
            page = pdf[page_number - 1]
            try:
                bitmap = page.render(scale=scale)
                rendered[page_number] = _to_jpeg_data_url(bitmap.to_pil())
            finally:
                page.close()
    finally:
        pdf.close()
    return rendered


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------
async def _transcribe_one(client: Any, provider: VisionProvider, data_url: str, timeout: float) -> str:
    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=provider.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": TRANSCRIBE_PROMPT},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            max_tokens=1500,
            temperature=0,
        ),
        timeout=timeout,
    )
    return (response.choices[0].message.content or "").strip()


async def transcribe_pages(
    images: Mapping[int, str],
    provider: VisionProvider,
    client: Any = None,
) -> tuple[dict[int, str], list[int]]:
    """
    Transcribe page images concurrently.

    Args:
        images: {page_number: data_url}
        provider: resolved vision provider
        client: optional OpenAI-compatible async client (injected in tests)

    Returns:
        (texts by page, list of pages that failed)
    """
    if not images:
        return {}, []
    client = client or make_client(provider)
    semaphore = asyncio.Semaphore(max_concurrency())
    timeout = page_timeout_seconds()

    async def run(page_number: int, data_url: str) -> tuple[int, Optional[str]]:
        async with semaphore:
            try:
                return page_number, await _transcribe_one(client, provider, data_url, timeout)
            except Exception as exc:  # one bad page must not sink the upload
                logger.warning("Vision transcription failed for page %s: %s", page_number, type(exc).__name__)
                return page_number, None

    results = await asyncio.gather(*(run(page, url) for page, url in sorted(images.items())))
    texts = {page: text for page, text in results if text}
    failed = [page for page, text in results if text is None]
    return texts, failed

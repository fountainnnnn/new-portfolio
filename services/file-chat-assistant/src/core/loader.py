# -*- coding: utf-8 -*-
"""
Document loader for the document QA API.

- Supports PDF, DOCX, TXT, PNG and JPEG uploads, parsed from memory (no temp files).
- Returns per-page text so page numbers survive into retrieval and citations.
- PDF pages with little or no text layer, and uploaded images, are transcribed
  with a vision model when one is configured (see vision.py).
"""

import asyncio
import io
import logging
import os
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Optional

from . import vision

logger = logging.getLogger(__name__)

MAX_TEXT_CHARS = int(os.getenv("FILE_CHAT_MAX_TEXT_CHARS", "180000"))
MAX_PDF_PAGES = int(os.getenv("FILE_CHAT_MAX_PDF_PAGES", "300"))

DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".txt"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
ALLOWED_EXTENSIONS = DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS

_UNSET: Any = object()


class DocumentError(ValueError):
    """A user-facing problem with the uploaded file (maps to HTTP 4xx)."""


@dataclass
class LoadedDocument:
    kind: str
    pages: list[dict] = field(default_factory=list)  # [{"page": int | None, "text": str}]
    page_count: int = 0
    scanned_pages: list[int] = field(default_factory=list)
    vision_pages: list[int] = field(default_factory=list)
    notices: list[str] = field(default_factory=list)


def sanitize_filename(filename: Optional[str], max_length: int = 120) -> str:
    """Basename only, no control/path characters, bounded length. For display/logging only."""
    name = (filename or "").replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFKC", name)
    name = "".join(ch for ch in name if ch.isprintable())
    name = re.sub(r"[^\w.\- ()\[\]]+", "_", name).strip(" .")
    if not name:
        return "document"
    if len(name) > max_length:
        stem, dot, ext = name.rpartition(".")
        name = (stem[: max_length - len(ext) - 1] + "." + ext) if dot and len(ext) <= 8 else name[:max_length]
    return name


def detect_kind(filename: Optional[str], content: bytes) -> str:
    """Check the extension and that the bytes match it. Returns pdf/docx/txt/image."""
    suffix = os.path.splitext(filename or "")[-1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise DocumentError("Upload a PDF, DOCX, TXT, PNG or JPG file.")
    head = content[:8]
    if suffix == ".pdf":
        if b"%PDF-" not in content[:1024]:
            raise DocumentError("This file does not look like a valid PDF.")
        return "pdf"
    if suffix == ".docx":
        if not head.startswith(b"PK\x03\x04"):
            raise DocumentError("This file does not look like a valid DOCX document.")
        return "docx"
    if suffix == ".png":
        if not head.startswith(b"\x89PNG\r\n\x1a\n"):
            raise DocumentError("This file does not look like a valid PNG image.")
        return "image"
    if suffix in {".jpg", ".jpeg"}:
        if not head.startswith(b"\xff\xd8\xff"):
            raise DocumentError("This file does not look like a valid JPEG image.")
        return "image"
    # .txt
    if b"\x00" in content[:4096]:
        raise DocumentError("This file does not look like a plain text file.")
    return "txt"


def _clean(text: str) -> str:
    text = (text or "").replace("\x00", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_pdf_pages(content: bytes) -> tuple[list[tuple[int, str]], int]:
    """Return ([(page_number, text), ...] for the first MAX_PDF_PAGES pages, total page count)."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise DocumentError("This PDF is password protected.")
        total = len(reader.pages)
        pages: list[tuple[int, str]] = []
        for index, page in enumerate(reader.pages[:MAX_PDF_PAGES]):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            pages.append((index + 1, _clean(text)))
        return pages, total
    except DocumentError:
        raise
    except Exception as exc:
        logger.warning("PDF parse failed: %s", type(exc).__name__)
        raise DocumentError("Could not read this PDF. It may be damaged.")


def extract_docx_text(content: bytes) -> str:
    import docx2txt

    try:
        return _clean(docx2txt.process(io.BytesIO(content)))
    except Exception as exc:
        logger.warning("DOCX parse failed: %s", type(exc).__name__)
        raise DocumentError("Could not read this DOCX file. It may be damaged.")


def extract_txt_text(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16"):
        try:
            return _clean(content.decode(encoding))
        except UnicodeDecodeError:
            continue
    return _clean(content.decode("latin-1"))


def _format_pages(pages: list[int]) -> str:
    if len(pages) <= 8:
        return ", ".join(str(p) for p in pages)
    return ", ".join(str(p) for p in pages[:8]) + f" and {len(pages) - 8} more"


def _cap_text(pages: list[dict]) -> list[dict]:
    remaining = MAX_TEXT_CHARS
    capped: list[dict] = []
    for page in pages:
        if remaining <= 0:
            break
        text = page["text"][:remaining]
        remaining -= len(text)
        capped.append({**page, "text": text})
    return capped


async def load_document(
    filename: Optional[str],
    content: bytes,
    vision_provider: Any = _UNSET,
    vision_client: Any = None,
) -> LoadedDocument:
    """
    Parse an upload into per-page text.

    Args:
        filename: original upload name (only the extension is used)
        content: file bytes
        vision_provider: VisionProvider, None to disable vision, or unset to resolve from env
        vision_client: optional OpenAI-compatible async client (tests)
    """
    kind = detect_kind(filename, content)
    provider = vision.resolve_vision_provider() if vision_provider is _UNSET else vision_provider
    doc = LoadedDocument(kind=kind)

    if kind == "image":
        if provider is None:
            raise DocumentError(
                "Image uploads need a vision model, and image reading is not configured "
                "on this server. Upload a PDF, DOCX or TXT file with a text layer instead."
            )
        try:
            data_url = await asyncio.to_thread(vision.image_bytes_to_data_url, content)
        except Exception:
            raise DocumentError("Could not read this image. Upload a valid PNG or JPEG file.")
        texts, failed = await vision.transcribe_pages({1: data_url}, provider, vision_client)
        if failed:
            raise DocumentError("The image could not be read right now. Please try again.")
        doc.page_count = 1
        doc.scanned_pages = [1]
        doc.vision_pages = [1] if texts.get(1) else []
        doc.pages = [{"page": 1, "text": _clean(texts.get(1, ""))}]

    elif kind == "pdf":
        raw_pages, total = await asyncio.to_thread(extract_pdf_pages, content)
        doc.page_count = total
        if total > len(raw_pages):
            doc.notices.append(f"Only the first {len(raw_pages)} of {total} pages were read.")
        threshold = vision.min_text_chars()
        page_texts = dict(raw_pages)
        doc.scanned_pages = [page for page, text in raw_pages if len(text) < threshold]

        if doc.scanned_pages:
            if provider is None:
                doc.notices.append(
                    f"{vision.NO_VISION_MESSAGE} Pages: {_format_pages(doc.scanned_pages)}."
                )
            else:
                cap = vision.max_vision_pages()
                to_read, skipped = doc.scanned_pages[:cap], doc.scanned_pages[cap:]
                try:
                    images = await asyncio.to_thread(vision.render_pdf_pages, content, to_read)
                except Exception as exc:
                    logger.warning("PDF render failed: %s", type(exc).__name__)
                    images = {}
                texts, failed = await vision.transcribe_pages(images, provider, vision_client)
                failed = sorted(set(failed) | (set(to_read) - set(images)))
                for page, text in texts.items():
                    cleaned = _clean(text)
                    if len(cleaned) > len(page_texts.get(page, "")):
                        page_texts[page] = cleaned
                        doc.vision_pages.append(page)
                doc.vision_pages.sort()
                if skipped:
                    doc.notices.append(
                        f"Only the first {cap} scanned pages were transcribed. "
                        f"Skipped pages: {_format_pages(skipped)}."
                    )
                if failed:
                    doc.notices.append(f"Some scanned pages could not be read: {_format_pages(failed)}.")

        doc.pages = [{"page": page, "text": page_texts[page]} for page, _ in raw_pages]

    elif kind == "docx":
        doc.page_count = 1
        doc.pages = [{"page": None, "text": await asyncio.to_thread(extract_docx_text, content)}]

    else:  # txt
        doc.page_count = 1
        doc.pages = [{"page": None, "text": extract_txt_text(content)}]

    doc.pages = _cap_text([page for page in doc.pages if page["text"]])
    if not doc.pages:
        if doc.scanned_pages and provider is None:
            raise DocumentError(
                "This file has no text layer (it looks scanned), and image reading is not "
                "configured on this server, so it cannot be read."
            )
        raise DocumentError("No readable text was extracted from the document.")
    return doc

import os
import sys
from types import SimpleNamespace

import pytest

SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVICE_ROOT not in sys.path:
    sys.path.insert(0, SERVICE_ROOT)

PROVIDER_ENV = ("VISION_API_KEY", "VISION_BASE_URL", "VISION_MODEL", "OPENROUTER_API_KEY", "OPENAI_API_KEY")


def make_pdf(page_texts):
    """Build a small valid PDF. A None/'' entry produces a page with no text layer (looks scanned)."""
    objects = []
    kids = []
    font_id = 3
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(None)  # pages placeholder
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for text in page_texts:
        lines = (text or "").split("\n")
        ops = ["BT", "/F1 11 Tf", "14 TL", "50 780 Td"]
        for line in lines:
            if line:
                safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
                ops.append(f"({safe}) Tj")
            ops.append("T*")
        ops.append("ET")
        stream = "\n".join(ops).encode("latin-1") if text else b""
        objects.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        content_id = len(objects)
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>"
            % (font_id, content_id)
        )
        kids.append(len(objects))
    objects[1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (
        b" ".join(b"%d 0 R" % k for k in kids), len(kids))
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % index + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def make_png():
    import io
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buffer, format="PNG")
    return buffer.getvalue()


class FakeChatClient:
    """Sync OpenAI-compatible fake for the DeepSeek chat call."""

    def __init__(self, answer):
        self.answer = answer
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(content=self.answer)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeVisionClient:
    """Async OpenAI-compatible fake for the vision call."""

    def __init__(self, text="", fail_pages=()):
        self.text = text
        self.calls = []
        self.fail = bool(fail_pages)
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise TimeoutError("simulated")
        message = SimpleNamespace(content=self.text)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in PROVIDER_ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "server-test-key")
    yield


@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient
    import app as app_module

    app_module.RATE_BUCKETS.clear()
    app_module.session_store.clear()
    return TestClient(app_module.app)

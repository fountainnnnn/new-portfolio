import asyncio
import os

import pytest

from conftest import FakeChatClient, FakeVisionClient, make_pdf, make_png
from src.core import loader, qa_chain, vision
from src.core.sessions import SessionStore

PAGE_ONE = "Introduction to the handbook.\nThe office opens at nine."
PAGE_TWO = "Refund policy.\nRefunds are processed within fourteen days of the request."


def _upload(client, filename, content, **form):
    return client.post("/upload", files={"file": (filename, content)}, data=form)


# ---------------------------------------------------------------- key handling
def test_form_key_is_passed_explicitly_and_not_written_to_environ(client, monkeypatch):
    seen = {}

    def fake_make_client(api_key, base_url=None):
        seen["key"] = api_key
        return FakeChatClient("ok [p. 1]")

    monkeypatch.setattr(qa_chain, "make_client", fake_make_client)
    before = dict(os.environ)
    resp = _upload(client, "notes.pdf", make_pdf([PAGE_ONE]), openai_api_key="user-key-123")
    assert resp.status_code == 200, resp.text
    assert seen["key"] == "user-key-123"
    assert os.environ.get("DEEPSEEK_API_KEY") == "server-test-key"
    assert dict(os.environ) == before


def test_server_key_used_when_form_key_missing(client, monkeypatch):
    seen = {}
    monkeypatch.setattr(qa_chain, "make_client", lambda api_key, base_url=None: seen.setdefault("key", api_key) and FakeChatClient("x"))
    resp = _upload(client, "notes.txt", PAGE_ONE.encode())
    assert resp.status_code == 200, resp.text
    assert seen["key"] == "server-test-key"


def test_missing_key_returns_400(client, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY")
    resp = _upload(client, "notes.txt", PAGE_ONE.encode())
    assert resp.status_code == 400
    assert "API key" in resp.json()["message"]


def test_get_qa_chain_requires_explicit_key(monkeypatch):
    with pytest.raises(RuntimeError):
        qa_chain.get_qa_chain([{"page": 1, "text": "hello world"}], api_key=None)


def test_no_debug_key_prints_in_app_source():
    import app as app_module

    source = open(app_module.__file__, encoding="utf-8").read()
    assert "print(" not in source
    assert "os.environ[" not in source


# ---------------------------------------------------------------- upload validation
def test_rejects_unsupported_extension(client):
    assert _upload(client, "evil.exe", b"MZ....").status_code == 400


def test_rejects_content_that_does_not_match_extension(client):
    resp = _upload(client, "fake.pdf", b"not a pdf at all")
    assert resp.status_code == 422
    assert "PDF" in resp.json()["detail"]


def test_rejects_oversized_upload(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "MAX_UPLOAD_BYTES", 1024)
    resp = _upload(client, "big.txt", b"a" * 4096)
    assert resp.status_code == 413


def test_filename_is_sanitized(client, monkeypatch):
    monkeypatch.setattr(qa_chain, "make_client", lambda api_key, base_url=None: FakeChatClient("x"))
    resp = _upload(client, "../../etc/<script>pass wd.txt", PAGE_ONE.encode())
    assert resp.status_code == 200, resp.text
    name = resp.json()["filename"]
    assert "/" not in name and "<" not in name and ".." not in name
    assert loader.sanitize_filename("\x00\x07") == "document"


# ---------------------------------------------------------------- page metadata
def test_page_metadata_survives_splitting():
    long_page = " ".join(f"Sentence {i} about the refund policy." for i in range(200))
    chunks = qa_chain.split_pages([{"page": 1, "text": "Short intro."}, {"page": 7, "text": long_page}])
    assert len(chunks) > 2
    assert chunks[0].metadata["page"] == 1
    later = [c for c in chunks if c.metadata["page"] == 7]
    assert len(later) >= 2
    assert all(c.metadata["label"] == "p. 7" for c in later)
    selected = qa_chain.select_context("refund policy", chunks)
    assert all(c.metadata["page"] == 7 for c in selected)


def test_pdf_loader_keeps_page_numbers():
    doc = asyncio.run(loader.load_document("x.pdf", make_pdf([PAGE_ONE, PAGE_TWO]), vision_provider=None))
    assert [p["page"] for p in doc.pages] == [1, 2]
    assert "fourteen days" in doc.pages[1]["text"]
    assert doc.scanned_pages == []


# ---------------------------------------------------------------- citations
def test_ask_returns_page_citations(client, monkeypatch):
    fake = FakeChatClient("Refunds take fourteen days [p. 2]. Unknown label [p. 99].")
    monkeypatch.setattr(qa_chain, "make_client", lambda api_key, base_url=None: fake)
    session_id = _upload(client, "handbook.pdf", make_pdf([PAGE_ONE, PAGE_TWO])).json()["session_id"]

    resp = client.post("/ask", data={"session_id": session_id, "question": "How long do refunds take?"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["answer"].startswith("Refunds take fourteen days [p. 2]")
    assert "context" in body
    assert body["citations"] == [
        {"page": 2, "label": "p. 2", "snippet": body["citations"][0]["snippet"]}
    ]
    assert "fourteen days" in body["citations"][0]["snippet"]
    prompt = fake.calls[0]["messages"][1]["content"]
    assert "[p. 2]" in prompt
    assert "cite" in fake.calls[0]["messages"][0]["content"].lower()


def test_text_documents_use_part_labels():
    chain = qa_chain.get_qa_chain([{"page": None, "text": PAGE_TWO}], client=FakeChatClient("Fourteen days [part 1]."))
    result = chain("refund days")
    assert result["citations"][0]["page"] is None
    assert result["citations"][0]["label"] == "part 1"


def test_ask_unknown_session_404(client):
    assert client.post("/ask", data={"session_id": "nope", "question": "hi"}).status_code == 404


# ---------------------------------------------------------------- vision path
def test_provider_resolution_order():
    assert vision.resolve_vision_provider({}) is None
    p = vision.resolve_vision_provider({"OPENAI_API_KEY": "o"})
    assert (p.name, p.base_url, p.model) == ("openai", None, "gpt-4o-mini")
    p = vision.resolve_vision_provider({"OPENAI_API_KEY": "o", "OPENROUTER_API_KEY": "r"})
    assert (p.name, p.base_url, p.model) == ("openrouter", "https://openrouter.ai/api/v1", "qwen/qwen2.5-vl-72b-instruct")
    p = vision.resolve_vision_provider({"OPENROUTER_API_KEY": "r", "VISION_API_KEY": "sk-secret-vision", "VISION_BASE_URL": "https://x/v1", "VISION_MODEL": "m"})
    assert (p.name, p.api_key, p.base_url, p.model) == ("custom", "sk-secret-vision", "https://x/v1", "m")
    assert "sk-secret-vision" not in repr(p)


def test_scanned_pdf_page_is_transcribed_with_vision(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "router-test-key")
    fake_vision = FakeVisionClient("Scanned receipt. Total paid was 42 dollars.")
    seen = {}

    def fake_make_client(provider):
        seen["provider"] = provider
        return fake_vision

    monkeypatch.setattr(vision, "make_client", fake_make_client)
    chat = FakeChatClient("The total was 42 dollars [p. 2].")
    monkeypatch.setattr(qa_chain, "make_client", lambda api_key, base_url=None: chat)

    resp = _upload(client, "scan.pdf", make_pdf([PAGE_ONE, None]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["scanned_pages"] == [2]
    assert body["vision_pages"] == [2]
    assert body["notices"] == []
    assert seen["provider"].model == "qwen/qwen2.5-vl-72b-instruct"
    assert len(fake_vision.calls) == 1
    image_part = fake_vision.calls[0]["messages"][0]["content"][1]
    assert image_part["image_url"]["url"].startswith("data:image/jpeg;base64,")

    answer = client.post("/ask", data={"session_id": body["session_id"], "question": "What was the total paid?"}).json()
    assert answer["citations"][0]["page"] == 2
    assert "42 dollars" in answer["citations"][0]["snippet"]


def test_vision_page_cap_and_failures_are_reported(monkeypatch):
    monkeypatch.setenv("VISION_MAX_PAGES", "1")
    provider = vision.VisionProvider("openai", "k", None, "gpt-4o-mini")
    doc = asyncio.run(loader.load_document(
        "scan.pdf", make_pdf([PAGE_ONE, None, None]), vision_provider=provider,
        vision_client=FakeVisionClient(fail_pages=(2,)),
    ))
    assert doc.scanned_pages == [2, 3]
    assert doc.vision_pages == []
    assert any("Skipped pages: 3" in n for n in doc.notices)
    assert any("could not be read: 2" in n for n in doc.notices)


def test_image_upload_uses_vision(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "openai-test-key")
    monkeypatch.setattr(vision, "make_client", lambda provider: FakeVisionClient("Whiteboard: deadline is Friday."))
    monkeypatch.setattr(qa_chain, "make_client", lambda api_key, base_url=None: FakeChatClient("Friday [p. 1]."))
    resp = _upload(client, "board.png", make_png())
    assert resp.status_code == 200, resp.text
    assert resp.json()["kind"] == "image"
    assert resp.json()["vision_pages"] == [1]


# ---------------------------------------------------------------- no vision key fallback
def test_partially_scanned_pdf_without_vision_key_gets_notice(client, monkeypatch):
    monkeypatch.setattr(qa_chain, "make_client", lambda api_key, base_url=None: FakeChatClient("x"))
    resp = _upload(client, "mixed.pdf", make_pdf([PAGE_ONE, None]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["scanned_pages"] == [2]
    assert body["vision_pages"] == []
    assert any("image reading is not configured" in n and "Pages: 2" in n for n in body["notices"])


def test_fully_scanned_pdf_without_vision_key_is_rejected_clearly(client):
    resp = _upload(client, "scan.pdf", make_pdf([None, None]))
    assert resp.status_code == 422
    assert "image reading is not configured" in resp.json()["detail"]


def test_image_without_vision_key_is_rejected_clearly(client):
    resp = _upload(client, "photo.png", make_png())
    assert resp.status_code == 422
    assert "not configured" in resp.json()["detail"]


# ---------------------------------------------------------------- sessions
def test_session_ttl_expires_idle_sessions():
    now = [1000.0]
    store = SessionStore(ttl_seconds=60, max_sessions=10, clock=lambda: now[0])
    store.create("a", {"chain": None})
    now[0] += 59
    assert store.get("a") is not None  # access refreshes last_used
    now[0] += 59
    assert store.get("a") is not None
    now[0] += 61
    assert store.get("a") is None
    assert len(store) == 0


def test_session_store_caps_and_evicts_least_recent():
    now = [0.0]
    store = SessionStore(ttl_seconds=3600, max_sessions=2, clock=lambda: now[0])
    store.create("a", {})
    store.create("b", {})
    store.get("a")  # a is now most recent
    store.create("c", {})
    assert "b" not in store
    assert "a" in store and "c" in store


def test_healthz(client):
    assert client.get("/healthz").json() == {"ok": True}


def test_docx_is_parsed_from_memory():
    import io
    import zipfile

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr(
            "word/document.xml",
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body><w:p><w:r><w:t>Docx refund window is thirty days.</w:t></w:r></w:p></w:body></w:document>",
        )
    doc = asyncio.run(loader.load_document("a.docx", buffer.getvalue(), vision_provider=None))
    assert doc.pages == [{"page": None, "text": "Docx refund window is thirty days."}]

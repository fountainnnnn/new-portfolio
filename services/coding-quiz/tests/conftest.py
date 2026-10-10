import json
import os
import sys
from types import SimpleNamespace

import pytest

SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVICE_ROOT not in sys.path:
    sys.path.insert(0, SERVICE_ROOT)

SAMPLE_QUESTIONS = [
    {
        "type": "mcq",
        "topic": "loops",
        "question": "Which loop runs exactly three times?",
        "options": ["for i in range(3):", "for i in range(4):", "while True:"],
        "code_with_blanks": None,
        "answer": "for i in range(3):",
        "explanation": "range(3) yields 0, 1 and 2, so the body runs three times in total.",
        "hint": "Count the values the range produces, starting from zero.",
    },
    {
        "type": "fill_code",
        "topic": "functions",
        "question": "Complete the function so it returns the sum.",
        "options": None,
        "code_with_blanks": "def add(a, b):\n    ___ a + b",
        "answer": ["return"],
        "explanation": "A function sends a value back to its caller with the return keyword.",
        "hint": "Which keyword hands a value back to the caller?",
    },
    {
        "type": "drag_drop",
        "topic": "arrays",
        "question": "Order the lines to print every item.",
        "options": None,
        "code_with_blanks": None,
        "answer": ["items = [1, 2]", "for x in items:", "    print(x)"],
        "explanation": "The list must exist before the loop, and printing happens inside the loop body.",
        "hint": "The thing being looped over has to exist first.",
    },
]


class FakeAsyncClient:
    def __init__(self, questions):
        self.questions = questions
        self.calls = 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self.calls += 1
        content = json.dumps({"questions": self.questions})
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.fixture
def fake_llm(monkeypatch):
    from src.core import openai_qg

    fake = FakeAsyncClient(SAMPLE_QUESTIONS)
    monkeypatch.setattr(openai_qg, "_client", fake)
    monkeypatch.setenv("CODING_QUIZ_BATCH_SIZE", "5")
    return fake


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    import app as app_module

    app_module.RATE_BUCKETS.clear()
    app_module.SESSION_STORE.clear()
    return TestClient(app_module.app)


@pytest.fixture
def quiz(client, fake_llm):
    resp = client.post("/generate_questions", json={"language": "python", "topic": "mixed", "difficulty": "easy", "n": 3})
    assert resp.status_code == 200, resp.text
    return resp.json()

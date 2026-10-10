import json
import time

import app as app_module
from conftest import SAMPLE_QUESTIONS


def _by_type(quiz, qtype):
    return next(q for q in quiz["questions"] if q["type"] == qtype)


# ---------------------------------------------------------------- hints never leak
def test_generate_response_has_no_hint_answer_or_explanation(quiz):
    raw = json.dumps(quiz)
    assert len(quiz["questions"]) == 3
    for item in SAMPLE_QUESTIONS:
        assert item["hint"] not in raw
        assert item["explanation"] not in raw
    for q in quiz["questions"]:
        assert set(q) == {"question_id", "type", "question", "options", "code_with_blanks", "topic", "has_hint"}
        assert q["has_hint"] is True
    assert {q["topic"] for q in quiz["questions"]} == {"loops", "functions", "arrays"}


def test_hint_endpoint_returns_hint_and_records_use(client, quiz):
    q = _by_type(quiz, "mcq")
    resp = client.post("/hint", json={"session_id": quiz["session_id"], "question_id": q["question_id"]})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["hint"] == "Count the values the range produces, starting from zero."
    assert body["hints_used"] == 1
    assert "answer" not in body and "explanation" not in body
    record = app_module.SESSION_STORE[quiz["session_id"]]["questions"][q["question_id"]]
    assert record["hint_used"] is True

    check = client.post("/check_answer", json={"session_id": quiz["session_id"], "question_id": q["question_id"], "user_answer": "for i in range(3):"})
    assert check.json()["hint_used"] is True


def test_hint_unknown_question_404(client, quiz):
    resp = client.post("/hint", json={"session_id": quiz["session_id"], "question_id": "missing"})
    assert resp.status_code == 404


def test_leaky_hint_is_replaced_with_safe_fallback():
    from src.core.openai_qg import FALLBACK_HINTS, _clean_hint

    assert _clean_hint("The answer is for i in range(3): obviously", "mcq", ["for i in range(3):"]) == FALLBACK_HINTS["mcq"]
    assert _clean_hint("", "drag_drop", ["a"]) == FALLBACK_HINTS["drag_drop"]
    assert _clean_hint("Think about zero-based counting.", "mcq", ["range(3)"]) == "Think about zero-based counting."


# ---------------------------------------------------------------- explanations only after answering
def test_explanation_only_returned_after_answer(client, quiz):
    q = _by_type(quiz, "fill_code")
    # Not obtainable before answering: not in generate (above) and not from /hint.
    hint = client.post("/hint", json={"session_id": quiz["session_id"], "question_id": q["question_id"]}).json()
    assert "return keyword" not in json.dumps(hint)

    resp = client.post("/check_answer", json={"session_id": quiz["session_id"], "question_id": q["question_id"], "user_answer": ["return"]})
    body = resp.json()
    assert resp.status_code == 200
    assert body["correct"] is True and body["first_try"] is True
    assert body["expected"] == ["return"] and body["correct_answer"] == ["return"]
    assert "return keyword" in body["explanation"]
    assert body["attempts"] == 1


def test_wrong_answer_then_correct(client, quiz):
    q = _by_type(quiz, "mcq")
    payload = {"session_id": quiz["session_id"], "question_id": q["question_id"]}
    wrong = client.post("/check_answer", json={**payload, "user_answer": "while True:"}).json()
    assert wrong["correct"] is False and wrong["first_try"] is False
    right = client.post("/check_answer", json={**payload, "user_answer": "For i in range(3):"}).json()
    assert right["correct"] is True and right["attempts"] == 2 and right["first_try"] is False


# ---------------------------------------------------------------- end of quiz review
def test_end_quiz_summary(client, quiz):
    sid = quiz["session_id"]
    mcq, fill, drag = (_by_type(quiz, t) for t in ("mcq", "fill_code", "drag_drop"))
    client.post("/hint", json={"session_id": sid, "question_id": fill["question_id"]})
    client.post("/check_answer", json={"session_id": sid, "question_id": mcq["question_id"], "user_answer": "for i in range(3):"})
    client.post("/check_answer", json={"session_id": sid, "question_id": fill["question_id"], "user_answer": ["yield"]})
    client.post("/check_answer", json={"session_id": sid, "question_id": fill["question_id"], "user_answer": ["return"]})
    # drag_drop left unanswered

    resp = client.post(f"/end_quiz?session_id={sid}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok"
    assert body["score"]["total_questions"] == 3
    assert body["score"]["wrong_first_try"] == 1
    assert body["score"]["correct_first_try"] == 1
    assert body["score"]["answered"] == 2 and body["score"]["unanswered"] == 1
    assert body["hints_used"] == 1
    topics = {t["topic"]: t for t in body["by_topic"]}
    assert topics["loops"]["accuracy"] == 1.0
    assert topics["functions"]["hints_used"] == 1 and topics["functions"]["correct_first_try"] == 0
    assert body["weak_areas"] == ["functions"]  # arrays was skipped, not failed
    assert topics["arrays"]["answered"] == 0
    assert len(body["review"]) == 3
    assert sid not in app_module.SESSION_STORE


def test_end_quiz_accepts_json_body_and_404s_after(client, quiz):
    sid = quiz["session_id"]
    assert client.post("/end_quiz", json={"session_id": sid}).status_code == 200
    assert client.post("/end_quiz", json={"session_id": sid}).status_code == 404


# ---------------------------------------------------------------- security limits
def test_oversized_code_answer_rejected(client, quiz):
    q = _by_type(quiz, "fill_code")
    resp = client.post("/check_answer", json={"session_id": quiz["session_id"], "question_id": q["question_id"], "user_answer": ["x" * 5000]})
    assert resp.status_code == 422
    assert "body" not in resp.json()  # request body is not echoed back


def test_oversized_body_rejected(client, quiz, monkeypatch):
    monkeypatch.setattr(app_module, "MAX_BODY_BYTES", 100)
    q = _by_type(quiz, "mcq")
    resp = client.post("/check_answer", json={"session_id": quiz["session_id"], "question_id": q["question_id"], "user_answer": "y" * 500})
    assert resp.status_code == 413


def test_session_ttl_expires(client, quiz, monkeypatch):
    sid = quiz["session_id"]
    app_module.SESSION_STORE[sid]["created_at"] = time.time() - app_module.SESSION_TTL_SECONDS - 5
    q = _by_type(quiz, "mcq")
    resp = client.post("/check_answer", json={"session_id": sid, "question_id": q["question_id"], "user_answer": "x"})
    assert resp.status_code == 404
    assert sid not in app_module.SESSION_STORE


def test_session_cap_evicts_oldest(client, fake_llm, monkeypatch):
    monkeypatch.setattr(app_module, "MAX_SESSIONS", 2)
    payload = {"language": "python", "topic": "loops", "difficulty": "easy", "n": 3}
    ids = [client.post("/generate_questions", json=payload).json()["session_id"] for _ in range(3)]
    assert len(app_module.SESSION_STORE) == 2
    assert ids[0] not in app_module.SESSION_STORE
    # single-topic quizzes label every question with the requested topic
    assert all(q["topic"] == "loops" for q in app_module.SESSION_STORE[ids[2]]["questions"].values())


def test_cors_only_allows_portfolio_origin(client):
    ok = client.options("/check_answer", headers={"Origin": "https://ngyuhang.com", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "https://ngyuhang.com"
    bad = client.options("/check_answer", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert bad.headers.get("access-control-allow-origin") is None


def test_hint_rate_limited(client, quiz, monkeypatch):
    monkeypatch.setitem(app_module.RATE_LIMITS, ("POST", "/hint"), (2, 60))
    q = _by_type(quiz, "mcq")
    payload = {"session_id": quiz["session_id"], "question_id": q["question_id"]}
    codes = [client.post("/hint", json=payload).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_healthz(client):
    assert client.get("/healthz").json() == {"ok": True}


def test_local_fallback_questions_have_hints_and_topics(client, fake_llm):
    fake_llm.questions = []  # model returns nothing usable
    resp = client.post("/generate_questions", json={"language": "javascript", "topic": "mixed", "difficulty": "easy", "n": 2})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    records = app_module.SESSION_STORE[body["session_id"]]["questions"]
    assert all(r["hint"] and r["topic"] in {"loops", "functions"} for r in records.values())
    assert "hint" not in json.dumps(body["questions"]).replace("has_hint", "")

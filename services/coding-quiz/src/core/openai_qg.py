# backend/src/core/openai_qg.py

import os, json, uuid, logging, re, asyncio, random
from typing import Dict, Any, List, TypedDict
from openai import AsyncOpenAI
from fastapi import HTTPException
from dotenv import load_dotenv

# ------------------------------------------------------------
# Ensure environment is loaded early
# ------------------------------------------------------------
load_dotenv()
logger = logging.getLogger("quiz.qg")

# ------------------------------------------------------------
# Types for clarity
# ------------------------------------------------------------
class SafeQuestion(TypedDict):
    question_id: str
    type: str
    question: str
    options: List[str] | None
    code_with_blanks: str | None

class SecretRecord(TypedDict):
    question_id: str
    answer: List[str]
    explanation: str

class QuestionResult(TypedDict):
    safe: List[SafeQuestion]
    secret: List[SecretRecord]

# ------------------------------------------------------------
# Global OpenAI client (async)
# ------------------------------------------------------------
_client: AsyncOpenAI | None = None

def configure_openai(api_key: str | None = None) -> AsyncOpenAI:
    """Create or reuse an AsyncOpenAI client."""
    global _client
    if _client is None:
        key = api_key or os.getenv("OPENAI_API_KEY", "")
        if not key:
            raise RuntimeError("OPENAI_API_KEY missing. Provide via env or param.")
        _client = AsyncOpenAI(api_key=key)
        logger.info("OpenAI async client configured (global instance).")
    return _client

# ------------------------------------------------------------
# Prompt template
# ------------------------------------------------------------
QG_SYSTEM_TEMPLATE = (
    "You are a strict {language} quiz generator.\n"
    "Allowed topics: loops, arrays/lists, functions, conditionals, classes/objects, "
    "and other core {language} constructs.\n"
    "Allowed types: mcq, fill_code, drag_drop.\n\n"
    "Output rules:\n"
    "- Output ONLY JSON (no markdown, no commentary outside JSON).\n"
    "- You MUST return EXACTLY N questions.\n"
    "- Each item MUST have keys: ['type','question','options','code_with_blanks','answer','explanation'].\n"
    "- The 'question' text MUST NOT contain code — only describe the task.\n"
    "- All code must appear only in 'code_with_blanks'.\n"
    "- Never duplicate code in both 'question' and 'code_with_blanks'.\n\n"
    "Quality & Variety rules:\n"
    "- Ensure variety: conceptual, debugging, edge cases, off-by-one, nested loops, logic errors.\n"
    "- Vary difficulty within the batch.\n"
    "- Avoid trivial repetition across questions.\n"
    "- Explanations must be clear and correct, ≥10 words.\n"
    "- Code must follow correct {language} syntax.\n"
    "- Always include a non-empty 'answer' and 'explanation'.\n"
    "- For drag_drop: 'answer' MUST be an array of actual code lines (not numbers, not labels).\n"
    "- Drag_drop 'options' MUST be exactly those code lines in scrambled order.\n"
)

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def _parse_json_response(text: str) -> List[Dict[str, Any]]:
    if not text:
        raise HTTPException(status_code=500, detail="Empty response from model")

    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "questions" in data and isinstance(data["questions"], list):
            return data["questions"]
    except Exception:
        pass

    # try substring extraction
    start, end = text.find("["), text.rfind("]")
    if start != -1 and end != -1:
        snippet = text[start:end+1]
        try:
            return json.loads(snippet)
        except Exception:
            pass

    # final cleanup attempt
    cleaned = re.sub(r",\s*([}\]])", r"\1", text)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "questions" in data:
            return data["questions"]
    except Exception as e:
        logger.error(f"Failed after cleaning JSON: {e}")

    raise HTTPException(status_code=500, detail=f"Invalid JSON from model. Raw output: {text[:500]}...")

def _normalize_answer(qtype: str, ans: Any) -> List[str]:
    """Normalize answers into comparable lists of strings."""
    if isinstance(ans, list):
        return [str(x).strip(" '\"\n") for x in ans]

    if isinstance(ans, str):
        s = ans.strip()
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

    return [str(ans).strip(" '\"\n")]

def _normalize_blanks(qtype: str, code: str | None, ans: List[str]) -> str | None:
    if qtype != "fill_code" or not code:
        return code
    if "___" not in code and ans:
        for a in ans:
            code = code.replace(a, "___", 1)
    return code

def _normalize_options(opts: Any) -> List[str] | None:
    if opts is None:
        return None
    if isinstance(opts, list):
        normed = []
        for o in opts:
            if isinstance(o, str):
                normed.append(o.strip())
            elif isinstance(o, dict):
                if "content" in o:
                    normed.append(str(o["content"]))
                elif "loop" in o and "output" in o:
                    normed.append(f"{o['loop']} -> {o['output']}")
                else:
                    normed.append(json.dumps(o, ensure_ascii=False))
            else:
                normed.append(str(o))
        return normed
    return [str(opts)]

def _deduplicate(items: List[Any]) -> List[Dict[str, Any]]:
    seen = set()
    unique_items: List[Dict[str, Any]] = []
    for q in items:
        if not isinstance(q, dict):
            logger.warning(f"Skipping non-dict item in deduplicate: {q}")
            continue
        sig = (str(q.get("question", "")).strip(), str(q.get("code_with_blanks", "")).strip())
        if sig not in seen:
            seen.add(sig)
            unique_items.append(q)
    return unique_items

def _extract_code(q: Dict[str, Any]) -> Dict[str, Any]:
    question = q.get("question") or ""
    code_with_blanks = q.get("code_with_blanks")

    code_match = re.search(r"`([^`]+)`", question, re.DOTALL)
    if code_match:
        code_snippet = code_match.group(1).strip()
        if not code_with_blanks:
            code_with_blanks = code_snippet
        question = re.sub(r"`[^`]+`", "", question).strip()

    return {**q, "question": question, "code_with_blanks": code_with_blanks}

# ------------------------------------------------------------
# Main generator
# ------------------------------------------------------------
async def generate_questions(
    language: str = "JavaScript",
    topic: str = "loops",
    difficulty: str = "mixed",
    n: int = 10,
    model_name: str = "gpt-4.1-mini",
    api_key: str | None = None,
    batch_size: int = 1,
) -> QuestionResult:
    client = configure_openai(api_key)
    system_prompt = QG_SYSTEM_TEMPLATE.format(language=language)

    async def request_batch(batch_n: int, force_type: str | None = None) -> List[Dict[str, Any]]:
        if topic.lower() == "mixed":
            topic_instruction = f"across a variety of {language} topics (loops, arrays/lists, functions, conditionals, classes/objects)"
        else:
            topic_instruction = f"about {topic}"

        base_prompt = (
            f"Generate {batch_n} {difficulty} {language} quiz question(s) {topic_instruction}. "
            f"Apply all quality rules: variety, debugging, edge cases, nested logic, off-by-one, and clear explanations. "
            f"Return a JSON list with exactly {batch_n} objects."
        )

        if force_type:
            user_prompt = base_prompt + f" Question type MUST be '{force_type}'."
        else:
            user_prompt = base_prompt + " The set MUST include a balanced mix of mcq, fill_code, and drag_drop types if N >= 3."

        resp = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = resp.choices[0].message.content or ""
        return _parse_json_response(raw)

    # ---- Split into batches
    tasks = []
    if batch_size == 1:
        types = ["mcq", "fill_code", "drag_drop"]
        random.shuffle(types)
        for i in range(n):
            force_type = types[i % len(types)]
            tasks.append(request_batch(1, force_type=force_type))
    else:
        full_batches, remainder = divmod(n, batch_size)
        for _ in range(full_batches):
            tasks.append(request_batch(batch_size))
        if remainder:
            tasks.append(request_batch(remainder))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    items: List[Dict[str, Any]] = []
    for r in results:
        if isinstance(r, Exception):
            logger.error(f"Batch failed: {r}")
            continue
        items.extend(r)

    items = _deduplicate(items)

    safe_list: List[SafeQuestion] = []
    secret_list: List[SecretRecord] = []

    def process_question(q: Dict[str, Any]) -> bool:
        nonlocal safe_list, secret_list
        q = _extract_code(q)

        qid = str(uuid.uuid4())
        ans_list = _normalize_answer(q.get("type"), q.get("answer"))
        code_with_blanks = _normalize_blanks(q.get("type"), q.get("code_with_blanks"), ans_list)

        # prettify code
        if isinstance(code_with_blanks, list):
            code_with_blanks = "\n".join(str(x).rstrip() for x in code_with_blanks)
        elif code_with_blanks is not None:
            code_with_blanks = str(code_with_blanks)
        if code_with_blanks:
            code_with_blanks = "\n".join(ln.rstrip() for ln in code_with_blanks.splitlines())

        # ---- Validations ----
        qtype = q.get("type")

        # Drop if explanation is missing or too short
        if not q.get("explanation") or len(str(q.get("explanation")).split()) < 5:
            logger.warning("Dropping question with bad explanation")
            return False

        # validate fill_code
        if qtype == "fill_code":
            num_blanks = code_with_blanks.count("___") if code_with_blanks else 0
            ans_list = [a for a in ans_list if a.strip()]
            if num_blanks != len(ans_list) or num_blanks == 0:
                logger.warning(
                    f"Dropping malformed fill_code: {num_blanks} blanks vs {len(ans_list)} answers"
                )
                return False

        # validate drag_drop
        opts: List[str] | None = None
        if qtype == "drag_drop":
            # reject numeric-only answers
            if all(re.fullmatch(r"\d+", x.strip()) for x in ans_list):
                logger.warning(f"Dropping numeric-only drag_drop: {ans_list}")
                return False
            opts = ans_list.copy()
            if len(opts) < 2:
                logger.warning(f"Dropping malformed drag_drop with only {len(opts)} option(s)")
                return False
            random.shuffle(opts)

        # validate mcq
        elif qtype == "mcq":
            opts = _normalize_options(q.get("options"))
            if not opts or len(opts) < 2:
                logger.warning("Dropping malformed mcq with <2 options")
                return False
            for ans in ans_list:
                if ans not in opts:
                    opts.append(ans)

        safe_list.append(
            {
                "question_id": qid,
                "type": qtype,
                "question": q.get("question", "").strip(),
                "options": opts,
                "code_with_blanks": code_with_blanks,
            }
        )
        secret_list.append(
            {
                "question_id": qid,
                "answer": [a.strip() for a in ans_list if a.strip()],
                "explanation": str(q.get("explanation")).strip(),
            }
        )
        return True

    # initial processing
    for q in items:
        process_question(q)

    # enforce question count after filtering
    while len(safe_list) < n:
        missing = n - len(safe_list)
        logger.warning(f"Regenerating {missing} extra question(s) due to dropped invalid ones...")
        extras = await asyncio.gather(*[request_batch(1) for _ in range(missing)])
        for e in extras:
            if isinstance(e, Exception):
                continue
            for q in e:
                if len(safe_list) < n:
                    process_question(q)

    logger.info(f"Generated {len(safe_list)} valid questions (target {n}).")
    return {"safe": safe_list, "secret": secret_list}

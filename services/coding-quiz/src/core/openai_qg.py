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
    "- You MUST return exactly the number of questions requested by the user.\n"
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
    model_name: str | None = None,
    api_key: str | None = None,
    batch_size: int | None = None,
) -> QuestionResult:
    client = configure_openai(api_key)
    system_prompt = QG_SYSTEM_TEMPLATE.format(language=language)
    selected_model = model_name or os.getenv("CODING_QUIZ_MODEL", "gpt-4.1")
    request_timeout_seconds = float(os.getenv("CODING_QUIZ_OPENAI_TIMEOUT_SECONDS", "20"))
    effective_batch_size = max(1, int(batch_size or os.getenv("CODING_QUIZ_BATCH_SIZE", "5")))

    type_cycle = ["mcq", "fill_code", "drag_drop"]
    desired_types = [type_cycle[i % len(type_cycle)] for i in range(n)]
    type_requirements = {kind: desired_types.count(kind) for kind in type_cycle}
    max_parallel_calls = max(1, min(int(os.getenv("CODING_QUIZ_MAX_PARALLEL_CALLS", "8")), n))
    semaphore = asyncio.Semaphore(max_parallel_calls)

    async def request_batch(batch_n: int, required_types: Dict[str, int] | None = None) -> List[Dict[str, Any]]:
        if topic.lower() == "mixed":
            topic_instruction = f"across a variety of {language} topics (loops, arrays/lists, functions, conditionals, classes/objects)"
        else:
            topic_instruction = f"about {topic}"

        type_line = ", ".join(
            f"{kind}: {count}" for kind, count in (required_types or {}).items() if count > 0
        ) or "balanced mcq, fill_code, and drag_drop"
        user_prompt = (
            f"Generate exactly {batch_n} {difficulty} {language} quiz questions {topic_instruction}. "
            f"Required type counts: {type_line}. "
            "Return a JSON object with one key named questions. "
            "questions must be an array of exactly the requested length. "
            "Apply all quality rules: variety, debugging, edge cases, nested logic, off-by-one, and clear explanations. "
            "Treat every question as a standalone high-quality item. "
            "Do not repeat the same question pattern."
        )

        async with semaphore:
            resp = await asyncio.wait_for(
                client.chat.completions.create(
                    model=selected_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    timeout=request_timeout_seconds,
                ),
                timeout=request_timeout_seconds,
            )
        raw = resp.choices[0].message.content or ""
        return _parse_json_response(raw)

    def build_type_batches(question_types: List[str]) -> List[Dict[str, int]]:
        sized_batch = max(1, min(effective_batch_size, len(question_types)))
        batches: List[Dict[str, int]] = []
        for start in range(0, len(question_types), sized_batch):
            batch: Dict[str, int] = {}
            for kind in question_types[start:start + sized_batch]:
                batch[kind] = batch.get(kind, 0) + 1
            batches.append(batch)
        return batches

    async def request_parallel(question_types: List[str]) -> List[Dict[str, Any]]:
        tasks = [
            request_batch(sum(required_types.values()), required_types)
            for required_types in build_type_batches(question_types)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        generated: List[Dict[str, Any]] = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Parallel generation batch failed: {result}")
                continue
            generated.extend(result)
        return generated

    # Keep generation parallel so each question gets focused model attention.
    # The semaphore caps transport pressure while preserving per-question quality.
    items = await request_parallel(desired_types)

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
        qtype = str(q.get("type", "")).strip().lower()
        q["type"] = qtype
        if qtype not in {"mcq", "fill_code", "drag_drop"}:
            logger.warning(f"Dropping unsupported question type: {qtype}")
            return False

        if not str(q.get("question", "")).strip():
            logger.warning("Dropping question without prompt text")
            return False

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

    def current_type_counts() -> Dict[str, int]:
        counts = {kind: 0 for kind in type_cycle}
        for item in safe_list:
            counts[item["type"]] = counts.get(item["type"], 0) + 1
        return counts

    async def top_up(question_types: List[str], label: str) -> None:
        missing_before = n - len(safe_list)
        if missing_before <= 0:
            return

        logger.warning(f"Regenerating {missing_before} {label} question(s) due to dropped invalid ones...")
        extras = await request_parallel(question_types[:missing_before])
        for q in extras:
            if len(safe_list) < n:
                process_question(q)

    # Enforce question count after filtering with bounded retries.
    attempts = 0
    max_retry_attempts = int(os.getenv("CODING_QUIZ_RETRY_ATTEMPTS", "0"))
    while len(safe_list) < n and attempts < max_retry_attempts:
        attempts += 1
        missing = n - len(safe_list)
        current_counts = current_type_counts()
        remaining_types = {
            kind: max(0, type_requirements.get(kind, 0) - current_counts.get(kind, 0))
            for kind in type_cycle
        }
        retry_types: List[str] = []
        for kind in type_cycle:
            retry_types.extend([kind] * remaining_types[kind])
        while len(retry_types) < missing:
            retry_types.append(type_cycle[len(retry_types) % len(type_cycle)])
        await top_up(retry_types, "extra")

    def add_local_fallback_questions() -> None:
        syntax = {
            "python": {
                "loop": "for item in items:",
                "function": "def total(values):",
                "array": "values = [1, 2, 3]",
                "index": "len(values) - 1",
            },
            "javascript": {
                "loop": "for (const item of items) {",
                "function": "function total(values) {",
                "array": "const values = [1, 2, 3];",
                "index": "values.length - 1",
            },
            "cpp": {
                "loop": "for (auto item : items) {",
                "function": "int total(vector<int> values) {",
                "array": "vector<int> values = {1, 2, 3};",
                "index": "values.size() - 1",
            },
        }.get(language.lower(), {})
        fallback_bank = [
            {
                "question": f"Which {language} snippet starts a loop over every item in a collection?",
                "options": [syntax.get("loop", "for item in items:"), "if item in items:", "return items", "break items"],
                "answer": [syntax.get("loop", "for item in items:")],
                "explanation": "A for loop visits each element in the collection without manually managing every index.",
            },
            {
                "question": f"Which {language} snippet begins a reusable function definition?",
                "options": [syntax.get("function", "def total(values):"), "while total(values):", "import total(values)", "class total(values)"],
                "answer": [syntax.get("function", "def total(values):")],
                "explanation": "A function definition names a reusable block that can receive values and return a result.",
            },
            {
                "question": f"Which expression points to the final valid index in a {language} list or array?",
                "options": [syntax.get("index", "len(values) - 1"), "len(values)", "0 - len(values)", "values + 1"],
                "answer": [syntax.get("index", "len(values) - 1")],
                "explanation": "Indexes start at zero, so the last valid position is one less than the collection length.",
            },
            {
                "question": f"Which {language} snippet creates a small numeric collection?",
                "options": [syntax.get("array", "values = [1, 2, 3]"), "values == 1, 2, 3", "values -> [1, 2, 3]", "values call [1, 2, 3]"],
                "answer": [syntax.get("array", "values = [1, 2, 3]")],
                "explanation": "This syntax initializes a collection so later code can loop through or index the values.",
            },
        ]
        fallback_index = 0
        while len(safe_list) < n:
            template = fallback_bank[fallback_index % len(fallback_bank)]
            fallback_index += 1
            qid = str(uuid.uuid4())
            safe_list.append(
                {
                    "question_id": qid,
                    "type": "mcq",
                    "question": template["question"],
                    "options": template["options"],
                    "code_with_blanks": None,
                }
            )
            secret_list.append(
                {
                    "question_id": qid,
                    "answer": template["answer"],
                    "explanation": template["explanation"],
                }
            )

    if len(safe_list) < n:
        logger.warning("Using local fallback questions to complete quiz after model generation shortfall.")
        add_local_fallback_questions()

    if len(safe_list) < n:
        raise HTTPException(status_code=502, detail=f"Generated only {len(safe_list)} valid questions out of {n}.")

    logger.info(f"Generated {len(safe_list)} valid questions (target {n}).")
    return {"safe": safe_list, "secret": secret_list}

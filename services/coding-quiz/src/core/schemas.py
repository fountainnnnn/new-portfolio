import os
from pydantic import BaseModel, Field, field_validator
from typing import Dict, List, Union, Optional

MAX_ANSWER_CHARS = int(os.getenv("CODING_QUIZ_MAX_ANSWER_CHARS", "4000"))
MAX_ANSWER_ITEMS = int(os.getenv("CODING_QUIZ_MAX_ANSWER_ITEMS", "50"))
ID_MAX_LENGTH = 64

# ------------------------------------------------------------
# Request models
# ------------------------------------------------------------
class GenerateRequest(BaseModel):
    language: str                  # e.g. "javascript", "python", "cpp"
    topic: str                     # e.g. "loops", "arrays", "functions"
    difficulty: str                 # "easy", "mixed", "hard"
    n: int = Field(ge=1, le=30)     # number of questions

    @field_validator("language")
    @classmethod
    def language_supported(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"javascript", "python", "cpp"}:
            raise ValueError("language must be javascript, python, or cpp")
        return normalized

    @field_validator("topic")
    @classmethod
    def topic_supported(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"mixed", "loops", "arrays", "functions", "conditionals", "objects", "classes"}:
            raise ValueError("topic is not supported")
        return normalized

    @field_validator("difficulty")
    @classmethod
    def difficulty_supported(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"easy", "mixed", "hard"}:
            raise ValueError("difficulty must be easy, mixed, or hard")
        return normalized


class AnswerRequest(BaseModel):
    session_id: str = Field(max_length=ID_MAX_LENGTH)   # required for backend session tracking
    question_id: str = Field(max_length=ID_MAX_LENGTH)
    user_answer: Union[str, List[str]]
    language: Optional[str] = Field(default="javascript", max_length=20)  # unused; kept for compatibility

    @field_validator("user_answer")
    @classmethod
    def answer_size_limited(cls, value):
        items = value if isinstance(value, list) else [value]
        if len(items) > MAX_ANSWER_ITEMS:
            raise ValueError(f"answer has too many parts (max {MAX_ANSWER_ITEMS})")
        if sum(len(item) for item in items) > MAX_ANSWER_CHARS:
            raise ValueError(f"answer is too long (max {MAX_ANSWER_CHARS} characters)")
        return value


class HintRequest(BaseModel):
    session_id: str = Field(max_length=ID_MAX_LENGTH)
    question_id: str = Field(max_length=ID_MAX_LENGTH)


class EndQuizRequest(BaseModel):
    session_id: str = Field(max_length=ID_MAX_LENGTH)


# ------------------------------------------------------------
# Question & Response models
# ------------------------------------------------------------
class SafeQuestion(BaseModel):
    question_id: str
    type: str
    question: str
    options: Optional[List[str]] = None
    code_with_blanks: Optional[str] = None
    topic: Optional[str] = None
    has_hint: bool = False


class GenerateResponse(BaseModel):
    status: str
    session_id: str
    questions: List[SafeQuestion]


class CheckAnswerResponse(BaseModel):
    status: str
    correct: bool
    expected: Union[str, List[str]]
    explanation: str
    # New fields (additive)
    correct_answer: Union[str, List[str]] = ""
    attempts: int = 0
    first_try: bool = False
    hint_used: bool = False


class HintResponse(BaseModel):
    status: str
    question_id: str
    hint: str
    hints_used: int


class TopicSummary(BaseModel):
    topic: str
    total: int
    answered: int
    correct_first_try: int
    hints_used: int
    accuracy: float


class ReviewItem(BaseModel):
    question_id: str
    question: str
    topic: str
    type: str
    answered: bool
    correct: bool
    correct_first_try: bool
    attempts: int
    hint_used: bool


class EndQuizResponse(BaseModel):
    status: str
    message: str
    score: Dict[str, Union[int, float]]
    hints_used: int
    by_topic: List[TopicSummary]
    by_type: List[TopicSummary]
    weak_areas: List[str]
    review: List[ReviewItem]

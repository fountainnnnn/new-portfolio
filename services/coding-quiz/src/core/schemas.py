from pydantic import BaseModel, Field, field_validator
from typing import List, Union, Optional

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
    session_id: str                # required for backend session tracking
    question_id: str
    user_answer: Union[str, List[str]]
    language: Optional[str] = "javascript"  # default JS, can also be python/cpp


# ------------------------------------------------------------
# Question & Response models
# ------------------------------------------------------------
class SafeQuestion(BaseModel):
    question_id: str
    type: str
    question: str
    options: Optional[List[str]] = None
    code_with_blanks: Optional[str] = None


class GenerateResponse(BaseModel):
    status: str
    session_id: str
    questions: List[SafeQuestion]


class CheckAnswerResponse(BaseModel):
    status: str
    correct: bool
    expected: Union[str, List[str]]
    explanation: str

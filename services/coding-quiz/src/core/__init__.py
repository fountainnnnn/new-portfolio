# backend/src/core/__init__.py
"""
Core package for the coding quiz API.
Exposes request/response schemas.
"""

from .schemas import (
    GenerateRequest,
    AnswerRequest,
    HintRequest,
    EndQuizRequest,
    GenerateResponse,
    CheckAnswerResponse,
    HintResponse,
    EndQuizResponse,
)

__all__ = [
    "GenerateRequest",
    "AnswerRequest",
    "HintRequest",
    "EndQuizRequest",
    "GenerateResponse",
    "CheckAnswerResponse",
    "HintResponse",
    "EndQuizResponse",
]

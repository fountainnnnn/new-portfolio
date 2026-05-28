from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from flask import current_app
from openai import OpenAI


class ChatbotError(RuntimeError):
    """Raised when the chat assistant cannot respond."""

    def __init__(self, message: str, diagnostic_code: str | None = None):
        super().__init__(message)
        self.diagnostic_code = diagnostic_code


_client_cache: Dict[str, OpenAI] = {}


@dataclass
class ContextSection:
    title: str
    content: str

    def as_text(self) -> str:
        return f"{self.title}: {self.content.strip()}"


def _resolve_context_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    project_root = Path(current_app.root_path).parent
    return (project_root / raw_path).resolve()


@lru_cache(maxsize=1)
def _load_sections(context_path: str) -> List[ContextSection]:
    path = _resolve_context_path(context_path)
    if not path.exists():
        return []

    sections: List[ContextSection] = []
    current_title = "General guidance"
    buffer: List[str] = []

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("### "):
            if buffer:
                sections.append(ContextSection(current_title, "\n".join(buffer).strip()))
            current_title = line.replace("### ", "").strip()
            buffer = []
        else:
            buffer.append(line)

    if buffer:
        sections.append(ContextSection(current_title, "\n".join(buffer).strip()))
    return sections


def _tokenize(phrase: str) -> List[str]:
    return [token for token in re.findall(r"[a-zA-Z]{3,}", phrase.lower())]


def _score_section(tokens: Iterable[str], section: ContextSection) -> Tuple[int, ContextSection]:
    section_tokens = set(_tokenize(section.as_text()))
    overlap = section_tokens.intersection(tokens)
    return (len(overlap), section)


def _build_context(question: str, page_context: str) -> str:
    sections = _load_sections(
        current_app.config.get("CHATBOT_CONTEXT_PATH", "application/resources/chatbot_context.txt")
    )
    question_tokens = set(_tokenize(question))
    scored = sorted(
        (_score_section(question_tokens, section) for section in sections),
        key=lambda item: item[0],
        reverse=True,
    )
    top_sections = [section.as_text() for score, section in scored if score > 0][:3]
    if not top_sections and sections:
        top_sections = [sections[0].as_text()]

    snippets = []
    if page_context:
        snippets.append(f"Page snippet:\n{page_context[:1200]}")
    if top_sections:
        snippets.append("Reference notes:\n" + "\n".join(top_sections))
    return "\n\n".join(snippets).strip()


def _get_openai_client() -> OpenAI:
    api_key = current_app.config.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ChatbotError("OpenAI API key is not configured. Set OPENAI_API_KEY in your environment.")
    if api_key not in _client_cache:
        _client_cache[api_key] = OpenAI(api_key=api_key)
    return _client_cache[api_key]


def generate_chat_response(message: str, page_context: str = "") -> str:
    """Generate a chatbot response using OpenAI with lightweight retrieval."""
    cleaned_message = (message or "").strip()
    if not cleaned_message:
        raise ChatbotError("Please enter a question about HDB resale planning.")

    context_blob = _build_context(cleaned_message, (page_context or "")[:2000])
    model_name = current_app.config.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")

    system_prompt = (
        f"You are {current_app.config.get('CHATBOT_TITLE', 'an HDB resale planning assistant')}.\n"
        "Explain concepts with Singapore context, cite data ranges from the notes when relevant, "
        "and recommend consulting HDB or CEA professionals for commitments."
    )

    try:
        client = _get_openai_client()
        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "Use the following background notes when answering. "
                        "If information is missing, be honest about the gap.\n\n"
                        f"{context_blob}\n\n"
                        f"User question: {cleaned_message}"
                    ),
                },
            ],
            temperature=0.4,
        )
    except Exception as exc:  # pragma: no cover - API failure surface to caller
        status_code = getattr(exc, "status_code", None) or getattr(exc, "status", None)
        diagnostic_code = f"chat_upstream_http_{status_code}" if status_code else "chat_upstream_error"
        raise ChatbotError(f"Chat service temporarily unavailable: {exc}", diagnostic_code) from exc

    try:
        return completion.choices[0].message.content.strip()
    except (AttributeError, IndexError, KeyError) as exc:
        raise ChatbotError("Chat service returned an unexpected response.") from exc

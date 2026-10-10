# -*- coding: utf-8 -*-
"""Document QA backed by DeepSeek (OpenAI-compatible SDK) and lightweight local retrieval.

Chunks keep their page number in metadata from loading through splitting and
retrieval. The model is asked to cite sources with the labels it was shown
(e.g. [p. 3]); cited labels are returned as a structured citations list.
"""

import logging
import os
import re
from collections import Counter
from typing import Any, Optional

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_CHAT_MODEL = "deepseek-v4-flash"
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 160
SNIPPET_CHARS = 220

_TOKEN_RE = re.compile(r"[A-Za-z0-9_]{2,}")
_CITATION_RE = re.compile(r"\[\s*(p\.|part)\s*(\d+)\s*\]", re.IGNORECASE)
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n+")
_STOPWORDS = {
    "about", "after", "also", "and", "are", "but", "can", "for", "from",
    "has", "have", "how", "into", "its", "not", "that", "the", "their",
    "then", "there", "this", "was", "what", "when", "where", "which", "with",
}

SYSTEM_PROMPT = (
    "Answer from the uploaded document context only. If the answer is not present, "
    "say the document does not contain enough information. Keep the answer concise and "
    "include the most relevant supporting detail. Every context excerpt starts with a "
    "source label in square brackets such as [p. 3] or [part 2]. After each claim, cite "
    "the label of the excerpt that supports it, copied exactly, for example [p. 3]. "
    "Only cite labels that appear in the context."
)


def _tokens(value: str) -> Counter:
    return Counter(
        token
        for token in _TOKEN_RE.findall(value.lower())
        if token not in _STOPWORDS
    )


def split_pages(pages: list[dict]) -> list[Document]:
    """Split per-page text into chunks; each chunk keeps its page and gets a source label."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    source_docs = [
        Document(page_content=page["text"], metadata={"page": page.get("page")})
        for page in pages
        if page.get("text")
    ]
    chunks = splitter.split_documents(source_docs)
    for index, chunk in enumerate(chunks):
        page = chunk.metadata.get("page")
        chunk.metadata["chunk"] = index
        chunk.metadata["label"] = f"p. {page}" if page is not None else f"part {index + 1}"
    return chunks


def select_context(question: str, chunks: list[Document], limit: int = 4) -> list[Document]:
    query = _tokens(question)
    if not query:
        return chunks[:limit]
    scored = []
    for index, chunk in enumerate(chunks):
        counts = _tokens(chunk.page_content)
        scored.append((sum(min(query[token], counts[token]) for token in query), -index, chunk))
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [chunk for _, _, chunk in scored[:limit]]


def _best_snippet(text: str, query: Counter) -> str:
    sentences = [s.strip() for s in _SENTENCE_RE.split(text) if s and s.strip()]
    if not sentences:
        return ""
    best = max(
        enumerate(sentences),
        key=lambda item: (sum(min(query[t], c) for t, c in _tokens(item[1]).items() if t in query), -item[0]),
    )[1]
    best = " ".join(best.split())
    return best if len(best) <= SNIPPET_CHARS else best[: SNIPPET_CHARS - 1].rstrip() + "…"


def build_citations(answer: str, question: str, selected: list[Document]) -> list[dict]:
    """Map labels cited in the answer back to the retrieved chunks, in order of first citation."""
    by_label: dict[str, list[Document]] = {}
    for chunk in selected:
        by_label.setdefault(chunk.metadata["label"].lower(), []).append(chunk)

    query = _tokens(question) + _tokens(_CITATION_RE.sub(" ", answer))
    citations: list[dict] = []
    seen: set[str] = set()
    for match in _CITATION_RE.finditer(answer):
        label = f"{match.group(1).lower()} {int(match.group(2))}"
        if label in seen or label not in by_label:
            continue
        seen.add(label)
        candidates = by_label[label]
        chunk = max(candidates, key=lambda c: sum(min(query[t], n) for t, n in _tokens(c.page_content).items() if t in query))
        citations.append({
            "page": chunk.metadata.get("page"),
            "label": chunk.metadata["label"],
            "snippet": _best_snippet(chunk.page_content, query),
        })
    return citations


def make_client(api_key: str, base_url: Optional[str] = None) -> Any:
    from openai import OpenAI

    return OpenAI(
        api_key=api_key,
        base_url=base_url or os.getenv("DEEPSEEK_BASE_URL", DEFAULT_BASE_URL),
        timeout=float(os.getenv("FILE_CHAT_LLM_TIMEOUT_SECONDS", "60")),
        max_retries=1,
    )


def get_qa_chain(
    pages: list[dict],
    api_key: Optional[str] = None,
    client: Any = None,
    model: Optional[str] = None,
):
    """
    Build a retrieval QA callable from per-page text.

    Args:
        pages: [{"page": int | None, "text": str}]
        api_key: key for the chat model; passed explicitly, never read from or written to os.environ
        client: optional OpenAI-compatible client (tests inject a fake)
        model: chat model override (defaults to DEEPSEEK_MODEL)

    Returns:
        callable(question) -> {"answer", "context", "citations"}
    """
    chunks = split_pages(pages)
    if not chunks:
        raise ValueError("No document text to index.")
    if client is None:
        if not api_key:
            raise RuntimeError("No API key provided for the chat model.")
        client = make_client(api_key)
    chat_model = model or os.getenv("DEEPSEEK_MODEL", DEFAULT_CHAT_MODEL)

    def ask(question: str) -> dict:
        selected = select_context(question, chunks)
        context = "\n\n---\n\n".join(
            f"[{chunk.metadata['label']}]\n{chunk.page_content}" for chunk in selected
        )
        response = client.chat.completions.create(
            model=chat_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Question: {question}\n\nDocument context:\n{context}"},
            ],
            max_tokens=700,
            extra_body={"thinking": {"type": "disabled"}},
        )
        answer = (response.choices[0].message.content or "").strip()
        return {
            "answer": answer,
            "context": "\n---\n".join(chunk.page_content[:400] for chunk in selected),
            "citations": build_citations(answer, question, selected),
        }

    return ask

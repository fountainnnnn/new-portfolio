# backend/src/core/qa_chain.py
# -*- coding: utf-8 -*-
"""Document QA backed by DeepSeek V4 Flash and lightweight local retrieval."""

import logging
import os
import re
from collections import Counter
from typing import Dict

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from openai import OpenAI

logger = logging.getLogger(__name__)
DEFAULT_CHAT_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

_TOKEN_RE = re.compile(r"[A-Za-z0-9_]{2,}")
_STOPWORDS = {
    "about", "after", "also", "and", "are", "but", "can", "for", "from",
    "has", "have", "how", "into", "its", "not", "that", "the", "their",
    "then", "there", "this", "was", "what", "when", "where", "which", "with",
}


def _tokens(value: str) -> Counter[str]:
    return Counter(
        token
        for token in _TOKEN_RE.findall(value.lower())
        if token not in _STOPWORDS
    )


def _select_context(question: str, chunks: list[str], limit: int = 4) -> list[str]:
    query = _tokens(question)
    if not query:
        return chunks[:limit]
    indexed_chunks = [(index, chunk, _tokens(chunk)) for index, chunk in enumerate(chunks)]
    ranked = sorted(
        indexed_chunks,
        key=lambda item: (
            sum(min(query[token], item[2][token]) for token in query),
            -item[0],
        ),
        reverse=True,
    )
    return [chunk for _, chunk, _ in ranked[:limit]]


def get_qa_chain(text: str):
    """
    Build a retrieval QA pipeline from raw text.

    Args:
        text (str): Document text.

    Returns:
        callable: Function(question: str) -> dict(answer, context)
    """
    try:
        # 1. Split into safe chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1200,
            chunk_overlap=160
        )
        docs = splitter.split_documents([Document(page_content=text)])
        chunks = [document.page_content for document in docs]
        key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
        if not key:
            raise RuntimeError("DEEPSEEK_API_KEY missing.")
        client = OpenAI(
            api_key=key,
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        )

        # Rank chunks locally so this service does not depend on an embedding model.
        def ask(question: str) -> Dict[str, str]:
            selected = _select_context(question, chunks)
            context = "\n\n---\n\n".join(selected)
            response = client.chat.completions.create(
                model=DEFAULT_CHAT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Answer from the uploaded document context only. If the answer is not "
                            "present, say the document does not contain enough information. Keep the "
                            "answer concise and include the most relevant supporting detail."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Question: {question}\n\nDocument context:\n{context}",
                    },
                ],
                max_tokens=700,
                extra_body={"thinking": {"type": "disabled"}},
            )
            return {
                "answer": (response.choices[0].message.content or "").strip(),
                "context": "\n---\n".join(chunk[:400] for chunk in selected),
            }

        return ask

    except Exception as e:
        logger.error(f"Failed to build QA chain: {e}")
        raise

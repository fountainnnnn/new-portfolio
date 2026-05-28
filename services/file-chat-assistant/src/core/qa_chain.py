# backend/src/core/qa_chain.py
# -*- coding: utf-8 -*-
"""
LangChain QA chain builder (safe for large docs).
- Splits text into smaller chunks
- Embeds chunks in safe batches (avoid >300k tokens/request)
- Stores in FAISS vectorstore
- Builds a retrieval QA chain with OpenAI
"""

import logging
import os
from typing import Dict, List

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)
DEFAULT_CHAT_MODEL = os.getenv("FILE_CHAT_MODEL", "gpt-5-mini")


class SafeOpenAIEmbeddings(OpenAIEmbeddings):
    """Wrap OpenAIEmbeddings to always embed in safe batches."""

    def embed_documents(self, texts: List[str], batch_size: int = 50) -> List[List[float]]:
        vectors = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            vectors.extend(super().embed_documents(batch))
        return vectors


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
        texts = [d.page_content for d in docs]

        # 2. Safe embeddings
        embeddings = SafeOpenAIEmbeddings(model="text-embedding-3-small")

        # 3. Build FAISS vectorstore
        db = FAISS.from_texts(texts, embeddings, metadatas=[d.metadata for d in docs])
        retriever = db.as_retriever(search_kwargs={"k": 4})

        # 4. LLM + Prompt
        chat_kwargs = {"model": DEFAULT_CHAT_MODEL}
        if DEFAULT_CHAT_MODEL.lower().startswith(("gpt-5", "o")):
            chat_kwargs["temperature"] = 1
        else:
            chat_kwargs["temperature"] = 0
        llm = ChatOpenAI(**chat_kwargs)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You answer from the uploaded document only. If the answer is not in the context, say that the document does not contain enough information. Keep answers concise and include the most relevant supporting detail."),
            ("human", "Question: {input}\n\nDocument context:\n{context}")
        ])
        doc_chain = create_stuff_documents_chain(llm, prompt)
        chain = create_retrieval_chain(retriever, doc_chain)

        # 5. Callable wrapper
        def ask(question: str) -> Dict[str, str]:
            result = chain.invoke({"input": question})
            return {
                "answer": result.get("answer", "").strip(),
                "context": "\n---\n".join(
                    [d.page_content[:400] for d in result.get("context", [])]
                )
            }

        return ask

    except Exception as e:
        logger.error(f"Failed to build QA chain: {e}")
        raise

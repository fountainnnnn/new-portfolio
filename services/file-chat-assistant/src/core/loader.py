# backend/src/core/loader.py
# -*- coding: utf-8 -*-
"""
Document loader for LangChain QA API.
- Supports PDF, DOCX, and TXT files
- Converts file bytes into plain text
"""

import os
import tempfile
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader


def load_document(filename: str, content: bytes) -> str:
    """
    Load a document (PDF/DOCX/TXT) from raw bytes and return plain text.

    Args:
        filename (str): The original uploaded filename.
        content (bytes): File content.

    Returns:
        str: Extracted text.
    """
    suffix = os.path.splitext(filename)[-1].lower()

    # Write uploaded bytes to a temporary file for the loaders
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if suffix == ".pdf":
            docs = PyPDFLoader(tmp_path).load()
        elif suffix == ".docx":
            docs = Docx2txtLoader(tmp_path).load()
        elif suffix == ".txt":
            docs = TextLoader(tmp_path).load()
        else:
            raise ValueError(f"Unsupported file type: {suffix}")

        # Merge all extracted text
        text = "\n".join([d.page_content for d in docs])
        return text

    finally:
        # Always clean up temporary file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

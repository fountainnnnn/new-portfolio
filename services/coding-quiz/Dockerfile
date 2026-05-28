FROM python:3.11-slim

WORKDIR /app

# --------------------------------------------------------
# Install system libraries required for PDF/DOCX parsing
# --------------------------------------------------------
RUN apt-get update && apt-get install -y \
    build-essential \
    poppler-utils \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------
# Copy requirements and install Python deps
# --------------------------------------------------------
COPY requirements.txt .

RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# --------------------------------------------------------
# Copy source code
# --------------------------------------------------------
COPY . .

# --------------------------------------------------------
# Expose API port (Hugging Face Spaces uses 7860)
# --------------------------------------------------------
EXPOSE 7860

# --------------------------------------------------------
# Healthcheck so Spaces knows when it's live
# --------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -f http://localhost:7860/healthz || exit 1

# --------------------------------------------------------
# Start FastAPI app
# --------------------------------------------------------
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]

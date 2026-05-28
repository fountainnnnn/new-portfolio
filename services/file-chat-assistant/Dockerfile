FROM python:3.11-slim

WORKDIR /app

# --------------------------------------------------------
# Install system libraries required for PDF/DOCX parsing
# --------------------------------------------------------
RUN apt-get update && apt-get install -y \
    build-essential \
    poppler-utils \
    libmagic1 \
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
# Expose API port
# --------------------------------------------------------
EXPOSE 7860

# --------------------------------------------------------
# Start FastAPI app
# --------------------------------------------------------
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]

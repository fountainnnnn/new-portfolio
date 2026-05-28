# Base image:
# Use official slim Python 3.11 image to keep container lightweight while
# still supporting your dependencies.
FROM python:3.11-slim

# Runtime env flags:
# - PYTHONDONTWRITEBYTECODE: avoid creating .pyc files in container FS
# - PYTHONUNBUFFERED: stream logs immediately (important for container logging)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set working directory inside the container. All next commands run from here.
WORKDIR /app

# Install dependencies first for better layer caching.
# By copying only requirements first, Docker can reuse this layer when code changes
# but dependencies stay the same (faster rebuilds).
COPY requirements.txt /app/requirements.txt
# `--no-cache-dir` reduces final image size by not storing pip wheel cache.
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source.
# Copy project files into the image after dependencies are installed.
# Any source change invalidates only layers after this point.
COPY . /app

# Flask/Gunicorn listens on 5000 by default (can be overridden via PORT env var).
# This is documentation for the platform/user; it does not publish ports by itself.
EXPOSE 5000

# Start the production server.
# Run Gunicorn with settings from gunicorn.conf.py.
# Current WSGI target is `app:app`, where:
# - module: `app.py`
# - callable: `app` imported from `application`.
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]

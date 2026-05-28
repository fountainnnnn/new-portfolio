import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = int(os.environ.get("GUNICORN_WORKERS", "1"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))


import os

# "[::]" listens on IPv6 and IPv4: Railway's private network may reach the app over either
bind = f"[::]:{os.environ.get('PORT', '5000')}"
workers = int(os.environ.get("GUNICORN_WORKERS", "1"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))

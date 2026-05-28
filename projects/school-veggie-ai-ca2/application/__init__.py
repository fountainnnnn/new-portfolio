import os
from pathlib import Path
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import CSRFProtect
from markupsafe import Markup, escape
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

db = SQLAlchemy()
csrf = CSRFProtect()


def _default_sqlite_uri() -> str:
    """Return the default SQLite URI relative to the application package."""
    base = Path(__file__).resolve().parent
    return f"sqlite:///{base / 'database.db'}"


app = Flask(__name__)
app.config.from_pyfile("config.cfg")
if os.getenv("FLASK_ENV", "").lower() == "production":
    app.config["DEBUG"] = False
    app.config["ENV"] = "production"

if os.getenv("SECRET_KEY"):
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
if app.config.get("ENV") == "production" and not app.config.get("SECRET_KEY"):
    raise RuntimeError("SECRET_KEY must be set in production.")
app.config.setdefault("MODEL_INFERENCE_URL", os.getenv("MODEL_INFERENCE_URL", ""))
app.config.setdefault("GOOGLE_CLIENT_ID", os.getenv("GOOGLE_CLIENT_ID"))
app.config.setdefault("GOOGLE_CLIENT_SECRET", os.getenv("GOOGLE_CLIENT_SECRET"))
app.config.setdefault("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY"))
app.config.setdefault("OPENAI_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
app.config.setdefault(
    "OPENAI_CHAT_SYSTEM_PROMPT",
    os.getenv(
        "OPENAI_CHAT_SYSTEM_PROMPT",
        (
            "You are VeggieAI Assistant, a helpful, friendly AI embedded in a web app."
            " Provide clear, accurate, practical answers about vegetables, nutrition, cooking, and how to use the app."
            " Keep answers concise unless asked to expand. If unsure, say so and suggest safe next steps."
            " If the system provides a vegetable image prediction result, treat it as factual and explain it clearly."
        ),
    ),
)
app.config.setdefault("SQLALCHEMY_DATABASE_URI", os.getenv("SQLALCHEMY_DATABASE_URI") or _default_sqlite_uri())
app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
app.config.setdefault("MAX_CONTENT_LENGTH", int(os.getenv("MAX_CONTENT_LENGTH", "16777216")))
app.config.setdefault("SESSION_COOKIE_SAMESITE", os.getenv("SESSION_COOKIE_SAMESITE", "Lax"))
app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
app.config.setdefault("PERMANENT_SESSION_LIFETIME", timedelta(days=int(os.getenv("SESSION_DAYS", "7"))))

_cookie_secure_env = os.getenv("SESSION_COOKIE_SECURE")
if _cookie_secure_env is not None:
    app.config.setdefault("SESSION_COOKIE_SECURE", _cookie_secure_env.lower() in {"1", "true", "yes"})
else:
    app.config.setdefault("SESSION_COOKIE_SECURE", not app.config.get("DEBUG", False))

if not os.getenv("FLASK_APP"):
    app.config.setdefault("FLASK_APP", "app.py")

if not os.getenv("FLASK_ENV"):
    app.config.setdefault("FLASK_ENV", "development")

_trust_proxy = os.getenv("TRUST_PROXY_HEADERS", "").lower() in {"1", "true", "yes"}
if _trust_proxy:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

db.init_app(app)
csrf.init_app(app)

from application.oauth import init_oauth  # noqa: E402

init_oauth(app)


@app.template_filter("nl2br")
def nl2br_filter(value: str | None) -> Markup:
    if not value:
        return Markup("")
    escaped = escape(value)
    return Markup("<br>".join(escaped.splitlines()))


_skip_db_bootstrap = os.getenv("SKIP_DB_BOOTSTRAP", "").lower() in {"1", "true", "yes"}

if not _skip_db_bootstrap:
    with app.app_context():
        from application import models  # noqa: WPS433 - ensure models are registered

        db.create_all()

        # Best-effort schema updates for SQLite when new columns are added.
        try:
            inspector = db.inspect(db.engine)
            statements: list[str] = []
            if "users" in inspector.get_table_names():
                existing = {col["name"] for col in inspector.get_columns("users")}
                if "oauth_provider" not in existing:
                    statements.append("ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(32)")
                if "oauth_subject" not in existing:
                    statements.append("ALTER TABLE users ADD COLUMN oauth_subject VARCHAR(255)")
                if "oauth_email_verified" not in existing:
                    statements.append("ALTER TABLE users ADD COLUMN oauth_email_verified BOOLEAN")
                if "password_set" not in existing:
                    statements.append("ALTER TABLE users ADD COLUMN password_set BOOLEAN")

            prediction_existing: set[str] = set()
            if "prediction_history" in inspector.get_table_names():
                prediction_existing = {col["name"] for col in inspector.get_columns("prediction_history")}
                if "original_label" not in prediction_existing:
                    statements.append("ALTER TABLE prediction_history ADD COLUMN original_label VARCHAR(120)")
                if "is_corrected" not in prediction_existing:
                    statements.append("ALTER TABLE prediction_history ADD COLUMN is_corrected BOOLEAN")
                if "corrected_at" not in prediction_existing:
                    statements.append("ALTER TABLE prediction_history ADD COLUMN corrected_at DATETIME")

            for stmt in statements:
                db.session.execute(text(stmt))
            if statements:
                if "users" in inspector.get_table_names() and "password_set" not in existing:
                    db.session.execute(text("UPDATE users SET password_set = 1 WHERE password_set IS NULL"))
                if prediction_existing:
                    if "original_label" not in prediction_existing:
                        db.session.execute(
                            text("UPDATE prediction_history SET original_label = label WHERE original_label IS NULL")
                        )
                    if "is_corrected" not in prediction_existing:
                        db.session.execute(
                            text("UPDATE prediction_history SET is_corrected = 0 WHERE is_corrected IS NULL")
                        )
                db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()

from application import routes  # noqa: E402  (import after app creation)

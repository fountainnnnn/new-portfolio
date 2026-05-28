import os
from pathlib import Path

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import CSRFProtect
from dotenv import load_dotenv
from markupsafe import Markup, escape

load_dotenv()

# Initialize extensions
db = SQLAlchemy()
csrf = CSRFProtect()


def _default_sqlite_uri() -> str:
    """Return the default SQLite URI relative to the application package."""
    base = Path(__file__).resolve().parent
    return f"sqlite:///{base / 'database.db'}"


# Create the Flask app
app = Flask(__name__)

# Load configuration from config.cfg
app.config.from_pyfile("config.cfg")
if os.getenv("SECRET_KEY"):
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
if os.getenv("FLASK_ENV", "").lower() == "production":
    app.config["DEBUG"] = False
    app.config["ENV"] = "production"
    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY must be set in production.")
app.config.setdefault("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY"))
if os.getenv("OPENAI_CHAT_MODEL"):
    app.config["OPENAI_CHAT_MODEL"] = os.getenv("OPENAI_CHAT_MODEL")
else:
    app.config.setdefault("OPENAI_CHAT_MODEL", "gpt-4o-mini")
if os.getenv("OPENAI_INSIGHTS_MODEL"):
    app.config["OPENAI_INSIGHTS_MODEL"] = os.getenv("OPENAI_INSIGHTS_MODEL")
app.config.setdefault(
    "CHATBOT_CONTEXT_PATH",
    os.getenv("CHATBOT_CONTEXT_PATH", "application/resources/chatbot_context.txt"),
)
if os.getenv("CHATBOT_TITLE"):
    app.config["CHATBOT_TITLE"] = os.getenv("CHATBOT_TITLE")
else:
    app.config.setdefault("CHATBOT_TITLE", "HDB Resale Copilot")

for config_key in (
    "MODEL_PACKAGE_PATH",
    "DEMAND_MODEL_PACKAGE_PATH",
    "EXIT_VALUE_MODEL_PATH",
    "MODEL_DATASET_PATH",
):
    if os.getenv(config_key):
        app.config[config_key] = os.getenv(config_key)

# Ensure FLASK_APP and FLASK_ENV are set in environment variables
if not os.getenv("FLASK_APP"):
    app.config.setdefault("FLASK_APP", "app.py")

if not os.getenv("FLASK_ENV"):
    app.config.setdefault("FLASK_ENV", "development")

# Set default database URI if not already set
if os.getenv("SQLALCHEMY_DATABASE_URI"):
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLALCHEMY_DATABASE_URI")
else:
    app.config.setdefault("SQLALCHEMY_DATABASE_URI", _default_sqlite_uri())
app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

db.init_app(app)
csrf.init_app(app)


@app.template_filter("nl2br")
def nl2br_filter(value: str | None) -> Markup:
    """Convert newline characters to <br> for safe HTML rendering."""
    if not value:
        return Markup("")
    escaped = escape(value)
    return Markup("<br>".join(escaped.splitlines()))


from application.services.predictor import warm_predictor_caches

_skip_bootstrap = os.getenv("SKIP_PREDICTOR_BOOTSTRAP", "").lower() in {"1", "true", "yes"}

if not _skip_bootstrap:
    with app.app_context():
        from application import models  # noqa: WPS433 - ensure models are registered

        db.create_all()
        warm_predictor_caches(async_mode=True)

# Run the file routes.py
from application import routes  # noqa: E402  (import after app creation)

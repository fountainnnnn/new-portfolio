from dataclasses import dataclass, field
import os

from dotenv import load_dotenv


load_dotenv()


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = "Decidr"
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    # Default planner model. Used for /dashboard/generate and /dashboard/refine.
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    openai_planner_model: str = os.getenv("OPENAI_PLANNER_MODEL", "gpt-5-mini")
    # Optional faster/cheaper model for the AI patch endpoint. Falls back to openai_model.
    openai_patch_model: str = os.getenv("OPENAI_PATCH_MODEL", "")
    # Reasoning effort for gpt-5* / o-series models. "low" is the sweet spot for chart selection
    # (medium adds 10-30s with limited quality gains for this task).
    openai_reasoning_effort: str = os.getenv("OPENAI_REASONING_EFFORT", "low")
    openai_request_timeout: float = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "25"))
    openai_planner_timeout: float = float(os.getenv("OPENAI_PLANNER_TIMEOUT", "8"))
    openai_max_retries: int = int(os.getenv("OPENAI_MAX_RETRIES", "0"))
    # When False (default), the backend does NOT render Plotly figures server-side: the spec is
    # the source of truth and the browser renders from it. This typically shaves 3-10s off the
    # /dashboard/generate latency. Enable only if you need legacy plotly_json (e.g. for image
    # snapshots in the Power BI fallback exporter).
    autodash_render_plotly_json: bool = _bool_env("AUTODASH_RENDER_PLOTLY_JSON", False)
    # When True (default), parallelise per-chart figure generation across a thread pool. Only has
    # an effect when autodash_render_plotly_json is True.
    autodash_parallel_charts: bool = _bool_env("AUTODASH_PARALLEL_CHARTS", True)
    # Hard cap on the number of dataset rows shipped to the browser query engine.
    autodash_max_rows_for_render: int = int(os.getenv("AUTODASH_MAX_ROWS_FOR_RENDER", "25000"))
    allowed_origins: list[str] = field(
        default_factory=lambda: [
            os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
            "http://127.0.0.1:3000",
        ]
    )


settings = Settings()

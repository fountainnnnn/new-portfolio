"""AI-driven JSON patch planner for the spec-driven dashboard.

The LLM never returns Plotly code. It only returns one of the operations defined
in `AiPatchOperation`, applied to a `DashboardSpec`. The output is validated
through the Pydantic schema before it touches state.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import Settings, settings
from app.models.schemas import (
    AiPatchOperation,
    ChartSpec,
    DashboardSpec,
    DatasetProfile,
    ThemeConfig,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are an expert BI analyst editing a JSON DashboardSpec. You DO NOT write "
    "Plotly code. You return strict JSON describing exactly one operation.\n\n"
    "Operations:\n"
    "  - create_dashboard: replace the whole spec. Required: spec.\n"
    "  - add_chart: append a new chart. Required: chart (a ChartSpec).\n"
    "  - update_chart: patch one chart. Required: chart_id and patch (partial ChartSpec).\n"
    "  - remove_chart: delete one chart. Required: chart_id.\n"
    "  - update_theme: patch the theme. Required: theme.\n"
    "  - explain_dashboard: return summary text only.\n"
    "  - suggest_improvements: return summary text only.\n\n"
    "Rules:\n"
    "  - Only use columns that exist in dataset_profile.columns.\n"
    "  - Use the column metadata (role, semantic_type, default_aggregation) to pick "
    "    sensible chart types and aggregations.\n"
    "  - Never duplicate an existing chart unless the user asks to.\n"
    "  - If the user asks for layout density, page focus/objective/title changes, "
    "    or broad dashboard restructuring, use create_dashboard with a complete revised spec.\n"
    "  - Do not use explain_dashboard or suggest_improvements for a requested edit; use them only "
    "    when the user explicitly asks for an explanation or suggestions.\n"
    "  - Always include a `summary` field describing what changed in plain English.\n"
    "  - Output ONLY the JSON object describing one operation; no markdown, no commentary.\n"
)


class AiPatchPlanner:
    """Thin wrapper around the OpenAI client that returns a validated operation."""

    def __init__(self, config: Settings = settings) -> None:
        self.settings = config

    def plan_patch(
        self,
        instruction: str,
        spec: DashboardSpec,
        profile: DatasetProfile,
        selected_chart_id: str | None = None,
    ) -> AiPatchOperation:
        if not self.settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY not configured.")

        from openai import OpenAI

        client = OpenAI(api_key=self.settings.openai_api_key, timeout=self.settings.openai_request_timeout)
        payload = {
            "instruction": instruction,
            "selected_chart_id": selected_chart_id,
            "current_spec": spec.model_dump(),
            "dataset_profile": _compact_profile(profile),
            "allowed_operations": [
                "create_dashboard",
                "add_chart",
                "update_chart",
                "remove_chart",
                "update_theme",
                "explain_dashboard",
                "suggest_improvements",
            ],
            "allowed_chart_types": [
                "bar", "line", "scatter", "histogram", "box", "pie",
                "kpi", "table", "treemap", "stacked_bar", "area", "heatmap",
                "correlation_heatmap",
            ],
        }

        # Allow routing patches to a cheaper / faster model than the planner. Falls back to
        # OPENAI_MODEL if OPENAI_PATCH_MODEL isn't set.
        model = self.settings.openai_patch_model or self.settings.openai_model
        request_kwargs: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload, default=str)},
            ],
            "response_format": {"type": "json_object"},
        }
        if model.lower().startswith(("gpt-5", "o")):
            request_kwargs["reasoning_effort"] = self.settings.openai_reasoning_effort
        else:
            request_kwargs["temperature"] = 0.2

        import time
        start = time.perf_counter()
        response = client.chat.completions.create(**request_kwargs)
        elapsed_ms = (time.perf_counter() - start) * 1000
        usage = getattr(response, "usage", None)
        logger.info(
            "AiPatchPlanner: model=%s elapsed=%.0fms tokens(prompt=%s,completion=%s)",
            model,
            elapsed_ms,
            getattr(usage, "prompt_tokens", None) if usage else None,
            getattr(usage, "completion_tokens", None) if usage else None,
        )
        content = response.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"AI patch was not valid JSON: {exc}") from exc

        try:
            return AiPatchOperation.model_validate(data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("AI patch validation failed: %s", exc)
            raise RuntimeError(f"AI patch failed validation: {exc}") from exc

    @staticmethod
    def apply(spec: DashboardSpec, op: AiPatchOperation) -> DashboardSpec:
        """Return a new DashboardSpec with `op` applied. Pure function."""
        new_spec = spec.model_copy(deep=True)

        if op.operation == "create_dashboard":
            if op.spec is None:
                raise ValueError("create_dashboard requires `spec`.")
            return op.spec

        if op.operation == "add_chart":
            if op.chart is None:
                raise ValueError("add_chart requires `chart`.")
            new_spec.charts.append(op.chart)
            return new_spec

        if op.operation == "update_chart":
            if not op.chart_id or op.patch is None:
                raise ValueError("update_chart requires `chart_id` and `patch`.")
            updated_charts: list[ChartSpec] = []
            for chart in new_spec.charts:
                if chart.chart_id == op.chart_id:
                    merged = chart.model_dump()
                    _deep_merge(merged, op.patch)
                    updated_charts.append(ChartSpec.model_validate(merged))
                else:
                    updated_charts.append(chart)
            new_spec.charts = updated_charts
            return new_spec

        if op.operation == "remove_chart":
            if not op.chart_id:
                raise ValueError("remove_chart requires `chart_id`.")
            new_spec.charts = [c for c in new_spec.charts if c.chart_id != op.chart_id]
            new_spec.layout.items = [
                item for item in new_spec.layout.items if item.item_id != op.chart_id
            ]
            return new_spec

        if op.operation == "update_theme":
            if op.theme is None:
                raise ValueError("update_theme requires `theme`.")
            merged_theme = new_spec.theme.model_dump()
            _deep_merge(merged_theme, op.theme.model_dump())
            new_spec.theme = ThemeConfig.model_validate(merged_theme)
            return new_spec

        # explain_dashboard / suggest_improvements: summary only, no spec change.
        return new_spec


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> None:
    """In-place deep merge; patch values overwrite base unless both sides are dicts."""
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value


def _compact_profile(profile: DatasetProfile) -> dict[str, Any]:
    return {
        "row_count": profile.row_count,
        "columns": [column.model_dump() for column in profile.columns],
        "numeric_columns": profile.numeric_columns,
        "categorical_columns": profile.categorical_columns,
        "datetime_columns": profile.datetime_columns,
        "data_quality": profile.data_quality or {},
    }

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings, settings
from app.models.schemas import (
    ChartPlan,
    DashboardLayout,
    DashboardPlan,
    DatasetProfile,
    KpiPlan,
    LayoutItem,
)
from app.services.bi_planner import (
    build_compact_planner_payload,
    filter_top_candidates,
    generate_relationship_candidates,
    repair_dashboard_plan,
    validate_dashboard_plan,
)

logger = logging.getLogger(__name__)

# Cap on the in-memory plan cache. Each entry is a small pydantic model (~a few KB).
# The goal is to skip the LLM roundtrip when the user clicks "Generate" twice with the
# same prompt, or refreshes and re-submits; 32 entries covers typical dev/demo usage.
_PLAN_CACHE_SIZE = 32
_PLAN_PROMPT_VERSION = "semantic-bi-v4-candidates"
_MIN_CHARTS = 4
_MAX_CHARTS = 6
_TEMPORAL_NAME_MARKERS = ("date", "time", "month", "year", "day", "created", "updated")
_INSIGHT_REQUEST_MARKERS = ("insight", "takeaway", "observation", "recommendation", "talking point")
_STRUCTURAL_REQUEST_MARKERS = (
    "chart",
    "graph",
    "visual",
    "kpi",
    "card",
    "layout",
    "theme",
    "color",
    "filter",
    "slicer",
    "page",
    "title",
    "bar",
    "line",
    "scatter",
    "histogram",
    "pie",
    "heatmap",
)


@dataclass
class PlanResult:
    plan: DashboardPlan
    source: str  # "openai" | "fallback" | "cache"
    detail: str = ""


class OpenAIDashboardAgent:
    def __init__(self, config: Settings = settings) -> None:
        self.settings = config
        # Plan cache keyed by (profile_digest, normalized_prompt). A `DashboardPlan` is
        # deterministic given the dataset profile and user prompt (same temperature /
        # reasoning effort), so caching is safe. Hashing the FULL profile guarantees we
        # never serve a stale plan across a different dataset that happens to reuse an
        # id - the profile digest changes with any schema/data shift.
        self._plan_cache: OrderedDict[tuple[str, str], DashboardPlan] = OrderedDict()
        self._plan_cache_lock = threading.Lock()

    # -- Plan cache helpers --------------------------------------------------
    def _plan_cache_key(self, profile: DatasetProfile, user_prompt: str) -> tuple[str, str]:
        # Hash the compact profile rather than the full one - it's what the LLM actually
        # sees, and is stable across irrelevant field ordering differences.
        compact = build_compact_planner_payload(user_prompt="", profile=profile)
        digest = hashlib.sha256(
            json.dumps(compact, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()
        normalized_prompt = " ".join(user_prompt.strip().lower().split())
        return (f"{_PLAN_PROMPT_VERSION}:{digest}", normalized_prompt)

    def _plan_cache_get(self, key: tuple[str, str]) -> DashboardPlan | None:
        with self._plan_cache_lock:
            plan = self._plan_cache.get(key)
            if plan is not None:
                self._plan_cache.move_to_end(key)
                # Return a deep copy so mutations downstream (sanitize_plan assigns
                # chart_ids in-place) don't corrupt the cached entry.
                return plan.model_copy(deep=True)
            return None

    def _plan_cache_put(self, key: tuple[str, str], plan: DashboardPlan) -> None:
        with self._plan_cache_lock:
            self._plan_cache[key] = plan.model_copy(deep=True)
            self._plan_cache.move_to_end(key)
            while len(self._plan_cache) > _PLAN_CACHE_SIZE:
                self._plan_cache.popitem(last=False)

    def plan_dashboard(self, profile: DatasetProfile, user_prompt: str) -> DashboardPlan:
        return self.plan_dashboard_detailed(profile, user_prompt).plan

    def plan_dashboard_detailed(
        self, profile: DatasetProfile, user_prompt: str
    ) -> PlanResult:
        # Short-circuit identical (dataset, prompt) repeats. The cache key includes a
        # hash of the compact profile so different datasets never collide, and the
        # prompt is normalized (whitespace + casing) so trivial edits still hit.
        cache_key = self._plan_cache_key(profile, user_prompt)
        cached_plan = self._plan_cache_get(cache_key)
        if cached_plan is not None:
            logger.info(
                "Plan cache hit: skipping OpenAI call (charts=%d kpis=%d)",
                len(cached_plan.charts),
                len(cached_plan.kpis),
            )
            return PlanResult(plan=cached_plan, source="cache")

        if not self.settings.openai_api_key:
            logger.info("OpenAI key not configured; using rule-based fallback planner.")
            return PlanResult(
                plan=self._fallback_plan(profile, user_prompt),
                source="fallback",
                detail="OPENAI_API_KEY not set",
            )

        try:
            payload = self._call_openai(profile, user_prompt)
            plan = DashboardPlan.model_validate(payload)
            raw_chart_count = len(plan.charts)
            sanitized = self._sanitize_plan(plan, profile)
            detail = (
                f"OpenAI reasoned about {raw_chart_count} chart question(s); app expanded validated semantic coverage to {len(sanitized.charts)} charts."
                if len(sanitized.charts) > raw_chart_count
                else ""
            )
            logger.info(
                "OpenAI plan succeeded: model=%s charts=%d kpis=%d",
                self.settings.openai_model,
                len(sanitized.charts),
                len(sanitized.kpis),
            )
            self._plan_cache_put(cache_key, sanitized)
            return PlanResult(plan=sanitized, source="openai", detail=detail)
        except Exception as exc:  # noqa: BLE001 - surface any OpenAI failure
            logger.exception(
                "OpenAI plan_dashboard failed; falling back to rule-based planner. model=%s",
                self.settings.openai_model,
            )
            return PlanResult(
                plan=self._fallback_plan(profile, user_prompt),
                source="fallback",
                detail=f"{type(exc).__name__}: {exc}",
            )

    def refine_dashboard(
        self,
        profile: DatasetProfile,
        current_plan: DashboardPlan,
        user_prompt: str,
    ) -> DashboardPlan:
        return self.refine_dashboard_detailed(profile, current_plan, user_prompt).plan

    def refine_dashboard_detailed(
        self,
        profile: DatasetProfile,
        current_plan: DashboardPlan,
        user_prompt: str,
    ) -> PlanResult:
        if self._is_insight_only_refine_request(user_prompt):
            logger.info("Insight-only refinement detected; applying fast deterministic insight update.")
            return PlanResult(
                plan=self._fallback_refine_plan(profile, current_plan, user_prompt),
                source="fallback",
                detail="Handled insight-only refinement without waiting for a model call",
            )

        if not self.settings.openai_api_key:
            logger.info("OpenAI key not configured; using rule-based fallback refiner.")
            return PlanResult(
                plan=self._fallback_refine_plan(profile, current_plan, user_prompt),
                source="fallback",
                detail="OPENAI_API_KEY not set",
            )

        try:
            payload = self._call_openai(profile, user_prompt, current_plan=current_plan)
            plan = DashboardPlan.model_validate(payload)
            sanitized = self._sanitize_plan(plan, profile)
            sanitized = self._ensure_visible_insight_refinement(profile, current_plan, sanitized, user_prompt)
            logger.info(
                "OpenAI refine succeeded: model=%s charts=%d kpis=%d",
                self.settings.openai_model,
                len(sanitized.charts),
                len(sanitized.kpis),
            )
            return PlanResult(plan=sanitized, source="openai")
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "OpenAI refine_dashboard failed; falling back to rule-based refiner. model=%s",
                self.settings.openai_model,
            )
            return PlanResult(
                plan=self._fallback_refine_plan(profile, current_plan, user_prompt),
                source="fallback",
                detail=f"{type(exc).__name__}: {exc}",
            )

    def _planner_system_prompt(self) -> str:
        return (
            "You are a senior BI analyst generating a Power BI-style dashboard plan for a Plotly dashboard builder.\n"
            "Return strict JSON only.\n"
            "Use only the dataset_summary, candidate_relationships, kpi_candidates, current_dashboard_plan, "
            "allowed_chart_types, and output_schema provided. Select and organize the strongest dashboard; do not invent "
            "charts from raw column metadata.\n"
            "Prefer high-strength candidate_relationships and clear KPI candidates. Choose useful stakeholder questions "
            "about trends, rankings, comparisons, distributions, relationships, composition, or outliers.\n"
            "Rules: use 3-4 KPIs and 4-6 charts when supported; do not add filler charts; rates use mean, never sum; "
            "do not use excluded fields; preserve useful existing charts during refinement unless asked otherwise; "
            "do not output layout coordinates; follow the output schema exactly."
        )

    def _call_openai(
        self,
        profile: DatasetProfile,
        user_prompt: str,
        current_plan: DashboardPlan | None = None,
    ) -> dict[str, Any]:
        from openai import OpenAI

        timeout = min(self.settings.openai_request_timeout, self.settings.openai_planner_timeout)
        model = self.settings.openai_planner_model or self.settings.openai_model
        client = OpenAI(
            api_key=self.settings.openai_api_key,
            timeout=timeout,
            max_retries=self.settings.openai_max_retries,
        )
        compact_profile = self._compact_profile(profile)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a senior BI analyst designing a Power BI-style dashboard. Output strict JSON only "
                    "(no markdown, no commentary). You only use columns that appear in dataset_profile.\n\n"
                    "GOAL: Build a dashboard a stakeholder can actually act on. Every chart must answer a "
                    "concrete business question (trend, comparison, distribution, relationship, composition). "
                    "Never include a chart whose values barely vary or whose insight is trivial.\n\n"
                    "MANDATORY SEMANTIC REASONING PROCESS:\n"
                    "1) First infer each useful column's BI role from dataset_profile.columns.role, semantic_type, name, unique_count, "
                    "numeric_summaries, categorical_summaries, and sample_rows.\n"
                    "2) Treat columns as exactly one primary analytical role: business metric/measure, categorical dimension, temporal axis, "
                    "identifier/code, boolean flag, or free text.\n"
                    "3) Only business metric/measure columns may be used as y-values, KPI value columns, histogram targets, box-value columns, "
                    "or correlation/scatter measures. A numeric dtype alone does NOT make a column a metric.\n"
                    "4) Temporal columns are axes only. Identifier/code columns are labels or counts only. Dimensions are groupings only. "
                    "Boolean/text/constant columns are usually not chart measures.\n"
                    "5) If the dataset has weak or no real measures, prefer count/unique_count questions over inventing fake metric charts.\n\n"
                    "DATA-DRIVEN CHART RULES (read the profile carefully before choosing):\n"
                    "- Skip any column listed in data_quality.constant_columns or near_constant_columns. "
                    "Their values do not change enough to chart.\n"
                    "- Skip data_quality.id_like_columns for groupings (they are unique identifiers, not categories).\n"
                    "- Bar chart: x is categorical/dimension, y is a real business metric (sum/mean), OR x is a dimension with y omitted/count "
                    "when the question is record frequency. Only when the dimension "
                    "has effective_unique >= 3 AND top_share <= 0.85. If unique_count > 15, sort descending and "
                    "show top 10 only. Never bar-chart a column where all categories sum to similar values.\n"
                    "- Pie chart: ONLY when categorical effective_unique is between 2 and 7 AND top_share <= 0.8 "
                    "AND categories represent meaningful share of a total. Otherwise prefer a sorted bar chart.\n"
                    "- Line chart: REQUIRES a temporal column with span_days >= 7 or ordered period values. "
                    "Aggregate by an appropriate period. Use a real metric column on y, or count rows over time if no metric exists.\n"
                    "- Scatter: ONLY when both axes are numeric AND the (x,y) pair appears in "
                    "data_quality.top_correlations with |r| >= 0.2 AND row_count >= 20. Otherwise pick a different chart.\n"
                    "- Histogram: numeric column with cv >= 0.2 AND unique_count >= 10. Skip if the column "
                    "is essentially constant.\n"
                    "- Box plot: numeric column grouped by a categorical with effective_unique 2-12 and top_share <= 0.85.\n"
                    "- Correlation heatmap: ONLY if data_quality.top_correlations has >= 2 pairs with |r| >= 0.3.\n"
                    "- Prefer columns from possible_metric_columns for y-axes and KPIs. If a numeric column is not semantically a measure, "
                    "do not use it as a metric just because it is numeric.\n\n"
                    "KPI RULES:\n"
                    "- 3-4 KPIs that summarise the headline numbers (totals, averages, growth). "
                    "Never make a KPI from an identifier/code, temporal axis, dimension, text, boolean, or constant column unless the aggregation "
                    "is count/unique_count and the KPI title clearly says it is a count.\n"
                    "- If there is a datetime column with span_days >= 30, include at least one trend-aware KPI "
                    "(e.g. latest value vs prior period) when feasible.\n\n"
                    "DASHBOARD COMPOSITION:\n"
                    "- Every page must have a clear analytical intention. Do NOT create generic page title cards.\n"
                    "- Return 4-6 strong charts whenever the data supports them. Do not return a one-chart dashboard unless there is only "
                    "one chartable analytical question in the dataset.\n"
                    "- Think in stakeholder questions first, then map each question to the best chart. Cover a useful mix when possible: "
                    "trend, ranked comparison, distribution/spread, relationship/correlation, and composition/count mix.\n"
                    "- Each page should answer one coherent business question. Group charts that answer the same question on the same page. "
                    "Avoid weak filler visuals.\n"
                    "- Prefer fewer, denser pages over many sparse pages. Do NOT leave large empty areas.\n"
                    "- Use page_titles to describe the page question/objective (for example: 'Which institutions drive total students?'), "
                    "not 'Page 1' or generic dashboard names.\n\n"
                    "SPEED RULE: Do not spend tokens hand-crafting layout coordinates. The app owns final deterministic layout packing. "
                    "You may omit layout.items or return an empty layout; focus your reasoning on chart questions, columns, and explanations.\n"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "user_prompt": user_prompt,
                        "dataset_profile": compact_profile,
                        "current_dashboard_plan": current_plan.model_dump() if current_plan else None,
                        "instruction": (
                            "If current_dashboard_plan is provided, revise it according to the user prompt. "
                            "Keep useful charts unless the user asks for a change. If the user asks for more insights, "
                            "add new stakeholder-ready insights at the start of the insights array so they are visible. "
                            "For generation, return 4-6 charts if possible. For refinement, keep useful charts unless the user asks for a change. "
                            "If the user asks for more insights, add new stakeholder-ready insights at the start of the insights array so they are visible. "
                            "Do not spend tokens on layout coordinates; the app will pack the layout."
                        ),
                        "allowed_chart_types": [
                            "bar",
                            "line",
                            "scatter",
                            "histogram",
                            "box",
                            "pie",
                            "correlation_heatmap",
                        ],
                        "json_schema": {
                            "title": "string",
                            "description": "string",
                            "kpis": [
                                {
                                    "kpi_id": "string",
                                    "title": "string",
                                    "column": "existing column name or null",
                                    "aggregation": "sum | mean | median | min | max | count | unique_count",
                                    "explanation": "string",
                                }
                            ],
                            "charts": [
                                {
                                    "chart_id": "string",
                                    "title": "string",
                                    "chart_type": "bar | line | scatter | histogram | box | pie | correlation_heatmap",
                                    "x_column": "existing column name or null",
                                    "y_column": "existing column name or null",
                                    "color_column": "existing column name or null",
                                    "aggregation": "sum | mean | median | min | max | count | null",
                                    "explanation": "string",
                                }
                            ],
                            "insights": ["string"],
                            "page_titles": ["one objective/question title per page"],
                        },
                    },
                    default=str,
                ),
            },
        ]
        planner_payload = build_compact_planner_payload(
            user_prompt=user_prompt,
            profile=profile,
            current_dashboard_plan=current_plan,
        )
        messages = [
            {"role": "system", "content": self._planner_system_prompt()},
            {"role": "user", "content": json.dumps(planner_payload, default=str)},
        ]

        request_kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }
        if self._supports_reasoning_effort(model):
            # Reasoning models (gpt-5*, o*) reject custom temperature but accept reasoning_effort.
            request_kwargs["reasoning_effort"] = self.settings.openai_reasoning_effort
        else:
            request_kwargs["temperature"] = 0.2

        prompt_bytes = len(json.dumps(messages, default=str).encode("utf-8"))
        logger.info(
            "OpenAI plan request: model=%s timeout=%.1fs effort=%s prompt_bytes=%d",
            model,
            timeout,
            self.settings.openai_reasoning_effort if self._supports_reasoning_effort(model) else "n/a",
            prompt_bytes,
        )
        start = time.perf_counter()
        response = client.chat.completions.create(**request_kwargs)
        elapsed_ms = (time.perf_counter() - start) * 1000
        usage = getattr(response, "usage", None)
        prompt_tokens = getattr(usage, "prompt_tokens", None) if usage else None
        completion_tokens = getattr(usage, "completion_tokens", None) if usage else None
        logger.info(
            "OpenAI plan call: model=%s effort=%s elapsed=%.0fms tokens(prompt=%s,completion=%s)",
            model,
            self.settings.openai_reasoning_effort if self._supports_reasoning_effort(model) else "n/a",
            elapsed_ms,
            prompt_tokens,
            completion_tokens,
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)

    def _supports_reasoning_effort(self, model: str) -> bool:
        normalized = model.lower()
        return normalized.startswith("gpt-5") or normalized.startswith("o")

    def _compact_profile(self, profile: DatasetProfile) -> dict[str, Any]:
        """Build a token-thrifty profile for the planner.

        Wide datasets used to ship every column profile, every numeric summary, every
        categorical top-N list, and three sample rows. That's often 5-15k tokens for the
        prompt alone, which directly inflates LLM latency. We cap each section to the
        signals the planner actually uses to pick charts.
        """
        # Rank columns: prioritise the metric columns + datetimes + dimensions used for grouping,
        # then anything else. Cap to 28 to keep the prompt compact even for 100-column CSVs.
        priority: list[str] = []
        seen: set[str] = set()
        for source in (
            profile.possible_metric_columns,
            profile.datetime_columns,
            profile.categorical_columns,
            profile.numeric_columns,
        ):
            for name in source:
                if name not in seen:
                    seen.add(name)
                    priority.append(name)
        for name in profile.column_names:
            if name not in seen:
                seen.add(name)
                priority.append(name)
        kept = set(priority[:28])

        # Trim each ColumnProfile down to the fields the planner actually uses.
        slim_columns: list[dict[str, Any]] = []
        for column in profile.columns:
            if column.name not in kept:
                continue
            slim_columns.append(
                {
                    "name": column.name,
                    "inferred_type": column.inferred_type,
                    "unique_count": column.unique_count,
                    "missing_percent": column.missing_percent,
                    "role": column.role,
                    "semantic_type": column.semantic_type,
                    "default_aggregation": column.default_aggregation,
                    # Drop dtype, examples, aliases, business_meaning — the planner has the
                    # semantic_type which conveys the same intent in fewer tokens.
                }
            )

        # Cap categorical top-values lists to 5 entries and numeric summaries to the keys
        # the planner actually checks (cv, top_share, etc.). Drop everything for columns we
        # didn't keep.
        numeric_summaries: dict[str, dict[str, Any]] = {}
        for name in kept:
            summary = profile.numeric_summaries.get(name)
            if not summary:
                continue
            numeric_summaries[name] = {
                key: summary.get(key)
                for key in ("count", "mean", "min", "max", "median", "cv", "skew", "unique_count")
                if key in summary
            }

        categorical_summaries: dict[str, dict[str, Any]] = {}
        for name in kept:
            summary = profile.categorical_summaries.get(name)
            if not summary:
                continue
            top_values = (summary.get("top_values") or [])[:5]
            categorical_summaries[name] = {
                "unique_count": summary.get("unique_count"),
                "top_share": summary.get("top_share"),
                "effective_unique": summary.get("effective_unique"),
                "top_values": top_values,
            }

        semantic_metrics = self._semantic_metric_columns(profile)
        non_metric_numeric = [
            column
            for column in profile.numeric_columns
            if column in kept and column not in semantic_metrics
        ]

        return {
            "row_count": profile.row_count,
            "column_count": profile.column_count,
            "columns": slim_columns,
            "numeric_columns": [c for c in profile.numeric_columns if c in kept],
            "categorical_columns": [c for c in profile.categorical_columns if c in kept],
            "datetime_columns": [c for c in profile.datetime_columns if c in kept],
            "possible_metric_columns": [c for c in semantic_metrics if c in kept],
            "non_metric_numeric_columns": non_metric_numeric,
            "numeric_summaries": numeric_summaries,
            "categorical_summaries": categorical_summaries,
            # One sample row is enough for the model to see actual values; three is overkill.
            "sample_rows": profile.sample_rows[:1],
            "data_quality": profile.data_quality or {},
        }

    def _sanitize_plan(self, plan: DashboardPlan, profile: DatasetProfile) -> DashboardPlan:
        candidates = filter_top_candidates(generate_relationship_candidates(profile), max_candidates=30)
        validation_errors = validate_dashboard_plan(plan, profile, candidates)
        if validation_errors:
            plan = repair_dashboard_plan(plan, profile, candidates, validation_errors)

        valid_columns = set(profile.column_names)
        constant_set = set(
            (profile.data_quality or {}).get("constant_columns", [])
            + (profile.data_quality or {}).get("near_constant_columns", [])
        )
        id_like_set = set((profile.data_quality or {}).get("id_like_columns", []))
        semantic_metrics = self._semantic_metric_columns(profile)
        valid_charts: list[ChartPlan] = []
        for index, chart in enumerate(plan.charts[:16]):
            chart.chart_id = chart.chart_id or f"chart_{index + 1}"
            chart.x_column = chart.x_column if chart.x_column in valid_columns else None
            chart.y_column = chart.y_column if chart.y_column in valid_columns else None
            chart.color_column = chart.color_column if chart.color_column in valid_columns else None
            if self._chart_makes_business_sense(chart, profile, constant_set, id_like_set):
                valid_charts.append(chart)

        valid_kpis: list[KpiPlan] = []
        for index, kpi in enumerate(plan.kpis[:8]):
            kpi.kpi_id = kpi.kpi_id or f"kpi_{index + 1}"
            kpi.column = kpi.column if kpi.column in valid_columns else None
            # Drop KPIs pinned to a constant or id-like column unless they are pure counts.
            if kpi.column and kpi.column in constant_set and kpi.aggregation not in {"count", "unique_count"}:
                kpi.column = None
            if kpi.column and kpi.column in id_like_set and kpi.aggregation not in {"count", "unique_count"}:
                kpi.column = None
            if kpi.column and self._is_temporal_or_nonmetric(kpi.column, profile) and kpi.aggregation not in {"count", "unique_count"}:
                replacement = next((column for column in semantic_metrics if column != kpi.column), None)
                kpi.column = replacement
                if replacement:
                    kpi.title = f"{(kpi.aggregation or 'mean').title()} {self._label(replacement)}"
            if kpi.column or kpi.aggregation == "count":
                valid_kpis.append(kpi)

        if not valid_charts:
            return self._fallback_plan(profile, plan.description)

        plan.charts = self._ensure_chart_coverage(valid_charts, profile)
        plan.kpis = (valid_kpis or self._fallback_kpis(profile))[:4]
        plan.insights = plan.insights[:8] or [
            "Review the generated charts for trends, outliers, and segment differences."
        ]
        plan.layout = self._sanitize_layout(plan)
        return plan

    def _chart_makes_business_sense(
        self,
        chart: ChartPlan,
        profile: DatasetProfile,
        constant_set: set[str],
        id_like_set: set[str],
    ) -> bool:
        """Filter out chart picks the LLM should never have made.

        Enforces the data-quality rules even if the model ignores them: constant columns,
        ID-like groupings, single-bucket categoricals, etc.
        """
        if not self._chart_has_required_columns(chart, profile):
            return False

        cat_summaries = profile.categorical_summaries or {}
        num_summaries = profile.numeric_summaries or {}

        def is_dead_column(name: str | None) -> bool:
            return bool(name) and name in constant_set

        # Reject if the chart's primary axes are constant.
        for axis in (chart.x_column, chart.y_column):
            if is_dead_column(axis):
                return False

        if chart.chart_type == "bar":
            group_col = chart.x_column or chart.color_column
            if not group_col or group_col in id_like_set:
                return False
            if chart.y_column and self._is_temporal_or_nonmetric(chart.y_column, profile):
                return False
            summary = cat_summaries.get(group_col, {})
            top_share = float(summary.get("top_share") or 0)
            effective_unique = int(summary.get("effective_unique") or summary.get("unique_count") or 0)
            if top_share >= 0.95 or effective_unique < 2:
                return False
            if chart.aggregation == "count" and not chart.y_column:
                counts = [int(item.get("count") or 0) for item in (summary.get("top_values") or []) if isinstance(item, dict)]
                nonzero = [count for count in counts if count > 0]
                if len(nonzero) >= 3 and max(nonzero) / max(1, min(nonzero)) < 1.15:
                    return False
        if chart.chart_type == "pie":
            group_col = chart.x_column or chart.color_column
            if not group_col or group_col in id_like_set:
                return False
            if chart.y_column and self._is_temporal_or_nonmetric(chart.y_column, profile):
                return False
            summary = cat_summaries.get(group_col, {})
            top_share = float(summary.get("top_share") or 0)
            effective_unique = int(summary.get("effective_unique") or summary.get("unique_count") or 0)
            if effective_unique < 2 or effective_unique > 7 or top_share > 0.85:
                return False
        if chart.chart_type == "line":
            if not chart.x_column or chart.x_column not in self._temporal_axis_columns(profile):
                return False
            if chart.aggregation == "count" and not chart.y_column:
                pass
            elif not chart.y_column or self._is_temporal_or_nonmetric(chart.y_column, profile):
                return False
            ts = next(
                (item for item in (profile.data_quality or {}).get("time_series", []) if item.get("column") == chart.x_column),
                None,
            )
            if ts and (int(ts.get("n_distinct_days") or 0) < 3):
                return False
        if chart.chart_type == "histogram":
            target = chart.x_column or chart.y_column
            if not target or target not in profile.numeric_columns:
                return False
            if self._is_temporal_or_nonmetric(target, profile):
                return False
            summary = num_summaries.get(target, {})
            cv = summary.get("cv")
            unique_count = int(summary.get("unique_count") or 0)
            if (cv is not None and float(cv) < 0.05) or unique_count < 5:
                return False
        if chart.chart_type == "scatter":
            if (
                not chart.x_column
                or not chart.y_column
                or chart.x_column not in profile.numeric_columns
                or chart.y_column not in profile.numeric_columns
            ):
                return False
            if self._is_temporal_or_nonmetric(chart.x_column, profile) or self._is_temporal_or_nonmetric(chart.y_column, profile):
                return False
        if chart.chart_type == "box":
            group_col = chart.x_column if chart.x_column not in profile.numeric_columns else chart.color_column
            metric_col = chart.y_column if chart.y_column in profile.numeric_columns else chart.x_column
            if not metric_col or metric_col not in profile.numeric_columns:
                return False
            if self._is_temporal_or_nonmetric(metric_col, profile):
                return False
            if group_col:
                summary = cat_summaries.get(group_col, {})
                effective_unique = int(summary.get("effective_unique") or summary.get("unique_count") or 0)
                if effective_unique < 2 or effective_unique > 15:
                    return False
        if chart.chart_type == "correlation_heatmap":
            top_correlations = (profile.data_quality or {}).get("top_correlations", [])
            if len(top_correlations) < 2:
                return False
        return True

    def _ensure_chart_coverage(self, charts: list[ChartPlan], profile: DatasetProfile) -> list[ChartPlan]:
        constant_set = set(
            (profile.data_quality or {}).get("constant_columns", [])
            + (profile.data_quality or {}).get("near_constant_columns", [])
        )
        id_like_set = set((profile.data_quality or {}).get("id_like_columns", []))
        candidates = self._chart_candidates(profile)
        target = min(_MAX_CHARTS, max(_MIN_CHARTS, min(_MAX_CHARTS, len(charts) + len(candidates))))
        expanded: list[ChartPlan] = []
        seen: set[tuple[str, str | None, str | None, str | None, str | None]] = set()

        def add(chart: ChartPlan) -> None:
            if len(expanded) >= target:
                return
            signature = self._chart_signature(chart)
            if signature in seen:
                return
            if self._chart_makes_business_sense(chart, profile, constant_set, id_like_set):
                seen.add(signature)
                expanded.append(chart)

        for chart in charts:
            add(chart)
        for chart in candidates:
            add(chart)

        expanded.sort(key=self._chart_priority)
        for index, chart in enumerate(expanded[:_MAX_CHARTS], start=1):
            chart.chart_id = f"chart_{index}"
        return expanded[:_MAX_CHARTS]

    @staticmethod
    def _chart_priority(chart: ChartPlan) -> tuple[int, int]:
        if chart.aggregation == "count" and not chart.y_column:
            return (2, 0 if chart.chart_type == "line" else 1)
        if chart.chart_type in {"line", "scatter", "correlation_heatmap"}:
            return (0, 0)
        return (1, 0)

    def _chart_candidates(self, profile: DatasetProfile) -> list[ChartPlan]:
        deterministic = filter_top_candidates(generate_relationship_candidates(profile), max_candidates=30)
        if deterministic:
            return [
                ChartPlan(
                    title=self._candidate_title(candidate),
                    chart_type="bar" if candidate.get("recommended_chart_type") == "grouped_bar" else candidate.get("recommended_chart_type", "bar"),
                    x_column=candidate.get("x_column"),
                    y_column=candidate.get("y_column"),
                    color_column=candidate.get("color_column"),
                    aggregation=candidate.get("aggregation"),
                    business_question=candidate.get("question") or "",
                    analysis_type=candidate.get("analysis_type") or "",
                    sort=candidate.get("sort"),
                    limit=candidate.get("limit"),
                    reason_selected=candidate.get("reason") or "",
                    explanation=candidate.get("reason") or "",
                )
                for candidate in deterministic
            ]
        metrics = self._semantic_metric_columns(profile)
        categorical = self._useful_categorical_columns(profile)
        temporal = self._temporal_axis_columns(profile)
        candidates: list[ChartPlan] = []

        if not metrics and temporal:
            candidates.append(
                ChartPlan(
                    title="Records Over Time",
                    chart_type="line",
                    x_column=temporal[0],
                    aggregation="count",
                    explanation=f"Shows how record volume changes across {self._label(temporal[0])}.",
                )
            )

        for metric in metrics[:3]:
            if temporal:
                candidates.append(
                    ChartPlan(
                        title=f"{self._label(metric)} Trend Over Time",
                        chart_type="line",
                        x_column=temporal[0],
                        y_column=metric,
                        aggregation=self._default_aggregation_for_column(profile, metric),
                        explanation=f"Answers how {self._label(metric)} changes across {self._label(temporal[0])}.",
                    )
                )
            for category in categorical[:3]:
                candidates.append(
                    ChartPlan(
                        title=f"{self._label(metric)} by {self._label(category)}",
                        chart_type="bar",
                        x_column=category,
                        y_column=metric,
                        aggregation=self._default_aggregation_for_column(profile, metric),
                        explanation=f"Ranks {self._label(category)} by {self._label(metric)} to identify the biggest contributors.",
                    )
                )
                candidates.append(
                    ChartPlan(
                        title=f"{self._label(metric)} Spread by {self._label(category)}",
                        chart_type="box",
                        x_column=category,
                        y_column=metric,
                        explanation=f"Compares the distribution of {self._label(metric)} across {self._label(category)}.",
                    )
                )
            if self._has_numeric_spread(profile, metric):
                candidates.append(
                    ChartPlan(
                        title=f"{self._label(metric)} Distribution",
                        chart_type="histogram",
                        x_column=metric,
                        explanation=f"Shows spread, skew, and common ranges for {self._label(metric)}.",
                    )
                )

        for correlation in (profile.data_quality or {}).get("top_correlations", [])[:4]:
            first = correlation.get("a")
            second = correlation.get("b")
            if first in metrics and second in metrics:
                candidates.append(
                    ChartPlan(
                        title=f"{self._label(first)} vs {self._label(second)}",
                        chart_type="scatter",
                        x_column=first,
                        y_column=second,
                        color_column=categorical[0] if categorical else None,
                        explanation=f"Tests the relationship between {self._label(first)} and {self._label(second)}.",
                    )
                )
        if len(metrics) >= 2:
            candidates.append(
                ChartPlan(
                    title=f"{self._label(metrics[0])} vs {self._label(metrics[1])}",
                    chart_type="scatter",
                    x_column=metrics[0],
                    y_column=metrics[1],
                    color_column=categorical[0] if categorical else None,
                    explanation=f"Highlights relationships and outliers between {self._label(metrics[0])} and {self._label(metrics[1])}.",
                )
            )
        if len(metrics) >= 3 and len((profile.data_quality or {}).get("top_correlations", [])) >= 2:
            candidates.append(
                ChartPlan(
                    title="Metric Relationship Heatmap",
                    chart_type="correlation_heatmap",
                    explanation="Summarizes which business measures move together.",
                )
            )

        for category in categorical[:3]:
            candidates.append(
                ChartPlan(
                    title=f"{self._label(category)} Record Mix",
                    chart_type="bar",
                    x_column=category,
                    aggregation="count",
                    explanation=f"Shows record volume by {self._label(category)} when count is the relevant question.",
                )
            )
            summary = profile.categorical_summaries.get(category, {})
            effective_unique = int(summary.get("effective_unique") or summary.get("unique_count") or 0)
            if 2 <= effective_unique <= 7:
                candidates.append(
                    ChartPlan(
                        title=f"{self._label(category)} Share",
                        chart_type="pie",
                        x_column=category,
                        y_column=metrics[0] if metrics else None,
                        aggregation=self._default_aggregation_for_column(profile, metrics[0]) if metrics else None,
                        explanation=f"Shows composition by {self._label(category)}.",
                    )
                )
        return candidates

    def _candidate_title(self, candidate: dict[str, Any]) -> str:
        chart_type = candidate.get("recommended_chart_type")
        y_column = candidate.get("y_column")
        x_column = candidate.get("x_column")
        if chart_type == "correlation_heatmap":
            return "Metric Relationship Heatmap"
        if candidate.get("analysis_type") == "trend" and y_column:
            return f"{self._label(y_column)} Trend"
        if y_column and x_column:
            return f"{self._label(y_column)} by {self._label(x_column)}"
        if x_column:
            return f"{self._label(x_column)} Distribution"
        return str(candidate.get("question") or "Analytical View")[:80]

    @staticmethod
    def _chart_signature(chart: ChartPlan) -> tuple[str, str | None, str | None, str | None, str | None]:
        return (chart.chart_type, chart.x_column, chart.y_column, chart.color_column, chart.aggregation)

    def _semantic_metric_columns(self, profile: DatasetProfile) -> list[str]:
        metrics: list[str] = []
        for column in [*getattr(profile, "metric_candidates", []), *getattr(profile, "rate_metric_candidates", [])]:
            if column in profile.numeric_columns and column not in metrics:
                metrics.append(column)
        for column in profile.possible_metric_columns:
            if column in profile.numeric_columns and column not in metrics and not self._is_temporal_or_nonmetric(column, profile):
                metrics.append(column)
        for column_profile in profile.columns:
            if (
                column_profile.name in profile.numeric_columns
                and column_profile.role in {"measure", "metric", "rate_metric"}
                and not self._is_temporal_or_nonmetric(column_profile.name, profile)
                and column_profile.name not in metrics
            ):
                metrics.append(column_profile.name)
        return metrics

    def _temporal_axis_columns(self, profile: DatasetProfile) -> list[str]:
        columns = list(dict.fromkeys([*profile.datetime_columns, *getattr(profile, "time_candidates", [])]))
        for column in profile.numeric_columns:
            if column not in columns and self._is_temporal_or_nonmetric(column, profile):
                lower = column.lower()
                if any(marker in lower for marker in _TEMPORAL_NAME_MARKERS):
                    columns.append(column)
        return columns

    def _is_temporal_or_nonmetric(self, column: str | None, profile: DatasetProfile) -> bool:
        if not column:
            return True
        if column in profile.datetime_columns:
            return True
        column_profile = next((item for item in profile.columns if item.name == column), None)
        if column_profile:
            if column_profile.role in {"datetime", "time", "dimension", "id", "identifier", "text", "boolean", "excluded"}:
                return True
            semantic_type = (column_profile.semantic_type or "").lower()
            if any(marker in semantic_type for marker in ("date", "time", "identifier", "category", "boolean")):
                return True
        lower = column.lower()
        if any(marker in lower for marker in _TEMPORAL_NAME_MARKERS):
            return True
        summary = profile.numeric_summaries.get(column, {})
        minimum = summary.get("min")
        maximum = summary.get("max")
        unique_count = int(summary.get("unique_count") or 0)
        if minimum is not None and maximum is not None and unique_count >= 2:
            try:
                return bool(1800 <= float(minimum) <= 2200 and 1800 <= float(maximum) <= 2200)
            except (TypeError, ValueError):
                return False
        return False

    # ---- Layout handling -------------------------------------------------

    def _sanitize_layout(self, plan: DashboardPlan) -> DashboardLayout:
        """Clamp, dedupe, collision-pack, and auto-fill a layout for the plan.

        Pages are 12 cols x 12 rows (1280x720 px). Items never cross a page boundary;
        anything that does not fit on its requested page spills onto the next.
        """
        incoming = plan.layout if isinstance(plan.layout, DashboardLayout) else DashboardLayout()
        cols = 12
        rows_per_page = max(4, int(incoming.rows_per_page or 12))
        row_height = int(incoming.row_height or 47)

        kpi_ids = [kpi.kpi_id for kpi in plan.kpis]
        chart_ids = [chart.chart_id for chart in plan.charts]
        wants_insights = bool(plan.insights)

        allowed_ids: dict[str, str] = {}
        for kpi_id in kpi_ids:
            allowed_ids[kpi_id] = "kpi"
        allowed_ids["dashboard_title"] = "title"
        for item in incoming.items:
            if item.item_id.startswith("dashboard_title_page_"):
                allowed_ids[item.item_id] = "title"
        for chart_id in chart_ids:
            allowed_ids[chart_id] = "chart"
        if wants_insights:
            allowed_ids["insights"] = "insights"
            for item in incoming.items:
                if item.item_id.startswith("insights_page_"):
                    allowed_ids[item.item_id] = "insights"

        # Keep the first valid layout entry per item_id, clamp dimensions, and
        # remember which page (y // rows_per_page) the LLM asked for.
        seen: set[str] = set()
        cleaned: list[tuple[LayoutItem, int]] = []  # (item, requested_page)
        for item in incoming.items:
            if item.item_id not in allowed_ids or item.item_id in seen:
                continue
            kind = allowed_ids[item.item_id]
            default_w, default_h = self._default_size(kind)
            w = max(1, min(cols, int(item.w) if item.w else default_w))
            h = max(1, min(rows_per_page, int(item.h) if item.h else default_h))
            x = max(0, min(cols - w, int(item.x) if item.x is not None else 0))
            y = max(0, int(item.y) if item.y is not None else 0)
            requested_page = y // rows_per_page
            local_y = y % rows_per_page
            if local_y + h > rows_per_page:
                # Item would cross a page boundary; push it to the next page.
                requested_page += 1
                local_y = 0
            cleaned.append(
                (
                    LayoutItem(
                        item_id=item.item_id,
                        kind=kind,
                        x=x,
                        y=requested_page * rows_per_page + local_y,
                        w=w,
                        h=h,
                    ),
                    requested_page,
                )
            )
            seen.add(item.item_id)

        # Add defaults for any missing expected items.
        ordered_missing: list[tuple[str, str]] = []
        if "dashboard_title" not in seen:
            ordered_missing.append(("dashboard_title", "title"))
        for kpi_id in kpi_ids:
            if kpi_id not in seen:
                ordered_missing.append((kpi_id, "kpi"))
        for chart_id in chart_ids:
            if chart_id not in seen:
                ordered_missing.append((chart_id, "chart"))
        if wants_insights and "insights" not in seen:
            ordered_missing.append(("insights", "insights"))

        for item_id, kind in ordered_missing:
            w, h = self._default_size(kind)
            # KPIs default to page 0; charts/insights default to page 1 if KPIs already filled page 0.
            requested_page = 0 if kind == "kpi" else 0
            cleaned.append(
                (LayoutItem(item_id=item_id, kind=kind, x=0, y=requested_page * rows_per_page, w=w, h=h), requested_page)
            )

        # Sort by (page, y, x, kind priority) then repack page-by-page.
        kind_priority = {"kpi": 0, "chart": 1, "insights": 2, "filters": 3, "title": -1}
        cleaned.sort(key=lambda pair: (pair[1], pair[0].y, pair[0].x, kind_priority.get(pair[0].kind, 4)))

        packed = self._pack_items_paged([item for item, _ in cleaned], cols, rows_per_page)
        return DashboardLayout(
            cols=cols,
            row_height=row_height,
            rows_per_page=rows_per_page,
            items=packed,
            page_titles=incoming.page_titles,
        )

    @staticmethod
    def _default_size(kind: str) -> tuple[int, int]:
        if kind == "kpi":
            return 3, 2
        if kind == "insights":
            return 3, 2
        if kind == "filters":
            return 3, 2
        if kind == "title":
            return 12, 1
        return 6, 4  # chart default

    @staticmethod
    def _pack_items_paged(items: list[LayoutItem], cols: int, rows_per_page: int) -> list[LayoutItem]:
        """Greedy top-left packer that respects page boundaries.

        For each item:
          1. Try to place it on its requested page at the first free (x,y) that fits without
             crossing a page boundary.
          2. If it doesn't fit on that page, advance one page at a time until it does.
        """
        placed: list[LayoutItem] = []

        def collides(x: int, y: int, w: int, h: int) -> bool:
            for other in placed:
                if x + w <= other.x or other.x + other.w <= x:
                    continue
                if y + h <= other.y or other.y + other.h <= y:
                    continue
                return True
            return False

        for item in items:
            w = max(1, min(cols, item.w))
            h = max(1, min(rows_per_page, item.h))
            requested_page = max(0, item.y // rows_per_page)
            page = requested_page
            placed_flag = False
            # Walk pages forward; cap at a sane maximum to avoid infinite loops.
            while page < requested_page + 32 and not placed_flag:
                page_start = page * rows_per_page
                for local_y in range(rows_per_page - h + 1):
                    y_abs = page_start + local_y
                    for x in range(cols - w + 1):
                        if not collides(x, y_abs, w, h):
                            placed.append(
                                LayoutItem(item_id=item.item_id, kind=item.kind, x=x, y=y_abs, w=w, h=h)
                            )
                            placed_flag = True
                            break
                    if placed_flag:
                        break
                page += 1
            if not placed_flag:
                # Last resort: stack at the very bottom on a fresh page.
                bottom_page = (max((p.y + p.h for p in placed), default=0) + rows_per_page - 1) // rows_per_page
                placed.append(
                    LayoutItem(
                        item_id=item.item_id,
                        kind=item.kind,
                        x=0,
                        y=bottom_page * rows_per_page,
                        w=w,
                        h=h,
                    )
                )
        return placed

    def _chart_has_required_columns(self, chart: ChartPlan, profile: DatasetProfile) -> bool:
        if chart.chart_type == "correlation_heatmap":
            return len(self._semantic_metric_columns(profile)) >= 2
        if chart.chart_type in {"histogram", "box"}:
            return bool(chart.x_column or chart.y_column)
        if chart.chart_type in {"bar", "line", "scatter", "pie"}:
            return bool(chart.x_column or chart.y_column)
        return False

    def _fallback_plan(self, profile: DatasetProfile, user_prompt: str) -> DashboardPlan:
        charts: list[ChartPlan] = []
        numeric = self._semantic_metric_columns(profile)
        categorical = self._useful_categorical_columns(profile)
        datetimes = self._temporal_axis_columns(profile)
        metrics = self._semantic_metric_columns(profile)

        if datetimes and metrics:
            charts.append(
                ChartPlan(
                    chart_id="chart_1",
                    title=f"{metrics[0]} Trend Over Time",
                    chart_type="line",
                    x_column=datetimes[0],
                    y_column=metrics[0],
                    aggregation=self._default_aggregation_for_column(profile, metrics[0]),
                    explanation="Shows how the primary metric changes over time.",
                )
            )

        if categorical and metrics:
            charts.append(
                ChartPlan(
                    chart_id=f"chart_{len(charts) + 1}",
                    title=f"{metrics[0]} by {categorical[0]}",
                    chart_type="bar",
                    x_column=categorical[0],
                    y_column=metrics[0],
                    aggregation=self._default_aggregation_for_column(profile, metrics[0]),
                    explanation="Compares the primary metric across categories.",
                )
            )

        if len(numeric) >= 2 and profile.row_count >= 20:
            charts.append(
                ChartPlan(
                    chart_id=f"chart_{len(charts) + 1}",
                    title=f"{numeric[0]} vs {numeric[1]}",
                    chart_type="scatter",
                    x_column=numeric[0],
                    y_column=numeric[1],
                    color_column=categorical[0] if categorical else None,
                    explanation="Highlights relationships and possible outliers between two numeric fields.",
                )
            )

        if metrics and self._has_numeric_spread(profile, metrics[0]):
            charts.append(
                ChartPlan(
                    chart_id=f"chart_{len(charts) + 1}",
                    title=f"{metrics[0]} Distribution",
                    chart_type="histogram",
                    x_column=metrics[0],
                    explanation="Shows the spread, skew, and common ranges of the main metric.",
                )
            )

        if categorical and not metrics:
            charts.append(
                ChartPlan(
                    chart_id=f"chart_{len(charts) + 1}",
                    title=f"{categorical[0]} Mix",
                    chart_type="pie",
                    x_column=categorical[0],
                    explanation="Shows the share of records in each major category.",
                )
            )

        if len(numeric) >= 4 and profile.row_count >= 30 and len(charts) < 4:
            charts.append(
                ChartPlan(
                    chart_id=f"chart_{len(charts) + 1}",
                    title="Metric Correlation Heatmap",
                    chart_type="correlation_heatmap",
                    explanation="Shows which numeric measures move together.",
                )
            )

        plan = DashboardPlan(
            title=self._fallback_title(profile, user_prompt),
            description=self._fallback_description(profile),
            kpis=self._fallback_kpis(profile),
            charts=self._ensure_chart_coverage(charts, profile),
            insights=self._fallback_insights(profile),
        )
        plan.layout = self._sanitize_layout(plan)
        return plan

    def _fallback_refine_plan(
        self,
        profile: DatasetProfile,
        current_plan: DashboardPlan,
        user_prompt: str,
    ) -> DashboardPlan:
        refined = current_plan.model_copy(deep=True)
        request = user_prompt.lower()

        chart_type_swaps = {
            "bar": "bar",
            "line": "line",
            "scatter": "scatter",
            "histogram": "histogram",
            "box": "box",
            "pie": "pie",
            "heatmap": "correlation_heatmap",
            "correlation": "correlation_heatmap",
        }
        requested_type = next((chart_type for marker, chart_type in chart_type_swaps.items() if marker in request), None)
        if requested_type:
            chart = self._fallback_chart_for_type(profile, requested_type, len(refined.charts) + 1)
            if chart:
                chart.title = f"Refined {chart.title}"
                chart.explanation = "Added or updated from the dashboard refinement chat with validated dataset columns."
                if "add" in request or "include" in request or "also" in request:
                    refined.charts = [*refined.charts[:7], chart]
                elif refined.charts:
                    refined.charts[0] = chart
                else:
                    refined.charts = [chart]

        if "executive" in request or "professional" in request:
            refined.description = "A polished executive-ready dashboard refined from the previous version."
        elif "simple" in request or "minimal" in request:
            refined.description = "A simplified dashboard refined from the previous version."
        else:
            refined.description = f"{current_plan.description} Refined with: {user_prompt[:120]}"

        if self._is_insight_refine_request(user_prompt):
            refined.insights = self._refined_insights(profile, refined, user_prompt)
        else:
            refined.insights = self._unique_texts(
                [
                    f"Refinement applied: {user_prompt[:140]}",
                    "The dashboard was refined from the existing plan while keeping all columns validated.",
                    *refined.insights[:6],
                ]
            )[:8]
        refined.layout = self._sanitize_layout(refined)
        return refined

    def _is_insight_refine_request(self, user_prompt: str) -> bool:
        request = user_prompt.lower()
        return any(marker in request for marker in _INSIGHT_REQUEST_MARKERS)

    def _is_insight_only_refine_request(self, user_prompt: str) -> bool:
        request = user_prompt.lower()
        return self._is_insight_refine_request(user_prompt) and not any(
            marker in request for marker in _STRUCTURAL_REQUEST_MARKERS
        )

    def _ensure_visible_insight_refinement(
        self,
        profile: DatasetProfile,
        current_plan: DashboardPlan,
        refined: DashboardPlan,
        user_prompt: str,
    ) -> DashboardPlan:
        if not self._is_insight_refine_request(user_prompt):
            return refined
        before_visible = current_plan.insights[:3]
        after_visible = refined.insights[:3]
        if len(refined.insights) > len(current_plan.insights) and after_visible != before_visible:
            return refined
        refined.insights = self._refined_insights(profile, refined, user_prompt)
        refined.layout = self._sanitize_layout(refined)
        return refined

    def _refined_insights(self, profile: DatasetProfile, plan: DashboardPlan, user_prompt: str) -> list[str]:
        generated: list[str] = []
        metrics = self._semantic_metric_columns(profile)
        dimensions = self._useful_categorical_columns(profile)
        temporal = self._temporal_axis_columns(profile)

        if metrics and dimensions:
            generated.append(
                f"Compare {self._label(metrics[0])} by {self._label(dimensions[0])} to identify which segments drive the largest contribution before prioritizing action."
            )
        if metrics and temporal:
            generated.append(
                f"Track {self._label(metrics[0])} over {self._label(temporal[0])} for acceleration, dips, or seasonality before treating the latest period as normal."
            )
        if dimensions:
            summary = profile.categorical_summaries.get(dimensions[0], {})
            top_share = summary.get("top_share")
            if top_share is not None:
                generated.append(
                    f"Watch concentration in {self._label(dimensions[0])}: the largest category represents about {float(top_share):.0%} of records."
                )
        if metrics:
            summary = profile.numeric_summaries.get(metrics[0], {})
            cv = summary.get("cv")
            if cv is not None:
                generated.append(
                    f"Review {self._label(metrics[0])} variability; a coefficient of variation near {float(cv):.2f} indicates whether performance is stable or uneven."
                )
        for chart in plan.charts[:2]:
            generated.append(
                f"Use {chart.title} as a decision view: look for the segment, period, or relationship that most changes the next stakeholder action."
            )
        if profile.missing_values:
            missing = sorted(profile.missing_values.items(), key=lambda item: item[1], reverse=True)
            if missing and missing[0][1] > 0:
                generated.append(
                    f"Validate {self._label(missing[0][0])} before acting on the dashboard because it has {missing[0][1]:,} missing values."
                )
        if not generated:
            generated.append("Use the dashboard as a triage view: identify the largest segment, the strongest change, and the clearest data quality risk before drilling deeper.")
        generated.insert(0, f"Added insight focus from your request: {user_prompt[:120]}")
        return self._unique_texts([*generated, *plan.insights])[:10]

    def _unique_texts(self, values: list[str]) -> list[str]:
        unique: list[str] = []
        seen: set[str] = set()
        for value in values:
            cleaned = value.strip()
            key = cleaned.lower()
            if cleaned and key not in seen:
                seen.add(key)
                unique.append(cleaned)
        return unique

    def _fallback_chart_for_type(
        self,
        profile: DatasetProfile,
        chart_type: str,
        index: int,
    ) -> ChartPlan | None:
        numeric = self._semantic_metric_columns(profile)
        metrics = self._semantic_metric_columns(profile)
        categorical = profile.categorical_columns
        datetimes = self._temporal_axis_columns(profile)
        metric = metrics[0] if metrics else (numeric[0] if numeric else None)

        if chart_type == "line" and datetimes and metric:
            return ChartPlan(
                chart_id=f"refined_chart_{index}",
                title=f"{metric} Trend Over Time",
                chart_type="line",
                x_column=datetimes[0],
                y_column=metric,
                aggregation=self._default_aggregation_for_column(profile, metric),
            )
        if chart_type == "bar" and categorical and metric:
            return ChartPlan(
                chart_id=f"refined_chart_{index}",
                title=f"{metric} by {categorical[0]}",
                chart_type="bar",
                x_column=categorical[0],
                y_column=metric,
                aggregation=self._default_aggregation_for_column(profile, metric),
            )
        if chart_type == "scatter" and len(numeric) >= 2:
            return ChartPlan(
                chart_id=f"refined_chart_{index}",
                title=f"{numeric[0]} vs {numeric[1]}",
                chart_type="scatter",
                x_column=numeric[0],
                y_column=numeric[1],
                color_column=categorical[0] if categorical else None,
            )
        if chart_type == "histogram" and metric:
            return ChartPlan(
                chart_id=f"refined_chart_{index}",
                title=f"{metric} Distribution",
                chart_type="histogram",
                x_column=metric,
            )
        if chart_type == "box" and metric:
            return ChartPlan(
                chart_id=f"refined_chart_{index}",
                title=f"{metric} Spread by {categorical[0]}" if categorical else f"{metric} Spread",
                chart_type="box",
                x_column=categorical[0] if categorical else None,
                y_column=metric,
            )
        if chart_type == "pie" and categorical:
            return ChartPlan(
                chart_id=f"refined_chart_{index}",
                title=f"{categorical[0]} Share",
                chart_type="pie",
                x_column=categorical[0],
                y_column=metric,
                aggregation=self._default_aggregation_for_column(profile, metric) if metric else None,
            )
        if chart_type == "correlation_heatmap" and len(numeric) >= 2:
            return ChartPlan(
                chart_id=f"refined_chart_{index}",
                title="Metric Correlation Heatmap",
                chart_type="correlation_heatmap",
            )
        return None

    def _fallback_title(self, profile: DatasetProfile, user_prompt: str) -> str:
        metrics = self._semantic_metric_columns(profile)
        dimensions = profile.categorical_columns
        if metrics and dimensions:
            return f"{self._label(metrics[0])} Performance by {self._label(dimensions[0])}"
        if metrics:
            return f"{', '.join(self._label(metric) for metric in metrics[:3])} Performance Dashboard"
        if dimensions:
            return f"{self._label(dimensions[0])} Breakdown Dashboard"

        cleaned = user_prompt.strip().rstrip(".")
        if cleaned and not self._is_generic_prompt(cleaned):
            return cleaned[:80]
        return "CSV Analytics Dashboard"

    def _fallback_description(self, profile: DatasetProfile) -> str:
        parts = [
            f"Built from {profile.row_count:,} CSV rows",
            f"{profile.column_count:,} columns",
        ]
        metrics = self._semantic_metric_columns(profile)
        if metrics:
            parts.append(f"tracking {', '.join(self._label(column) for column in metrics[:3])}")
        if profile.categorical_columns:
            parts.append(f"split by {', '.join(self._label(column) for column in profile.categorical_columns[:3])}")
        return "; ".join(parts) + "."

    def _is_generic_prompt(self, user_prompt: str) -> bool:
        normalized = user_prompt.strip().lower().rstrip(".")
        return normalized == "analyze this dataset and build the best dashboard" or normalized.startswith("analyze this dataset")

    def _label(self, column: str) -> str:
        return column.replace("_", " ").replace("-", " ").title()

    def _default_aggregation_for_column(self, profile: DatasetProfile, column: str | None) -> str:
        if not column:
            return "sum"
        column_profile = next((item for item in profile.columns if item.name == column), None)
        if column_profile and column_profile.default_aggregation and column_profile.default_aggregation != "none":
            return column_profile.default_aggregation
        if column_profile and column_profile.role == "rate_metric":
            return "mean"
        return "sum"

    def _useful_categorical_columns(self, profile: DatasetProfile) -> list[str]:
        useful: list[str] = []
        for column in getattr(profile, "dimension_candidates", []) or profile.categorical_columns:
            summary = profile.categorical_summaries.get(column, {})
            unique_count = int(summary.get("unique_count") or 0)
            if 2 <= unique_count <= min(20, max(3, profile.row_count // 2)):
                useful.append(column)
        return useful

    def _has_numeric_spread(self, profile: DatasetProfile, column: str) -> bool:
        summary = profile.numeric_summaries.get(column, {})
        min_value = summary.get("min")
        max_value = summary.get("max")
        count = summary.get("count")
        return count is not None and count >= 10 and min_value is not None and max_value is not None and min_value != max_value

    def _fallback_kpis(self, profile: DatasetProfile) -> list[KpiPlan]:
        kpis: list[KpiPlan] = []
        metrics = self._semantic_metric_columns(profile)

        for index, column in enumerate(metrics[:3]):
            aggregations = ["mean", "sum", "median"] if index == 0 else ["mean"]
            for aggregation in aggregations:
                kpis.append(
                    KpiPlan(
                        kpi_id=f"kpi_{aggregation}_{column}",
                        title=f"{aggregation.title()} {self._label(column)}",
                        column=column,
                        aggregation=aggregation,
                        explanation=f"Shows the {aggregation} of {self._label(column)}.",
                    )
                )

        for column in self._useful_categorical_columns(profile)[:3]:
            kpis.append(
                KpiPlan(
                    kpi_id=f"kpi_mode_{column}",
                    title=f"Most Frequent {self._label(column)}",
                    column=column,
                    aggregation="mode",
                    explanation=f"Shows the most common {self._label(column)} value.",
                )
            )

        if not kpis:
            kpis.append(
                KpiPlan(
                    kpi_id="kpi_records_analyzed",
                    title="Records Analyzed",
                    column=None,
                    aggregation="count",
                    explanation="Fallback coverage metric used only when the dataset has no useful business metrics or categories.",
                )
            )

        return kpis[:4]

    def _fallback_insights(self, profile: DatasetProfile) -> list[str]:
        insights: list[str] = []
        metrics = self._semantic_metric_columns(profile)
        if metrics:
            insights.append(
                f"Key business metrics detected: {', '.join(self._label(column) for column in metrics[:4])}."
            )
        for column in self._useful_categorical_columns(profile)[:2]:
            top_values = profile.categorical_summaries.get(column, {}).get("top_values", [])
            if top_values:
                top = top_values[0]
                insights.append(f"Most frequent {self._label(column)} is {top.get('value')}.")
        if profile.datetime_columns:
            insights.append(
                f"Trend analysis is available using {', '.join(self._label(column) for column in profile.datetime_columns[:3])}."
            )
        if profile.missing_values:
            missing = sorted(profile.missing_values.items(), key=lambda item: item[1], reverse=True)
            if missing and missing[0][1] > 0:
                insights.append(f"Data quality watch: {self._label(missing[0][0])} has {missing[0][1]:,} missing values.")
        return insights[:5] or ["No obvious stakeholder-ready metric was detected; upload richer business measures for stronger recommendations."]

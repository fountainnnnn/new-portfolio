from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.models.schemas import ChartPlan, DashboardPlan, KpiPlan


ALLOWED_CHART_TYPES = [
    "bar",
    "stacked_bar",
    "line",
    "scatter",
    "histogram",
    "box",
    "pie",
    "correlation_heatmap",
]
ALLOWED_AGGREGATIONS = {"sum", "mean", "median", "min", "max", "count", "unique_count", None}
ANALYSIS_TYPES = {"trend", "ranking", "comparison", "distribution", "relationship", "composition", "outlier"}
MAX_DASHBOARD_CHARTS = 6
MAX_DASHBOARD_KPIS = 4


def generate_relationship_candidates(profile: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    metrics = _metric_columns(profile)
    rate_metrics = _rate_metric_columns(profile)
    all_metrics = [*metrics, *rate_metrics]
    dimensions = _dimension_columns(profile)
    time_fields = _time_columns(profile)

    for time_column in time_fields:
        if _time_unique_count(profile, time_column) < 3:
            continue
        for metric in all_metrics:
            aggregation = _default_aggregation(profile, metric)
            question_prefix = "How is average" if _is_rate_metric(profile, metric) else "How is"
            candidates.append(
                _candidate(
                    analysis_type="trend",
                    question=f"{question_prefix} {_label(metric)} changing over time?",
                    chart_type="line",
                    x_column=time_column,
                    y_column=metric,
                    color_column=None,
                    aggregation=aggregation,
                    sort="chronological",
                    limit=None,
                    reason=f"{_label(metric)} is a {'rate metric' if _is_rate_metric(profile, metric) else 'metric'} and {_label(time_column)} has multiple periods.",
                )
            )

    for dimension in dimensions:
        summary = _categorical_summary(profile, dimension)
        effective_unique = int(summary.get("effective_unique") or summary.get("unique_count") or 0)
        top_share = float(summary.get("top_share") or 0)
        if effective_unique < 2 or top_share >= 0.95:
            continue
        for metric in all_metrics:
            aggregation = _default_aggregation(profile, metric)
            candidates.append(
                _candidate(
                    analysis_type="ranking",
                    question=f"Which {_label(dimension)} values drive {_label(metric)}?",
                    chart_type="bar",
                    x_column=dimension,
                    y_column=metric,
                    color_column=None,
                    aggregation=aggregation,
                    sort="desc",
                    limit=10 if effective_unique > 10 else None,
                    reason=f"{_label(dimension)} is a usable dimension and {_label(metric)} is an analytical metric.",
                )
            )
            if 2 <= effective_unique <= 12 and top_share <= 0.85:
                candidates.append(
                    _candidate(
                        analysis_type="comparison",
                        question=f"How does {_label(metric)} vary across {_label(dimension)}?",
                        chart_type="box",
                        x_column=dimension,
                        y_column=metric,
                        color_column=None,
                        aggregation=None,
                        sort="none",
                        limit=None,
                        reason=f"{_label(dimension)} has manageable cardinality for distribution comparison.",
                    )
                )

    for metric in all_metrics:
        summary = _numeric_summary(profile, metric)
        unique_count = int(summary.get("unique_count") or 0)
        cv = summary.get("cv")
        if unique_count >= 10 and (cv is None or float(cv) >= 0.2):
            candidates.append(
                _candidate(
                    analysis_type="distribution",
                    question=f"How widely does {_label(metric)} vary across records?",
                    chart_type="histogram",
                    x_column=metric,
                    y_column=None,
                    color_column=None,
                    aggregation=None,
                    sort="none",
                    limit=None,
                    reason=f"{_label(metric)} has enough numeric variation for a distribution view.",
                )
            )

    for first_dimension in dimensions[:4]:
        first_summary = _categorical_summary(profile, first_dimension)
        first_unique = int(first_summary.get("effective_unique") or first_summary.get("unique_count") or 0)
        if first_unique < 2 or first_unique > 15:
            continue
        for second_dimension in dimensions[:4]:
            if second_dimension == first_dimension:
                continue
            second_summary = _categorical_summary(profile, second_dimension)
            second_unique = int(second_summary.get("effective_unique") or second_summary.get("unique_count") or 0)
            if second_unique < 2 or second_unique > 6:
                continue
            for metric in all_metrics[:3]:
                candidates.append(
                    _candidate(
                        analysis_type="composition",
                        question=f"How does {_label(metric)} vary by {_label(first_dimension)} and {_label(second_dimension)}?",
                        chart_type="bar",
                        x_column=first_dimension,
                        y_column=metric,
                        color_column=second_dimension,
                        aggregation=_default_aggregation(profile, metric),
                        sort="desc",
                        limit=10 if first_unique > 10 else None,
                        reason=f"Both dimensions have manageable cardinality for grouped comparison.",
                    )
                )
                break

    correlations = _top_correlations(profile)
    for correlation in correlations:
        first = correlation.get("a")
        second = correlation.get("b")
        r_value = float(correlation.get("r") or 0)
        if first in all_metrics and second in all_metrics and abs(r_value) >= 0.2 and profile.row_count >= 20:
            candidates.append(
                _candidate(
                    analysis_type="relationship",
                    question=f"Do {_label(first)} and {_label(second)} move together?",
                    chart_type="scatter",
                    x_column=first,
                    y_column=second,
                    color_column=dimensions[0] if dimensions else None,
                    aggregation=None,
                    sort="none",
                    limit=None,
                    reason=f"{_label(first)} and {_label(second)} have correlation r={r_value:.2f}.",
                )
            )

    for dimension in dimensions:
        summary = _categorical_summary(profile, dimension)
        effective_unique = int(summary.get("effective_unique") or summary.get("unique_count") or 0)
        top_share = float(summary.get("top_share") or 0)
        if not (2 <= effective_unique <= 7 and top_share <= 0.8 and metrics):
            continue
        metric = metrics[0]
        candidates.append(
            _candidate(
                analysis_type="composition",
                question=f"What share of {_label(metric)} comes from each {_label(dimension)}?",
                chart_type="pie",
                x_column=dimension,
                y_column=metric,
                color_column=None,
                aggregation="sum",
                sort="desc",
                limit=None,
                reason=f"{_label(dimension)} has few categories suitable for part-to-whole comparison.",
            )
        )

    strong_correlations = [item for item in correlations if abs(float(item.get("r") or 0)) >= 0.3]
    if len(all_metrics) >= 3 and len(strong_correlations) >= 2:
        candidates.append(
            _candidate(
                analysis_type="relationship",
                question="Which numeric metrics move together most strongly?",
                chart_type="correlation_heatmap",
                x_column=None,
                y_column=None,
                color_column=None,
                aggregation=None,
                sort="none",
                limit=None,
                reason="Several valid metric pairs have meaningful correlation.",
            )
        )

    scored = score_relationship_candidates(candidates, profile)
    for index, candidate in enumerate(scored, start=1):
        candidate["relationship_id"] = f"rel_{index:03d}"
    return scored


def score_relationship_candidates(candidates: list[dict[str, Any]], profile: Any) -> list[dict[str, Any]]:
    scored: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    excluded = _excluded_columns(profile)
    for candidate in candidates:
        signature = (
            candidate.get("analysis_type"),
            candidate.get("recommended_chart_type"),
            candidate.get("x_column"),
            candidate.get("y_column"),
            candidate.get("color_column"),
            candidate.get("aggregation"),
        )
        if signature in seen:
            continue
        seen.add(signature)
        if any(candidate.get(field) in excluded for field in ("x_column", "y_column", "color_column")):
            continue
        score = 50
        chart_type = candidate.get("recommended_chart_type")
        analysis_type = candidate.get("analysis_type")
        x_column = candidate.get("x_column")
        y_column = candidate.get("y_column")
        color_column = candidate.get("color_column")
        aggregation = candidate.get("aggregation")

        if y_column and (_is_metric(profile, y_column) or _is_rate_metric(profile, y_column)):
            score += 18
        if y_column and _is_rate_metric(profile, y_column) and aggregation == "mean":
            score += 10
        if y_column and _is_rate_metric(profile, y_column) and aggregation == "sum":
            continue
        if x_column and _is_time(profile, x_column) and analysis_type == "trend":
            score += 18
        if x_column and _is_dimension(profile, x_column):
            score += 12
            summary = _categorical_summary(profile, x_column)
            unique_count = int(summary.get("effective_unique") or summary.get("unique_count") or 0)
            top_share = float(summary.get("top_share") or 0)
            if 2 <= unique_count <= 12:
                score += 8
            if top_share >= 0.9:
                score -= 20
        if color_column and _is_dimension(profile, color_column):
            score += 6
        if chart_type in {"line", "bar", "scatter"}:
            score += 6
        if chart_type == "pie":
            score -= 12
        if chart_type == "correlation_heatmap":
            score -= 4

        candidate = dict(candidate)
        candidate["score"] = max(0, int(score))
        if score >= 82:
            candidate["strength"] = "high"
        elif score >= 62:
            candidate["strength"] = "medium"
        else:
            candidate["strength"] = "low"
        scored.append(candidate)
    scored.sort(key=lambda item: item.get("score", 0), reverse=True)
    return scored


def filter_top_candidates(candidates: list[dict[str, Any]], max_candidates: int = 30) -> list[dict[str, Any]]:
    usable = [candidate for candidate in candidates if candidate.get("strength") in {"high", "medium"}]
    if not usable:
        usable = candidates
    return usable[:max_candidates]


def generate_kpi_candidates(profile: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for metric in _metric_columns(profile):
        candidates.append(
            {
                "kpi_id": f"kpi_candidate_{len(candidates) + 1:03d}",
                "title": f"Total {_label(metric)}",
                "column": metric,
                "aggregation": "sum",
                "business_question": f"What is the total {_label(metric).lower()}?",
                "reason": f"{_label(metric)} is an additive business metric.",
            }
        )
    for metric in _rate_metric_columns(profile):
        candidates.append(
            {
                "kpi_id": f"kpi_candidate_{len(candidates) + 1:03d}",
                "title": f"Average {_label(metric)}",
                "column": metric,
                "aggregation": "mean",
                "business_question": f"What is the average {_label(metric).lower()}?",
                "reason": f"{_label(metric)} is a rate or ratio and should be averaged, not summed.",
            }
        )
    for dimension in _dimension_columns(profile)[:4]:
        candidates.append(
            {
                "kpi_id": f"kpi_candidate_{len(candidates) + 1:03d}",
                "title": f"Number of {_label(dimension)}",
                "column": dimension,
                "aggregation": "unique_count",
                "business_question": f"How many distinct {_label(dimension).lower()} values are present?",
                "reason": f"{_label(dimension)} is a meaningful dimension.",
            }
        )
    if not candidates:
        candidates.append(
            {
                "kpi_id": "kpi_candidate_001",
                "title": "Records Analyzed",
                "column": None,
                "aggregation": "count",
                "business_question": "How many records were analyzed?",
                "reason": "No stronger business metric was detected.",
            }
        )
    return candidates[:12]


def build_compact_planner_payload(
    user_prompt: str,
    profile: Any,
    current_dashboard_plan: DashboardPlan | None = None,
) -> dict[str, Any]:
    candidates = filter_top_candidates(generate_relationship_candidates(profile), max_candidates=30)
    kpi_candidates = generate_kpi_candidates(profile)
    summary = {
        "row_count": profile.row_count,
        "column_count": profile.column_count,
        "possible_row_grain": profile.possible_row_grain,
        "main_entities": _dimension_columns(profile)[:6],
        "main_metrics": _metric_columns(profile)[:8],
        "main_rate_metrics": _rate_metric_columns(profile)[:8],
        "main_dimensions": _dimension_columns(profile)[:8],
        "time_fields": _time_columns(profile)[:5],
        "excluded_fields": list(profile.excluded_columns or []),
        "data_quality": {
            "constant_columns": (profile.data_quality or {}).get("constant_columns", []),
            "near_constant_columns": (profile.data_quality or {}).get("near_constant_columns", []),
            "id_like_columns": (profile.data_quality or {}).get("id_like_columns", []),
            "mostly_missing_columns": (profile.data_quality or {}).get("mostly_missing_columns", []),
        },
    }
    return {
        "user_prompt": user_prompt,
        "dataset_summary": summary,
        "candidate_relationships": candidates,
        "kpi_candidates": kpi_candidates,
        "current_dashboard_plan": current_dashboard_plan.model_dump(mode="json") if current_dashboard_plan else None,
        "dashboard_limits": {
            "kpis": {"min": 3, "max": MAX_DASHBOARD_KPIS},
            "charts": {"min": 4, "max": MAX_DASHBOARD_CHARTS},
            "max_charts_per_page": 4,
        },
        "allowed_chart_types": ALLOWED_CHART_TYPES,
        "output_schema": _dashboard_output_schema(),
    }


def validate_dashboard_plan(
    plan: DashboardPlan,
    profile: Any,
    candidates: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    valid_columns = set(profile.column_names)
    excluded = _excluded_columns(profile)
    page_ids = {page.get("page_id") for page in plan.pages if isinstance(page, dict)}
    chart_ids: set[str] = set()

    for index, chart in enumerate(plan.charts):
        chart_id = chart.chart_id or f"chart_{index + 1}"
        if chart_id in chart_ids:
            errors.append({"code": "duplicate_chart_id", "chart_id": chart_id})
        chart_ids.add(chart_id)
        if chart.chart_type not in {*ALLOWED_CHART_TYPES, "grouped_bar"}:
            errors.append({"code": "invalid_chart_type", "chart_id": chart_id, "chart_type": chart.chart_type})
        for field in ("x_column", "y_column", "color_column"):
            column = getattr(chart, field)
            if not column:
                continue
            if column not in valid_columns:
                errors.append({"code": "unknown_column", "chart_id": chart_id, "field": field, "column": column})
            elif column in excluded:
                errors.append({"code": "excluded_column", "chart_id": chart_id, "field": field, "column": column})
        if chart.y_column and _is_rate_metric(profile, chart.y_column) and chart.aggregation == "sum":
            errors.append({"code": "rate_sum", "chart_id": chart_id, "column": chart.y_column})
        if chart.chart_type == "line" and chart.x_column and not _is_time(profile, chart.x_column):
            errors.append({"code": "line_without_time", "chart_id": chart_id, "column": chart.x_column})
        if chart.chart_type == "scatter":
            if not (chart.x_column and chart.y_column and _is_metric_like(profile, chart.x_column) and _is_metric_like(profile, chart.y_column)):
                errors.append({"code": "invalid_scatter_axes", "chart_id": chart_id})
        if chart.chart_type == "histogram":
            target = chart.x_column or chart.y_column
            if not target or not _is_metric_like(profile, target):
                errors.append({"code": "invalid_histogram_target", "chart_id": chart_id})
        if chart.page_id and page_ids and chart.page_id not in page_ids:
            errors.append({"code": "unknown_page_id", "chart_id": chart_id, "page_id": chart.page_id})

    for index, kpi in enumerate(plan.kpis):
        kpi_id = kpi.kpi_id or f"kpi_{index + 1}"
        if kpi.column and kpi.column not in valid_columns:
            errors.append({"code": "unknown_kpi_column", "kpi_id": kpi_id, "column": kpi.column})
        if kpi.column and kpi.column in excluded and kpi.aggregation not in {"count", "unique_count"}:
            errors.append({"code": "excluded_kpi_column", "kpi_id": kpi_id, "column": kpi.column})
        if kpi.column and _is_rate_metric(profile, kpi.column) and kpi.aggregation == "sum":
            errors.append({"code": "rate_sum_kpi", "kpi_id": kpi_id, "column": kpi.column})

    return errors


def repair_dashboard_plan(
    plan: DashboardPlan,
    profile: Any,
    candidates: list[dict[str, Any]],
    errors: list[dict[str, Any]],
) -> DashboardPlan:
    repaired = plan.model_copy(deep=True)
    by_chart: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_kpi: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for error in errors:
        if "chart_id" in error:
            by_chart[str(error["chart_id"])].append(error)
        if "kpi_id" in error:
            by_kpi[str(error["kpi_id"])].append(error)

    kept_charts: list[ChartPlan] = []
    for index, chart in enumerate(repaired.charts):
        chart.chart_id = chart.chart_id or f"chart_{index + 1}"
        chart_errors = by_chart.get(chart.chart_id, [])
        error_codes = {error["code"] for error in chart_errors}
        if "rate_sum" in error_codes and chart.y_column and _is_rate_metric(profile, chart.y_column):
            chart.aggregation = "mean"
            chart_errors = [error for error in chart_errors if error["code"] != "rate_sum"]
            error_codes.discard("rate_sum")
        if chart.chart_type == "grouped_bar":
            chart.chart_type = "bar"
        if error_codes & {
            "unknown_column",
            "excluded_column",
            "invalid_chart_type",
            "line_without_time",
            "invalid_scatter_axes",
            "invalid_histogram_target",
        }:
            continue
        if not chart.explanation and chart.reason_selected:
            chart.explanation = chart.reason_selected
        kept_charts.append(chart)

    used_signatures = {_chart_signature(chart) for chart in kept_charts}
    for candidate in candidates:
        if len(kept_charts) >= MAX_DASHBOARD_CHARTS:
            break
        chart = _chart_from_candidate(candidate, len(kept_charts) + 1)
        signature = _chart_signature(chart)
        if signature in used_signatures:
            continue
        if validate_dashboard_plan(DashboardPlan(charts=[chart]), profile, candidates):
            continue
        used_signatures.add(signature)
        kept_charts.append(chart)

    for index, chart in enumerate(kept_charts, start=1):
        chart.chart_id = chart.chart_id or f"chart_{index}"
        if not chart.page_id:
            chart.page_id = "overview"
    repaired.charts = kept_charts

    repaired.kpis = _repair_kpis(repaired.kpis, profile, by_kpi)
    if not repaired.kpis:
        repaired.kpis = [
            KpiPlan(
                kpi_id=item["kpi_id"],
                title=item["title"],
                column=item["column"],
                aggregation=item["aggregation"],
                business_question=item.get("business_question", ""),
                explanation=item.get("reason", ""),
            )
            for item in generate_kpi_candidates(profile)[:5]
        ]
    repaired.pages = _repair_pages(repaired.pages, repaired.charts)
    return adapt_dashboard_plan_for_legacy_frontend(repaired)


def adapt_dashboard_plan_for_legacy_frontend(plan: DashboardPlan) -> DashboardPlan:
    adapted = plan.model_copy(deep=True)
    if adapted.pages:
        adapted.layout.page_titles = [
            str(page.get("title") or page.get("objective") or f"Page {index + 1}")
            for index, page in enumerate(adapted.pages)
            if isinstance(page, dict)
        ]
    for chart in adapted.charts:
        if chart.chart_type == "grouped_bar":
            chart.chart_type = "bar"
        if not chart.explanation:
            chart.explanation = chart.reason_selected or chart.business_question
    return adapted


def _dashboard_output_schema() -> dict[str, Any]:
    return {
        "title": "string",
        "description": "string",
        "dataset_summary": {
            "row_grain": "string",
            "main_entities": ["string"],
            "main_metrics": ["string"],
            "main_rate_metrics": ["string"],
            "main_dimensions": ["string"],
            "time_fields": ["string"],
            "excluded_fields": [{"column": "existing column name", "reason": "identifier | constant | near_constant | text | weak_variation | not_analytical"}],
        },
        "kpis": [
            {
                "kpi_id": "string",
                "title": "string",
                "column": "existing column name or null",
                "aggregation": "sum | mean | median | min | max | count | unique_count",
                "business_question": "string",
                "explanation": "string",
            }
        ],
        "pages": [{"page_id": "string", "title": "string", "objective": "string", "chart_ids": ["string"]}],
        "charts": [
            {
                "chart_id": "string",
                "page_id": "string",
                "title": "string",
                "business_question": "string",
                "analysis_type": "trend | ranking | comparison | distribution | relationship | composition | outlier",
                "chart_type": "bar | stacked_bar | line | scatter | histogram | box | pie | correlation_heatmap",
                "x_column": "existing column name or null",
                "y_column": "existing column name or null",
                "color_column": "existing column name or null",
                "aggregation": "sum | mean | median | min | max | count | unique_count | null",
                "sort": "desc | asc | chronological | none",
                "limit": "number or null",
                "reason_selected": "string",
                "explanation": "string",
            }
        ],
        "limits": "Use 3-4 KPIs and 4-6 charts. Prefer fewer charts over weak or duplicated views.",
        "insights": ["string"],
    }


def _candidate(
    *,
    analysis_type: str,
    question: str,
    chart_type: str,
    x_column: str | None,
    y_column: str | None,
    color_column: str | None,
    aggregation: str | None,
    sort: str,
    limit: int | None,
    reason: str,
) -> dict[str, Any]:
    return {
        "relationship_id": "",
        "analysis_type": analysis_type,
        "question": question,
        "recommended_chart_type": chart_type,
        "x_column": x_column,
        "y_column": y_column,
        "color_column": color_column,
        "aggregation": aggregation,
        "sort": sort,
        "limit": limit,
        "strength": "medium",
        "score": 0,
        "reason": reason,
    }


def _chart_from_candidate(candidate: dict[str, Any], index: int) -> ChartPlan:
    chart_type = candidate.get("recommended_chart_type") or "bar"
    if chart_type == "grouped_bar":
        chart_type = "bar"
    return ChartPlan(
        chart_id=f"chart_{index}",
        page_id="overview",
        title=_title_from_candidate(candidate),
        chart_type=chart_type,
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


def _title_from_candidate(candidate: dict[str, Any]) -> str:
    y_column = candidate.get("y_column")
    x_column = candidate.get("x_column")
    chart_type = candidate.get("recommended_chart_type")
    if chart_type == "correlation_heatmap":
        return "Metric Relationship Heatmap"
    if y_column and x_column:
        return f"{_label(y_column)} by {_label(x_column)}" if candidate.get("analysis_type") != "trend" else f"{_label(y_column)} Trend"
    if x_column:
        return f"{_label(x_column)} Distribution"
    return str(candidate.get("question") or "Analytical View")[:80]


def _repair_kpis(
    kpis: list[KpiPlan],
    profile: Any,
    by_kpi: dict[str, list[dict[str, Any]]],
) -> list[KpiPlan]:
    repaired: list[KpiPlan] = []
    excluded = _excluded_columns(profile)
    for index, kpi in enumerate(kpis):
        kpi.kpi_id = kpi.kpi_id or f"kpi_{index + 1}"
        codes = {error["code"] for error in by_kpi.get(kpi.kpi_id, [])}
        if kpi.column and kpi.column in excluded and kpi.aggregation not in {"count", "unique_count"}:
            continue
        if "rate_sum_kpi" in codes and kpi.column and _is_rate_metric(profile, kpi.column):
            kpi.aggregation = "mean"
        repaired.append(kpi)
    return repaired[:MAX_DASHBOARD_KPIS]


def _repair_pages(pages: list[dict[str, Any]], charts: list[ChartPlan]) -> list[dict[str, Any]]:
    if not charts:
        return []
    chart_ids = [chart.chart_id for chart in charts]
    valid_chart_ids = set(chart_ids)
    repaired: list[dict[str, Any]] = []
    for page in pages:
        if not isinstance(page, dict):
            continue
        kept_ids = [chart_id for chart_id in page.get("chart_ids", []) if chart_id in valid_chart_ids]
        if not kept_ids:
            continue
        page_id = str(page.get("page_id") or f"page_{len(repaired) + 1}")
        repaired.append(
            {
                "page_id": page_id,
                "title": str(page.get("title") or "Executive Overview"),
                "objective": str(page.get("objective") or "Summarize the strongest dashboard relationships."),
                "chart_ids": kept_ids,
            }
        )
    assigned = {chart_id for page in repaired for chart_id in page["chart_ids"]}
    unassigned = [chart_id for chart_id in chart_ids if chart_id not in assigned]
    if unassigned or not repaired:
        repaired.insert(
            0,
            {
                "page_id": "overview",
                "title": "Executive Overview",
                "objective": "Summarize the strongest dashboard relationships.",
                "chart_ids": chart_ids if not repaired else unassigned,
            },
        )
    page_lookup = {chart_id: page["page_id"] for page in repaired for chart_id in page["chart_ids"]}
    for chart in charts:
        chart.page_id = page_lookup.get(chart.chart_id, "overview")
    return repaired


def _chart_signature(chart: ChartPlan) -> tuple[Any, ...]:
    return (chart.chart_type, chart.x_column, chart.y_column, chart.color_column, chart.aggregation)


def _metric_columns(profile: Any) -> list[str]:
    values = list(getattr(profile, "metric_candidates", []) or [])
    if values:
        return values
    return [
        column.name
        for column in profile.columns
        if column.role in {"metric", "measure"} and column.name in profile.numeric_columns
    ]


def _rate_metric_columns(profile: Any) -> list[str]:
    values = list(getattr(profile, "rate_metric_candidates", []) or [])
    if values:
        return values
    return [
        column.name
        for column in profile.columns
        if column.role == "rate_metric" and column.name in profile.numeric_columns
    ]


def _dimension_columns(profile: Any) -> list[str]:
    values = list(getattr(profile, "dimension_candidates", []) or [])
    if values:
        return values
    return [
        column.name
        for column in profile.columns
        if column.role in {"dimension", "geo"} and column.name in profile.categorical_columns
    ]


def _time_columns(profile: Any) -> list[str]:
    values = list(getattr(profile, "time_candidates", []) or [])
    if values:
        return values
    return [
        column.name
        for column in profile.columns
        if column.role in {"time", "datetime"} or column.name in profile.datetime_columns
    ]


def _excluded_columns(profile: Any) -> set[str]:
    excluded = set(getattr(profile, "excluded_columns", []) or [])
    quality = getattr(profile, "data_quality", {}) or {}
    for key in ("constant_columns", "near_constant_columns", "id_like_columns", "mostly_missing_columns"):
        excluded.update(quality.get(key, []))
    return excluded


def _column(profile: Any, name: str | None) -> Any | None:
    if not name:
        return None
    return next((column for column in profile.columns if column.name == name), None)


def _role(profile: Any, name: str | None) -> str | None:
    column = _column(profile, name)
    return column.role if column else None


def _is_metric(profile: Any, name: str | None) -> bool:
    return bool(name and (name in _metric_columns(profile) or _role(profile, name) in {"metric", "measure"}))


def _is_rate_metric(profile: Any, name: str | None) -> bool:
    return bool(name and (name in _rate_metric_columns(profile) or _role(profile, name) == "rate_metric"))


def _is_metric_like(profile: Any, name: str | None) -> bool:
    return _is_metric(profile, name) or _is_rate_metric(profile, name)


def _is_dimension(profile: Any, name: str | None) -> bool:
    return bool(name and (name in _dimension_columns(profile) or _role(profile, name) in {"dimension", "geo"}))


def _is_time(profile: Any, name: str | None) -> bool:
    return bool(name and (name in _time_columns(profile) or _role(profile, name) in {"time", "datetime"}))


def _default_aggregation(profile: Any, column: str) -> str:
    item = _column(profile, column)
    if item and item.default_aggregation and item.default_aggregation != "none":
        return item.default_aggregation
    return "mean" if _is_rate_metric(profile, column) else "sum"


def _numeric_summary(profile: Any, column: str) -> dict[str, Any]:
    return dict((profile.numeric_summaries or {}).get(column, {}))


def _categorical_summary(profile: Any, column: str) -> dict[str, Any]:
    return dict((profile.categorical_summaries or {}).get(column, {}))


def _top_correlations(profile: Any) -> list[dict[str, Any]]:
    if getattr(profile, "top_correlations", None):
        return list(profile.top_correlations)
    return list((profile.data_quality or {}).get("top_correlations", []))


def _time_unique_count(profile: Any, column: str) -> int:
    for item in getattr(profile, "time_series", []) or (profile.data_quality or {}).get("time_series", []):
        if item.get("column") == column:
            return int(item.get("unique_count") or item.get("n_distinct_days") or 0)
    profiled = _column(profile, column)
    return int(profiled.unique_count if profiled else 0)


def _label(column: str) -> str:
    return column.replace("_", " ").replace("-", " ").title()

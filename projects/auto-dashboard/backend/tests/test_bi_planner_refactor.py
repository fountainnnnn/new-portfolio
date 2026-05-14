import json
import os

os.environ["OPENAI_API_KEY"] = ""
os.environ["OPENAI_MODEL"] = "gpt-4o-mini"
os.environ["OPENAI_PLANNER_MODEL"] = "gpt-4o-mini"

from app.models.schemas import ChartPlan, DashboardPlan
from app.services.bi_planner import (
    build_compact_planner_payload,
    filter_top_candidates,
    generate_kpi_candidates,
    generate_relationship_candidates,
    repair_dashboard_plan,
    validate_dashboard_plan,
)
from app.services.data_profiler import DataProfiler
from app.services.openai_dashboard_agent import OpenAIDashboardAgent


def _profile_from_csv(text: str):
    return DataProfiler().profile_csv(text.encode("utf-8"), "dataset.csv")


def _role(profile, column: str) -> str | None:
    return next(item.role for item in profile.columns if item.name == column)


def _aggregation(profile, column: str) -> str | None:
    return next(item.default_aggregation for item in profile.columns if item.name == column)


def test_semantic_roles_keep_business_metrics_and_rates_out_of_id_bucket() -> None:
    rows = ["month,institution,qualification,department,student_id,students,applications,completion_rate"]
    for index in range(36):
        rows.append(
            f"2025-{index % 12 + 1:02d}-01,Institution {index % 4},Qual {index % 3},Dept {index % 5},"
            f"{10000 + index},{200 + index * 7},{80 + index * 5},{0.62 + (index % 8) / 100:.2f}"
        )

    _, profile = _profile_from_csv("\n".join(rows))

    assert _role(profile, "student_id") == "identifier"
    assert _role(profile, "students") == "metric"
    assert _role(profile, "applications") == "metric"
    assert _role(profile, "completion_rate") == "rate_metric"
    assert _aggregation(profile, "completion_rate") == "mean"
    assert "students" in profile.metric_candidates
    assert "completion_rate" in profile.rate_metric_candidates
    assert "student_id" in profile.identifier_candidates
    assert "student_id" in profile.excluded_columns
    assert profile.possible_row_grain == "one monthly record per institution, qualification, and department"


def test_relationship_and_kpi_candidates_are_generated_before_llm() -> None:
    rows = ["month,institution,qualification,department,teachers,students,applications,completion_rate"]
    for index in range(48):
        rows.append(
            f"2025-{index % 12 + 1:02d}-01,Institution {index % 4},Qual {index % 3},Dept {index % 4},"
            f"{12 + index % 6},{200 + index * 3},{80 + index * 4},{0.70 + (index % 6) / 100:.2f}"
        )
    _, profile = _profile_from_csv("\n".join(rows))

    candidates = filter_top_candidates(generate_relationship_candidates(profile), max_candidates=30)
    kpis = generate_kpi_candidates(profile)

    assert any(
        candidate["analysis_type"] == "trend"
        and candidate["x_column"] == "month"
        and candidate["y_column"] == "applications"
        and candidate["aggregation"] == "sum"
        for candidate in candidates
    )
    assert any(
        candidate["analysis_type"] == "trend"
        and candidate["y_column"] == "completion_rate"
        and candidate["aggregation"] == "mean"
        for candidate in candidates
    )
    assert any(
        candidate["analysis_type"] == "ranking"
        and candidate["x_column"] == "institution"
        and candidate["y_column"] == "applications"
        for candidate in candidates
    )
    assert not any(candidate["y_column"] == "completion_rate" and candidate["aggregation"] == "sum" for candidate in candidates)
    assert any(kpi["column"] == "applications" and kpi["aggregation"] == "sum" for kpi in kpis)
    assert any(kpi["column"] == "completion_rate" and kpi["aggregation"] == "mean" for kpi in kpis)


def test_compact_payload_sends_candidates_not_verbose_profile_to_llm() -> None:
    rows = ["date,channel,order_id,sales,profit,conversion_rate"]
    for index in range(40):
        rows.append(
            f"2025-01-{index % 28 + 1:02d},{['Online', 'Retail', 'Partner'][index % 3]},"
            f"ORD-{index:04d},{100 + index * 12},{20 + index * 3},{0.04 + (index % 5) / 100:.2f}"
        )
    _, profile = _profile_from_csv("\n".join(rows))

    payload = build_compact_planner_payload("Create a sales dashboard", profile)
    system_prompt = OpenAIDashboardAgent()._planner_system_prompt()

    assert set(payload) >= {
        "dataset_summary",
        "candidate_relationships",
        "kpi_candidates",
        "allowed_chart_types",
        "output_schema",
    }
    assert "dataset_profile" not in payload
    assert len(payload["candidate_relationships"]) <= 30
    assert "order_id" in payload["dataset_summary"]["excluded_fields"]
    assert len(system_prompt) < 1200
    assert len(json.dumps(payload, default=str).encode("utf-8")) < 10000


def test_plan_validation_repairs_rate_sums_and_removes_id_groupings() -> None:
    rows = ["date,customer_id,channel,impressions,clicks,ctr"]
    for index in range(32):
        rows.append(
            f"2025-01-{index % 28 + 1:02d},CUST-{index:04d},{['Search', 'Social', 'Email'][index % 3]},"
            f"{1000 + index * 20},{80 + index * 4},{0.05 + (index % 4) / 100:.2f}"
        )
    _, profile = _profile_from_csv("\n".join(rows))
    candidates = filter_top_candidates(generate_relationship_candidates(profile), max_candidates=30)
    plan = DashboardPlan(
        title="Marketing Performance",
        description="Bad LLM plan",
        charts=[
            ChartPlan(
                chart_id="bad_rate",
                title="CTR Trend",
                chart_type="line",
                x_column="date",
                y_column="ctr",
                aggregation="sum",
            ),
            ChartPlan(
                chart_id="bad_id",
                title="Clicks by Customer",
                chart_type="bar",
                x_column="customer_id",
                y_column="clicks",
                aggregation="sum",
            ),
        ],
    )

    errors = validate_dashboard_plan(plan, profile, candidates)
    repaired = repair_dashboard_plan(plan, profile, candidates, errors)

    assert any(error["code"] == "rate_sum" for error in errors)
    assert any(error["code"] == "excluded_column" for error in errors)
    repaired_rate = next(chart for chart in repaired.charts if chart.chart_id == "bad_rate")
    assert repaired_rate.aggregation == "mean"
    assert all(chart.x_column != "customer_id" for chart in repaired.charts)


def test_fallback_planner_keeps_dashboard_chart_count_readable() -> None:
    rows = ["date,region,segment,sales,profit,orders,conversion_rate"]
    for index in range(72):
        rows.append(
            f"2025-{index % 12 + 1:02d}-01,{['North', 'South', 'East', 'West'][index % 4]},"
            f"{['Consumer', 'Enterprise', 'Public'][index % 3]},"
            f"{1000 + index * 17},{200 + index * 5},{10 + index % 8},{0.05 + (index % 6) / 100:.2f}"
        )
    _, profile = _profile_from_csv("\n".join(rows))

    plan = OpenAIDashboardAgent()._fallback_plan(profile, "Create an executive sales dashboard")

    assert 4 <= len(plan.charts) <= 6

import io
import logging
import time

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    AgentToolCall,
    ChartPlan,
    ChartSpecUpdateRequest,
    ChartUpdateRequest,
    ChatSessionRequest,
    ChatSessionResponse,
    DashboardFilterControl,
    DashboardFilterOption,
    DashboardFilterRequest,
    DashboardGenerateRequest,
    DashboardLayout,
    DashboardLayoutUpdateRequest,
    DashboardPlan,
    DashboardRefineRequest,
    ChartResponse,
    DashboardResponse,
    DashboardSpec,
    DashboardSpecUpdateRequest,
    DatasetProfile,
    DatasetUploadResponse,
    LayoutItem,
)
from app.models.schemas import AiPatchRequest, AiPatchResponse
from app.services.ai_patch_planner import AiPatchPlanner
from app.services.chart_generator import ChartGenerator
from app.services.data_profiler import CsvProfileError, DataProfiler
from app.services.openai_dashboard_agent import OpenAIDashboardAgent
from app.services.powerbi_exporter import PowerBIExportUnavailableError, PowerBIExporter
from app.services.storage import storage


logger = logging.getLogger(__name__)

router = APIRouter()
profiler = DataProfiler()
agent = OpenAIDashboardAgent()
chart_generator = ChartGenerator()
powerbi_exporter = PowerBIExporter()
ai_patch_planner = AiPatchPlanner()

THEME_PROMPT_MAP = {
    "midnight": ("midnight", "dark", "black"),
    "finance": ("finance", "financial", "investor"),
    "editorial": ("editorial", "magazine", "report"),
    "neon": ("neon", "vibrant", "bright"),
    "minimal": ("minimal", "simple", "clean"),
}


@router.get("/debug/openai-ping")
async def debug_openai_ping() -> dict[str, object]:
    """Live probe so you can see whether the configured OpenAI model actually works."""
    if not agent.settings.openai_api_key:
        return {"ok": False, "reason": "OPENAI_API_KEY not set", "model": agent.settings.openai_model}
    try:
        from openai import OpenAI

        client = OpenAI(api_key=agent.settings.openai_api_key)
        kwargs: dict[str, object] = {
            "model": agent.settings.openai_model,
            "messages": [{"role": "user", "content": "Reply with the single word: pong"}],
        }
        if agent._supports_reasoning_effort(agent.settings.openai_model):
            kwargs["reasoning_effort"] = agent.settings.openai_reasoning_effort
        else:
            kwargs["temperature"] = 0
        response = client.chat.completions.create(**kwargs)
        return {
            "ok": True,
            "model": agent.settings.openai_model,
            "reply": (response.choices[0].message.content or "").strip(),
        }
    except Exception as exc:  # noqa: BLE001 - surface the real error
        return {
            "ok": False,
            "model": agent.settings.openai_model,
            "error_type": type(exc).__name__,
            "error": str(exc),
        }


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetUploadResponse:
    filename = file.filename or "dataset.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    try:
        contents = await file.read()
        dataframe, profile = profiler.profile_csv(contents, filename)
    except CsvProfileError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    record = storage.save_dataset(filename=filename, dataframe=dataframe, profile=profile)
    return DatasetUploadResponse(dataset_id=record.dataset_id, filename=record.filename, profile=record.profile)


@router.get("/dataset/{dataset_id}/profile", response_model=DatasetProfile)
async def get_dataset_profile(dataset_id: str) -> DatasetProfile:
    record = storage.get_dataset(dataset_id)
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return record.profile


@router.get("/chat-sessions", response_model=list[ChatSessionResponse])
async def list_chat_sessions() -> list[ChatSessionResponse]:
    return storage.list_chat_sessions()


@router.get("/chat-sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(session_id: str) -> ChatSessionResponse:
    session = storage.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return session


@router.put("/chat-sessions/{session_id}", response_model=ChatSessionResponse)
async def save_chat_session(session_id: str, request: ChatSessionRequest) -> ChatSessionResponse:
    if session_id != request.session_id:
        raise HTTPException(status_code=400, detail="Session ID mismatch.")
    return storage.save_chat_session(request)


@router.delete("/chat-sessions/{session_id}", status_code=204)
async def delete_chat_session(session_id: str) -> None:
    deleted = storage.delete_chat_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat session not found.")


@router.get("/dashboard/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(dashboard_id: str) -> DashboardResponse:
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return dashboard_record.dashboard


@router.post("/dashboard/generate", response_model=DashboardResponse)
async def generate_dashboard(request: DashboardGenerateRequest) -> DashboardResponse:
    overall_start = time.perf_counter()
    record = storage.get_dataset(request.dataset_id)
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    tool_calls = [
        AgentToolCall(
            tool_name="inspect_dataset_profile",
            summary="Read the uploaded dataset profile and selected useful dimensions, metrics, and dates.",
            input={"dataset_id": record.dataset_id},
            output={
                "rows": record.profile.row_count,
                "columns": record.profile.column_count,
                "numeric_columns": record.profile.numeric_columns,
                "categorical_columns": record.profile.categorical_columns,
                "datetime_columns": record.profile.datetime_columns,
            },
        )
    ]
    plan_started = time.perf_counter()
    plan_result = agent.plan_dashboard_detailed(record.profile, request.user_prompt)
    plan = plan_result.plan
    plan_elapsed_ms = (time.perf_counter() - plan_started) * 1000
    tool_calls.append(
        AgentToolCall(
            tool_name="plan_dashboard",
            status="completed" if plan_result.source == "openai" else "fallback",
            summary=(
                plan_result.detail or "OpenAI produced the dashboard plan from the user request and dataset schema."
                if plan_result.source == "openai"
                else plan_result.detail or "OpenAI call was not used; used deterministic rule-based planner."
            ),
            input={"user_prompt": request.user_prompt, "model": agent.settings.openai_model},
            output={
                "charts": len(plan.charts),
                "kpis": len(plan.kpis),
                "insights": len(plan.insights),
                "title": plan.title,
                "plan_source": plan_result.source,
                "fallback_reason": plan_result.detail,
                "elapsed_ms": round(plan_elapsed_ms),
                "llm_reasoning_used": plan_result.source == "openai",
                "fallback_only_on_failure": True,
            },
        )
    )
    tool_calls.append(
        AgentToolCall(
            tool_name="validate_dashboard_plan",
            summary="Validated chart and KPI references against real dataset columns before rendering.",
            input={"available_columns": record.profile.column_names},
            output={"valid_charts": len(plan.charts), "valid_kpis": len(plan.kpis)},
        )
    )
    tool_calls.append(
        AgentToolCall(
            tool_name="apply_dashboard_theme",
            summary="Applied the selected dashboard visual system to Plotly layout and chart styling.",
            input={"theme": request.theme},
            output={"theme": request.theme},
        )
    )
    chart_started = time.perf_counter()
    dashboard = chart_generator.generate_dashboard(
        dataset_id=record.dataset_id,
        plan=plan,
        dataframe=record.dataframe,
        profile=record.profile,
        theme=request.theme,
        tool_calls=tool_calls,
        controls=_build_filter_controls(record.dataframe, record.profile, plan),
    )
    chart_elapsed_ms = (time.perf_counter() - chart_started) * 1000
    total_elapsed_ms = (time.perf_counter() - overall_start) * 1000
    dashboard.tool_calls.append(
        AgentToolCall(
            tool_name="generation_timing",
            summary=f"Generated dashboard in {total_elapsed_ms / 1000:.1f}s (plan {plan_elapsed_ms / 1000:.1f}s, build {chart_elapsed_ms / 1000:.1f}s).",
            output={
                "total_ms": round(total_elapsed_ms),
                "plan_ms": round(plan_elapsed_ms),
                "build_ms": round(chart_elapsed_ms),
                "plan_source": plan_result.source,
                "server_plotly_render": False,
            },
        )
    )
    logger.info(
        "/dashboard/generate complete: total=%.0fms (plan=%.0fms charts=%.0fms charts=%d kpis=%d source=%s)",
        total_elapsed_ms,
        plan_elapsed_ms,
        chart_elapsed_ms,
        len(dashboard.charts),
        len(dashboard.kpis),
        plan_result.source,
    )
    storage.save_dashboard(
        record.dataset_id,
        dashboard,
        metadata={
            "user_prompt": request.user_prompt,
            "plan": plan.model_dump(),
            "theme": dashboard.theme,
            "controls": [control.model_dump() for control in dashboard.controls],
        },
    )
    return dashboard


@router.post("/dashboard/refine", response_model=DashboardResponse)
async def refine_dashboard(request: DashboardRefineRequest) -> DashboardResponse:
    dashboard_record = storage.get_dashboard(request.dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")

    dataset_record = storage.get_dataset(dashboard_record.dataset_id)
    if not dataset_record:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    stored_plan = dashboard_record.metadata.get("plan")
    if stored_plan:
        current_plan = DashboardPlan.model_validate(stored_plan)
    else:
        current_plan = DashboardPlan(
            title=dashboard_record.dashboard.title,
            description=dashboard_record.dashboard.description,
            insights=dashboard_record.dashboard.insights,
        )

    refine_started = time.perf_counter()
    plan_result = agent.refine_dashboard_detailed(dataset_record.profile, current_plan, request.user_prompt)
    plan = plan_result.plan
    refine_plan_elapsed_ms = (time.perf_counter() - refine_started) * 1000
    theme = _theme_from_prompt(request.user_prompt) or request.theme or dashboard_record.metadata.get("theme") or dashboard_record.dashboard.theme
    tool_calls = [
        AgentToolCall(
            tool_name="load_current_dashboard",
            summary="Loaded the current dashboard plan and previous generated Plotly dashboard.",
            input={"dashboard_id": request.dashboard_id},
            output={"current_theme": dashboard_record.dashboard.theme, "charts": len(dashboard_record.dashboard.charts)},
        ),
        AgentToolCall(
            tool_name="revise_dashboard_plan",
            status="completed" if plan_result.source == "openai" else "fallback",
            summary=(
                "OpenAI revised the dashboard plan from the chat refinement request."
                if plan_result.source == "openai"
                else plan_result.detail or "OpenAI call was not used; used deterministic rule-based refiner."
            ),
            input={"user_prompt": request.user_prompt, "model": agent.settings.openai_model},
            output={
                "charts": len(plan.charts),
                "kpis": len(plan.kpis),
                "insights": len(plan.insights),
                "title": plan.title,
                "plan_source": plan_result.source,
                "fallback_reason": plan_result.detail,
                "elapsed_ms": round(refine_plan_elapsed_ms),
                "llm_reasoning_used": plan_result.source == "openai",
                "fallback_only_on_failure": True,
            },
        ),
        AgentToolCall(
            tool_name="validate_dashboard_plan",
            summary="Checked revised chart references against the saved dataset columns.",
            input={"available_columns": dataset_record.profile.column_names},
            output={"valid_charts": len(plan.charts), "valid_kpis": len(plan.kpis)},
        ),
        AgentToolCall(
            tool_name="render_plotly_dashboard",
            summary="Regenerated theme-aware Plotly JSON and reusable Plotly code for the dashboard.",
            input={"theme": theme},
            output={"theme": theme},
        ),
    ]
    refine_build_started = time.perf_counter()
    dashboard = chart_generator.generate_dashboard(
        dataset_id=dataset_record.dataset_id,
        plan=plan,
        dataframe=dataset_record.dataframe,
        profile=dataset_record.profile,
        theme=theme,
        tool_calls=tool_calls,
        controls=_build_filter_controls(dataset_record.dataframe, dataset_record.profile, plan),
    )
    refine_build_elapsed_ms = (time.perf_counter() - refine_build_started) * 1000
    dashboard.tool_calls.append(
        AgentToolCall(
            tool_name="refine_timing",
            summary=f"Applied dashboard tweak in {(refine_plan_elapsed_ms + refine_build_elapsed_ms) / 1000:.1f}s (plan {refine_plan_elapsed_ms / 1000:.1f}s, build {refine_build_elapsed_ms / 1000:.1f}s).",
            output={
                "total_ms": round(refine_plan_elapsed_ms + refine_build_elapsed_ms),
                "plan_ms": round(refine_plan_elapsed_ms),
                "build_ms": round(refine_build_elapsed_ms),
                "plan_source": plan_result.source,
                "server_plotly_render": False,
            },
        )
    )
    storage.save_dashboard(
        dataset_record.dataset_id,
        dashboard,
        metadata={
            "user_prompt": request.user_prompt,
            "plan": plan.model_dump(),
            "theme": dashboard.theme,
            "refined_from": request.dashboard_id,
            "controls": [control.model_dump() for control in dashboard.controls],
        },
    )
    return dashboard


@router.post("/dashboard/{dashboard_id}/filter", response_model=DashboardResponse)
async def filter_dashboard(dashboard_id: str, request: DashboardFilterRequest) -> DashboardResponse:
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")

    dataset_record = storage.get_dataset(dashboard_record.dataset_id)
    if not dataset_record:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    stored_plan = dashboard_record.metadata.get("plan")
    if stored_plan:
        plan = DashboardPlan.model_validate(stored_plan)
    else:
        plan = DashboardPlan(
            title=dashboard_record.dashboard.title,
            description=dashboard_record.dashboard.description,
            insights=dashboard_record.dashboard.insights,
        )

    filtered_dataframe = _apply_dashboard_filters(dataset_record.dataframe, request)
    controls = _build_filter_controls(dataset_record.dataframe, dataset_record.profile, plan)
    theme = dashboard_record.metadata.get("theme") or dashboard_record.dashboard.theme
    tool_calls = [
        AgentToolCall(
            tool_name="apply_dashboard_filters",
            summary="Applied dashboard-level picker selections to the saved CSV before regenerating Plotly charts.",
            input=request.model_dump(),
            output={
                "filtered_rows": int(len(filtered_dataframe)),
                "total_rows": int(len(dataset_record.dataframe)),
            },
        )
    ]
    dashboard = chart_generator.generate_dashboard(
        dataset_id=dataset_record.dataset_id,
        plan=plan,
        dataframe=filtered_dataframe,
        profile=dataset_record.profile,
        theme=theme,
        tool_calls=tool_calls,
        controls=controls,
        active_filters=request,
        total_row_count=int(len(dataset_record.dataframe)),
    )
    storage.save_dashboard(
        dataset_record.dataset_id,
        dashboard,
        metadata={
            **dashboard_record.metadata,
            "theme": dashboard.theme,
            "controls": [control.model_dump() for control in dashboard.controls],
            "filtered_from": dashboard_id,
        },
    )
    return dashboard


@router.put("/dashboard/{dashboard_id}/layout", response_model=DashboardResponse)
async def update_dashboard_layout(
    dashboard_id: str, request: DashboardLayoutUpdateRequest
) -> DashboardResponse:
    """Persist a new grid layout for a dashboard (drag/resize from the editor)."""
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")

    # Sanitize incoming layout so it's still a valid non-overlapping 12-col grid.
    stored_plan = dashboard_record.metadata.get("plan")
    plan = DashboardPlan.model_validate(stored_plan) if stored_plan else DashboardPlan(
        title=dashboard_record.dashboard.title,
        description=dashboard_record.dashboard.description,
        insights=dashboard_record.dashboard.insights,
        kpis=[],
        charts=[],
    )
    plan.layout = request.layout
    plan.layout = agent._sanitize_layout(plan)

    dashboard = dashboard_record.dashboard.model_copy(deep=True)
    dashboard.layout = plan.layout

    storage.save_dashboard(
        dashboard_record.dataset_id,
        dashboard,
        metadata={**dashboard_record.metadata, "plan": plan.model_dump()},
    )
    return dashboard


@router.patch("/dashboard/{dashboard_id}/chart/{chart_id}", response_model=DashboardResponse)
async def update_dashboard_chart(
    dashboard_id: str, chart_id: str, request: ChartUpdateRequest
) -> DashboardResponse:
    """Update one chart's properties (type, columns, title, color) and regenerate just that chart."""
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    dataset_record = storage.get_dataset(dashboard_record.dataset_id)
    if not dataset_record:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    stored_plan = dashboard_record.metadata.get("plan")
    if not stored_plan:
        raise HTTPException(status_code=409, detail="Dashboard has no stored plan to edit.")
    plan = DashboardPlan.model_validate(stored_plan)

    chart_plan = next((c for c in plan.charts if c.chart_id == chart_id), None)
    if not chart_plan:
        raise HTTPException(status_code=404, detail="Chart not found in dashboard plan.")

    valid_columns = set(dataset_record.profile.column_names)
    updates = request.model_dump(exclude_unset=True, exclude_none=True)
    # Validate column refs before applying.
    for col_field in ("x_column", "y_column", "color_column"):
        if col_field in updates and updates[col_field] not in valid_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown column '{updates[col_field]}' for {col_field}.",
            )
    color_override = updates.pop("color_override", None)
    for field_name, value in updates.items():
        setattr(chart_plan, field_name, value)

    try:
        new_chart = chart_generator.generate_chart(
            chart_plan=chart_plan,
            dataframe=dataset_record.dataframe,
            profile=dataset_record.profile,
            theme=dashboard_record.dashboard.theme,
        )
    except Exception as exc:  # noqa: BLE001 - surface chart generation errors
        raise HTTPException(status_code=400, detail=f"Could not regenerate chart: {exc}") from exc

    if color_override:
        # Apply a per-chart color override by tinting the primary traces.
        try:
            traces = new_chart.plotly_json.get("data") or []
            for trace in traces:
                trace.setdefault("marker", {})
                trace["marker"]["color"] = color_override
                if "line" in trace and isinstance(trace["line"], dict):
                    trace["line"]["color"] = color_override
        except Exception:  # noqa: BLE001
            pass

    dashboard = dashboard_record.dashboard.model_copy(deep=True)
    dashboard.charts = [new_chart if c.chart_id == chart_id else c for c in dashboard.charts]

    storage.save_dashboard(
        dashboard_record.dataset_id,
        dashboard,
        metadata={**dashboard_record.metadata, "plan": plan.model_dump()},
    )
    return dashboard


@router.put("/dashboard/{dashboard_id}/chart/{chart_id}/spec", response_model=DashboardResponse)
async def update_chart_spec(
    dashboard_id: str, chart_id: str, request: ChartSpecUpdateRequest
) -> DashboardResponse:
    """Replace a chart's ChartSpec without server-side regeneration.

    The browser renders charts directly from the spec, so live edits in the inspector
    panel only need to persist the new spec. The legacy plotly_json is left in place
    so snapshot exports keep working.
    """
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")

    if request.spec.chart_id != chart_id:
        raise HTTPException(status_code=400, detail="Chart id mismatch.")

    dashboard = dashboard_record.dashboard.model_copy(deep=True)
    target = next((c for c in dashboard.charts if c.chart_id == chart_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Chart not found.")
    target.spec = request.spec
    target.title = request.spec.title or target.title
    target.chart_type = request.spec.chart_type
    target.explanation = request.spec.explanation or target.explanation

    if dashboard.spec is not None:
        dashboard.spec.charts = [
            request.spec if c.chart_id == chart_id else c for c in dashboard.spec.charts
        ]

    storage.save_dashboard(
        dashboard_record.dataset_id,
        dashboard,
        metadata=dashboard_record.metadata,
    )
    return dashboard


@router.put("/dashboard/{dashboard_id}/spec", response_model=DashboardResponse)
async def update_dashboard_spec(
    dashboard_id: str, request: DashboardSpecUpdateRequest
) -> DashboardResponse:
    """Replace the entire DashboardSpec (used by undo/redo + AI patch flows)."""
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")

    dashboard = dashboard_record.dashboard.model_copy(deep=True)
    dashboard.spec = request.spec
    dashboard.title = request.spec.dashboard_title or dashboard.title
    dashboard.description = request.spec.description or dashboard.description
    dashboard.layout = request.spec.layout

    # Sync the per-chart specs back into the legacy charts list.
    spec_by_id = {chart.chart_id: chart for chart in request.spec.charts}
    new_charts = []
    for chart in dashboard.charts:
        spec = spec_by_id.get(chart.chart_id)
        if spec is not None:
            chart.spec = spec
            chart.title = spec.title or chart.title
            chart.chart_type = spec.chart_type
            chart.explanation = spec.explanation or chart.explanation
        new_charts.append(chart)
    # Drop charts that the spec removed.
    new_charts = [chart for chart in new_charts if chart.chart_id in spec_by_id]
    # Add placeholders for spec-only charts (added through AI patch).
    existing_ids = {chart.chart_id for chart in new_charts}
    for spec in request.spec.charts:
        if spec.chart_id not in existing_ids:
            new_charts.append(
                ChartResponse(
                    chart_id=spec.chart_id,
                    title=spec.title,
                    chart_type=spec.chart_type,
                    plotly_json={},
                    explanation=spec.explanation,
                    spec=spec,
                )
            )
    dashboard.charts = new_charts

    storage.save_dashboard(
        dashboard_record.dataset_id,
        dashboard,
        metadata=dashboard_record.metadata,
    )
    return dashboard


@router.post("/dashboard/{dashboard_id}/ai-patch", response_model=AiPatchResponse)
async def ai_patch_dashboard(
    dashboard_id: str, request: AiPatchRequest
) -> AiPatchResponse:
    """Run a single LLM JSON-patch operation against the DashboardSpec.

    The model never returns Plotly code; it returns a validated AiPatchOperation
    that we apply to the saved DashboardSpec.
    """
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    dataset_record = storage.get_dataset(dashboard_record.dataset_id)
    if not dataset_record:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    spec = dashboard_record.dashboard.spec or DashboardSpec(
        dashboard_title=dashboard_record.dashboard.title,
        description=dashboard_record.dashboard.description,
        charts=[c.spec for c in dashboard_record.dashboard.charts if c.spec],
        layout=dashboard_record.dashboard.layout,
    )
    try:
        operation = ai_patch_planner.plan_patch(
            instruction=request.instruction,
            spec=spec,
            profile=dataset_record.profile,
            selected_chart_id=request.selected_chart_id,
        )
        new_spec = AiPatchPlanner.apply(spec, operation)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"AI patch failed: {exc}") from exc

    dashboard = dashboard_record.dashboard.model_copy(deep=True)
    dashboard.spec = new_spec
    dashboard.title = new_spec.dashboard_title or dashboard.title
    dashboard.description = new_spec.description or dashboard.description
    dashboard.layout = new_spec.layout

    spec_by_id = {chart.chart_id: chart for chart in new_spec.charts}
    new_charts: list[ChartResponse] = []
    for chart in dashboard.charts:
        spec_chart = spec_by_id.get(chart.chart_id)
        if spec_chart is None:
            continue  # removed
        chart.spec = spec_chart
        chart.title = spec_chart.title or chart.title
        chart.chart_type = spec_chart.chart_type
        chart.explanation = spec_chart.explanation or chart.explanation
        new_charts.append(chart)
    existing_ids = {c.chart_id for c in new_charts}
    for spec_chart in new_spec.charts:
        if spec_chart.chart_id not in existing_ids:
            new_charts.append(
                ChartResponse(
                    chart_id=spec_chart.chart_id,
                    title=spec_chart.title,
                    chart_type=spec_chart.chart_type,
                    plotly_json={},
                    explanation=spec_chart.explanation,
                    spec=spec_chart,
                )
            )
    dashboard.charts = new_charts
    dashboard.tool_calls = [
        *dashboard_record.dashboard.tool_calls,
        AgentToolCall(
            tool_name="ai_dashboard_tweak",
            status="completed",
            summary=operation.summary or f"Applied dashboard tweak: {request.instruction}",
            input={"instruction": request.instruction, "selected_chart_id": request.selected_chart_id},
            output={"operation": operation.operation, "chart_id": operation.chart_id},
        ),
    ]

    storage.save_dashboard(
        dashboard_record.dataset_id,
        dashboard,
        metadata=dashboard_record.metadata,
    )
    return AiPatchResponse(operation=operation, dashboard=dashboard)


@router.get("/dataset/{dataset_id}/rows")
async def get_dataset_rows(dataset_id: str, limit: int | None = None) -> dict[str, object]:
    """Return raw dataset rows so the browser can run queries client-side.

    For very large CSVs the caller can pass `?limit=N` to cap the payload.
    """
    record = storage.get_dataset(dataset_id)
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    dataframe = record.dataframe
    if limit is not None and limit >= 0:
        dataframe = dataframe.head(limit)
    rows = dataframe.to_dict(orient="records")
    # Convert non-JSON-friendly values (timestamps, NaN, numpy types).
    safe_rows = []
    for row in rows:
        safe_row = {}
        for key, value in row.items():
            if pd.isna(value):
                safe_row[key] = None
            elif isinstance(value, pd.Timestamp):
                safe_row[key] = value.isoformat()
            else:
                safe_row[key] = value
        safe_rows.append(safe_row)
    return {
        "dataset_id": dataset_id,
        "row_count": int(len(record.dataframe)),
        "returned": len(safe_rows),
        "columns": list(record.dataframe.columns),
        "rows": safe_rows,
    }


@router.get("/powerbi/export/{dashboard_id}")
async def export_dashboard_powerbi_static(dashboard_id: str) -> StreamingResponse:
    return _build_powerbi_export_response(dashboard_id)


@router.get("/dashboard/{dashboard_id}/powerbi/export")
async def export_dashboard_powerbi(dashboard_id: str) -> StreamingResponse:
    return _build_powerbi_export_response(dashboard_id)


def _build_powerbi_export_response(dashboard_id: str) -> StreamingResponse:
    dashboard_record = storage.get_dashboard(dashboard_id)
    if not dashboard_record:
        session = storage.get_chat_session_by_dashboard_id(dashboard_id)
        if session and session.dashboard and session.dataset:
            storage.save_dashboard(
                session.dataset.dataset_id,
                session.dashboard,
                metadata={
                    "theme": session.dashboard.theme,
                    "restored_from_chat_session": session.session_id,
                },
            )
            dashboard_record = storage.get_dashboard(dashboard_id)
        if not dashboard_record:
            raise HTTPException(status_code=404, detail="Dashboard not found. Regenerate the dashboard once, then export again.")

    dataset_record = storage.get_dataset(dashboard_record.dataset_id)
    if not dataset_record:
        session = storage.get_chat_session_by_dashboard_id(dashboard_id)
        if session and session.dataset:
            dataset_record = storage.get_dataset(session.dataset.dataset_id)
        if not dataset_record:
            raise HTTPException(status_code=404, detail="Dataset not found. Re-upload the CSV or regenerate this dashboard before exporting.")

    stored_plan = dashboard_record.metadata.get("plan")
    plan = DashboardPlan.model_validate(stored_plan) if stored_plan else None
    try:
        bundle, filename = powerbi_exporter.build_export_bundle(
            dashboard=dashboard_record.dashboard,
            dataframe=dataset_record.dataframe,
            profile=dataset_record.profile,
            filename=dataset_record.filename,
            plan=plan,
        )
    except PowerBIExportUnavailableError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    media_type = "application/octet-stream" if filename.lower().endswith((".pbix", ".pbit")) else "application/zip"
    return StreamingResponse(
        io.BytesIO(bundle),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _theme_from_prompt(user_prompt: str) -> str | None:
    request = user_prompt.lower()
    for theme, markers in THEME_PROMPT_MAP.items():
        if any(marker in request for marker in markers):
            return theme
    return None


def _build_filter_controls(dataframe: pd.DataFrame, profile: DatasetProfile, plan: DashboardPlan) -> list[DashboardFilterControl]:
    controls: list[DashboardFilterControl] = []
    candidate_categories = _rank_filter_columns(plan, profile)

    for column in candidate_categories[:3]:
        if column not in dataframe.columns:
            continue
        counts = dataframe[column].fillna("(missing)").astype(str).value_counts().head(12)
        if counts.empty:
            continue
        controls.append(
            DashboardFilterControl(
                control_id=f"category_{len(controls) + 1}",
                label=column,
                column=column,
                control_type="category",
                options=[
                    DashboardFilterOption(label=str(value), value=str(value), count=int(count))
                    for value, count in counts.items()
                ],
            )
        )

    for column in profile.datetime_columns[:1]:
        if column not in dataframe.columns:
            continue
        series = dataframe[column].dropna()
        if series.empty:
            continue
        controls.append(
            DashboardFilterControl(
                control_id=f"date_{len(controls) + 1}",
                label=column,
                column=column,
                control_type="date_range",
                min_value=series.min().date().isoformat(),
                max_value=series.max().date().isoformat(),
            )
        )

    return controls


def _rank_filter_columns(plan: DashboardPlan, profile: DatasetProfile) -> list[str]:
    ranked: list[str] = []
    for chart in plan.charts:
        for column in (chart.color_column, chart.x_column):
            if column and column in profile.categorical_columns and column not in ranked:
                ranked.append(column)
    for column in profile.categorical_columns:
        if column not in ranked:
            ranked.append(column)
    return ranked


def _apply_dashboard_filters(dataframe: pd.DataFrame, filters: DashboardFilterRequest) -> pd.DataFrame:
    filtered = dataframe.copy()
    for column, value in filters.categorical_filters.items():
        if not value or column not in filtered.columns:
            continue
        filtered = filtered[filtered[column].fillna("(missing)").astype(str) == value]

    for column, date_filter in filters.date_filters.items():
        if column not in filtered.columns:
            continue
        series = filtered[column]
        if date_filter.start:
            start = _parse_filter_date(date_filter.start)
            if start is not None:
                filtered = filtered[series >= start]
                series = filtered[column]
        if date_filter.end:
            end = _parse_filter_date(date_filter.end)
            if end is not None:
                filtered = filtered[series <= end]

    return filtered


def _parse_filter_date(value: str):
    try:
        return pd.to_datetime(value)
    except Exception:
        return None


@router.get("/dashboard/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(dashboard_id: str) -> DashboardResponse:
    record = storage.get_dashboard(dashboard_id)
    if not record:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return record.dashboard

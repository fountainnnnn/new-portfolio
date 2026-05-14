from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


SupportedChartType = Literal[
    "bar",
    "grouped_bar",
    "line",
    "scatter",
    "histogram",
    "box",
    "pie",
    "correlation_heatmap",
    "kpi",
    "table",
    "treemap",
    "stacked_bar",
    "area",
    "heatmap",
]


ColumnRole = Literal[
    "metric",       # additive numeric business metric
    "rate_metric",  # non-additive rate / ratio / score metric
    "time",         # chronological axis, including numeric year/month fields
    "identifier",   # unique identifier or code; should not be aggregated
    "excluded",     # analytically unusable column
    "measure",      # numeric metric (revenue, count, etc.)
    "dimension",    # categorical grouping
    "datetime",     # time axis
    "id",           # unique identifier; should not be aggregated
    "text",         # free-form long text; usually skipped from charts
    "geo",          # country / region / city
    "boolean",      # 0/1 / true/false / yes/no
]


class ColumnProfile(BaseModel):
    """Per-column profile, including a semantic annotation used by the planner."""

    model_config = ConfigDict(extra="ignore")

    name: str
    dtype: str
    inferred_type: str
    missing_count: int
    missing_percent: float
    unique_count: int
    examples: list[Any] = Field(default_factory=list)
    # Semantic annotation (rule-based or LLM-assisted). Optional so older payloads round-trip.
    role: ColumnRole | None = None
    semantic_type: str | None = None        # e.g. "revenue_metric", "order_date", "region"
    business_meaning: str | None = None     # human-readable explanation
    default_aggregation: str | None = None  # sum / mean / count / unique_count / none
    aliases: list[str] = Field(default_factory=list)
    confidence: float = 0.0                 # 0..1 — confidence in the semantic classification


class DatasetProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    row_count: int
    column_count: int
    column_names: list[str]
    columns: list[ColumnProfile]
    dtypes: dict[str, str]
    missing_values: dict[str, int]
    numeric_columns: list[str]
    categorical_columns: list[str]
    datetime_columns: list[str]
    possible_date_columns: list[str]
    possible_metric_columns: list[str]
    numeric_summaries: dict[str, dict[str, Any]]
    categorical_summaries: dict[str, dict[str, Any]]
    sample_rows: list[dict[str, Any]]
    # Data quality signals used by the AI planner to make smarter choices.
    # All fields are optional so older payloads round-trip cleanly.
    data_quality: dict[str, Any] = Field(default_factory=dict)
    metric_candidates: list[str] = Field(default_factory=list)
    rate_metric_candidates: list[str] = Field(default_factory=list)
    dimension_candidates: list[str] = Field(default_factory=list)
    time_candidates: list[str] = Field(default_factory=list)
    identifier_candidates: list[str] = Field(default_factory=list)
    excluded_columns: list[str] = Field(default_factory=list)
    top_correlations: list[dict[str, Any]] = Field(default_factory=list)
    time_series: list[dict[str, Any]] = Field(default_factory=list)
    possible_row_grain: str = ""
    possible_relationships: list[dict[str, Any]] = Field(default_factory=list)


class DatasetUploadResponse(BaseModel):
    dataset_id: str
    filename: str
    profile: DatasetProfile


class ChatMessage(BaseModel):
    role: Literal["assistant", "user"]
    content: str


class ChatSessionRequest(BaseModel):
    session_id: str
    title: str = "New dashboard chat"
    dataset: DatasetUploadResponse | None = None
    dashboard: "DashboardResponse | None" = None
    prompt: str = ""
    messages: list[ChatMessage] = Field(default_factory=list)
    selected_theme_id: str = "executive_light"
    settings: dict[str, Any] = Field(default_factory=dict)
    updated_at: int | None = None


class ChatSessionResponse(ChatSessionRequest):
    created_at: str | None = None


class DashboardGenerateRequest(BaseModel):
    dataset_id: str
    user_prompt: str = Field(min_length=1, max_length=2000)
    theme: str = "executive_light"


class DashboardRefineRequest(BaseModel):
    dashboard_id: str
    user_prompt: str = Field(min_length=1, max_length=2000)
    theme: str | None = None


DashboardControlType = Literal["category", "date_range"]


class DashboardFilterOption(BaseModel):
    label: str
    value: str
    count: int | None = None


class DashboardFilterControl(BaseModel):
    control_id: str
    label: str
    column: str
    control_type: DashboardControlType
    options: list[DashboardFilterOption] = Field(default_factory=list)
    min_value: str | None = None
    max_value: str | None = None


class DashboardDateFilter(BaseModel):
    start: str | None = None
    end: str | None = None


class DashboardFilterRequest(BaseModel):
    categorical_filters: dict[str, str] = Field(default_factory=dict)
    date_filters: dict[str, DashboardDateFilter] = Field(default_factory=dict)


class KpiPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kpi_id: str = ""
    title: str = "KPI"
    column: str | None = None
    aggregation: str = "count"
    business_question: str = ""
    explanation: str = ""


class ChartPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")

    chart_id: str = ""
    title: str = "Chart"
    chart_type: SupportedChartType
    x_column: str | None = None
    y_column: str | None = None
    color_column: str | None = None
    aggregation: str | None = None
    page_id: str | None = None
    business_question: str = ""
    analysis_type: str = ""
    sort: str | None = None
    limit: int | None = None
    reason_selected: str = ""
    explanation: str = ""


LayoutKind = Literal["chart", "kpi", "insights", "filters", "title"]


class LayoutItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    item_id: str
    kind: LayoutKind
    x: int = 0
    y: int = 0
    w: int = 6
    h: int = 4


class DashboardLayout(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cols: int = 12
    row_height: int = 47
    rows_per_page: int = 12
    items: list[LayoutItem] = Field(default_factory=list)
    # Optional human-readable title per page. Index = page number; entries beyond
    # the current page count are ignored, and missing entries fall back to a
    # generic label in the UI ("Page N"). Kept on the layout object (not the
    # parent spec) so Power BI export and /layout-update can round-trip it.
    page_titles: list[str] = Field(default_factory=list)


class DashboardPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = "Generated Dashboard"
    description: str = "An automatically generated dashboard for the uploaded dataset."
    dataset_summary: dict[str, Any] = Field(default_factory=dict)
    kpis: list[KpiPlan] = Field(default_factory=list)
    pages: list[dict[str, Any]] = Field(default_factory=list)
    charts: list[ChartPlan] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
    layout: DashboardLayout = Field(default_factory=DashboardLayout)


class KpiCardResponse(BaseModel):
    kpi_id: str
    title: str
    value: Any
    formatted_value: str
    aggregation: str
    column: str | None = None
    explanation: str = ""


class AgentToolCall(BaseModel):
    tool_name: str
    status: str = "completed"
    summary: str
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)


# ---- Spec-driven dashboard model -----------------------------------------------
# DashboardSpec is the source of truth for the new browser-rendered architecture.
# The browser owns rendering: each ChartSpec is fed (along with dataset rows and a
# theme) into a deterministic Plotly figure builder. The LLM only ever returns
# DashboardSpec / ChartSpec JSON; it never returns Plotly code.

DataQueryAggregation = Literal[
    "sum", "avg", "mean", "median", "min", "max", "count", "unique_count", "none",
]
DataQueryFilterOp = Literal[
    "eq", "neq", "in", "not_in", "between", "gte", "lte", "contains",
]
DataQuerySort = Literal["asc", "desc", "none"]
NumberFormat = Literal["auto", "number", "currency", "percent", "compact"]


class DataQueryFilter(BaseModel):
    model_config = ConfigDict(extra="ignore")

    field: str
    op: DataQueryFilterOp = "eq"
    value: Any = None


class DataQuery(BaseModel):
    """Declarative description of how to derive a chart's data from raw rows."""

    model_config = ConfigDict(extra="ignore")

    x: str | None = None
    y: str | None = None
    aggregation: DataQueryAggregation | None = None
    group_by: str | None = None
    filters: list[DataQueryFilter] = Field(default_factory=list)
    sort: DataQuerySort = "none"
    limit: int | None = None
    calculation: str | None = None  # e.g. "percent_of_total", "running_total"


class ChartEncoding(BaseModel):
    model_config = ConfigDict(extra="ignore")

    x_label: str | None = None
    y_label: str | None = None
    color_by: str | None = None
    color_palette: list[str] | None = None


class ChartStyle(BaseModel):
    model_config = ConfigDict(extra="ignore")

    show_legend: bool = True
    show_grid: bool = True
    number_format: NumberFormat = "auto"
    height: int | None = None
    color_override: str | None = None


class ChartSpec(BaseModel):
    """Self-contained description of one chart. The browser renders it deterministically."""

    model_config = ConfigDict(extra="ignore")

    chart_id: str
    title: str = "Chart"
    chart_type: SupportedChartType
    intent: str = ""  # "trend" | "comparison" | "distribution" | "composition" | "relationship" | ...
    data_query: DataQuery = Field(default_factory=DataQuery)
    encoding: ChartEncoding = Field(default_factory=ChartEncoding)
    style: ChartStyle = Field(default_factory=ChartStyle)
    explanation: str = ""


class ThemeConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    template: str = "clean_business"
    font: str = "Inter"
    background: str = "#f4f6fb"
    accent: str | None = None


class GlobalFilter(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    field: str
    type: Literal["multi_select", "single_select", "date_range", "numeric_range"] = "multi_select"
    label: str
    default_value: Any = None


class DashboardSpec(BaseModel):
    """The canonical, source-of-truth dashboard description."""

    model_config = ConfigDict(extra="ignore")

    dashboard_title: str = "Untitled dashboard"
    description: str = ""
    theme: ThemeConfig = Field(default_factory=ThemeConfig)
    global_filters: list[GlobalFilter] = Field(default_factory=list)
    charts: list[ChartSpec] = Field(default_factory=list)
    layout: DashboardLayout = Field(default_factory=DashboardLayout)


class ChartResponse(BaseModel):
    """Per-chart payload returned from /dashboard/generate.

    `spec` is the canonical description used by the browser renderer.
    `plotly_json` is a server-rendered fallback figure for legacy chart types and
    snapshot exports (Power BI image fallback). New chart types may omit it.
    """

    model_config = ConfigDict(extra="ignore")

    chart_id: str
    title: str
    chart_type: SupportedChartType
    plotly_json: dict[str, Any] = Field(default_factory=dict)
    plotly_code: str = ""
    explanation: str = ""
    spec: ChartSpec | None = None


class DashboardResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dashboard_id: str
    dataset_id: str
    theme: str = "executive_light"
    title: str
    description: str
    kpis: list[KpiCardResponse]
    charts: list[ChartResponse]
    insights: list[str]
    dashboard_code: str = ""
    tool_calls: list[AgentToolCall] = Field(default_factory=list)
    controls: list[DashboardFilterControl] = Field(default_factory=list)
    active_filters: DashboardFilterRequest = Field(default_factory=DashboardFilterRequest)
    filtered_row_count: int | None = None
    total_row_count: int | None = None
    layout: DashboardLayout = Field(default_factory=DashboardLayout)
    # Spec-driven view of the dashboard. The frontend prefers this over `charts[].plotly_json`.
    spec: DashboardSpec | None = None


class DashboardLayoutUpdateRequest(BaseModel):
    layout: DashboardLayout


class ChartUpdateRequest(BaseModel):
    """Legacy endpoint payload (regenerates a single chart server-side)."""

    model_config = ConfigDict(extra="ignore")

    title: str | None = None
    chart_type: SupportedChartType | None = None
    x_column: str | None = None
    y_column: str | None = None
    color_column: str | None = None
    aggregation: str | None = None
    explanation: str | None = None
    color_override: str | None = None  # hex color to force for this chart


class ChartSpecUpdateRequest(BaseModel):
    """Replace the saved ChartSpec for one chart, no server-side regeneration."""

    model_config = ConfigDict(extra="ignore")

    spec: ChartSpec


class DashboardSpecUpdateRequest(BaseModel):
    """Replace the entire DashboardSpec (used by undo/redo, AI patches, manual edits)."""

    model_config = ConfigDict(extra="ignore")

    spec: DashboardSpec


# ---- AI patch operations ------------------------------------------------------

AiPatchOperationKind = Literal[
    "create_dashboard",
    "add_chart",
    "update_chart",
    "remove_chart",
    "update_theme",
    "explain_dashboard",
    "suggest_improvements",
]


class AiPatchOperation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    operation: AiPatchOperationKind
    chart_id: str | None = None
    patch: dict[str, Any] | None = None
    chart: ChartSpec | None = None
    theme: ThemeConfig | None = None
    spec: DashboardSpec | None = None
    summary: str = ""


class AiPatchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    instruction: str = Field(min_length=1, max_length=2000)
    selected_chart_id: str | None = None


class AiPatchResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    operation: AiPatchOperation
    dashboard: DashboardResponse

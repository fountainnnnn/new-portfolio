from __future__ import annotations

import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from app.core.config import settings as app_settings
from app.models.schemas import (
    AgentToolCall,
    ChartEncoding,
    ChartPlan,
    ChartResponse,
    ChartSpec,
    ChartStyle,
    DashboardFilterControl,
    DashboardFilterRequest,
    DashboardPlan,
    DashboardResponse,
    DashboardSpec,
    DataQuery,
    DatasetProfile,
    KpiCardResponse,
    KpiPlan,
    LayoutItem,
    ThemeConfig,
)
from app.services.data_profiler import json_safe

logger = logging.getLogger(__name__)


AGGREGATIONS = {"sum", "mean", "median", "min", "max", "count", "unique_count", "column_count", "mode"}
PLOTLY_THEMES: dict[str, dict[str, Any]] = {
    "executive_light": {
        "label": "Executive Light",
        "template": "plotly_white",
        "colorway": ["#275EFE", "#10A37F", "#E7A321", "#D64545", "#7C3AED", "#0E7490"],
        "font_color": "#141414",
        "muted_color": "#667085",
        "grid_color": "#E8EDF5",
        "paper_bg": "rgba(0,0,0,0)",
        "plot_bg": "rgba(255,255,255,0.78)",
        "accent": "#275EFE",
        "heatmap": "Blues",
    },
    "midnight": {
        "label": "Midnight",
        "template": "plotly_dark",
        "colorway": ["#8AB4FF", "#7CF6C3", "#F6C177", "#F7768E", "#BB9AF7", "#7DCFFF"],
        "font_color": "#E8EEF9",
        "muted_color": "#9AA8BF",
        "grid_color": "rgba(232,238,249,0.12)",
        "paper_bg": "rgba(0,0,0,0)",
        "plot_bg": "rgba(10,15,28,0.72)",
        "accent": "#8AB4FF",
        "heatmap": "IceFire",
    },
    "finance": {
        "label": "Finance",
        "template": "plotly_white",
        "colorway": ["#0F766E", "#C0841A", "#334155", "#2563EB", "#9333EA", "#DC2626"],
        "font_color": "#18211F",
        "muted_color": "#647067",
        "grid_color": "#E3ECE7",
        "paper_bg": "rgba(0,0,0,0)",
        "plot_bg": "rgba(248,250,247,0.82)",
        "accent": "#0F766E",
        "heatmap": "Teal",
    },
    "editorial": {
        "label": "Editorial",
        "template": "simple_white",
        "colorway": ["#111827", "#B45309", "#0F766E", "#BE123C", "#4F46E5", "#6B7280"],
        "font_color": "#161616",
        "muted_color": "#6B6B6B",
        "grid_color": "#EAE4DA",
        "paper_bg": "rgba(0,0,0,0)",
        "plot_bg": "rgba(253,251,247,0.9)",
        "accent": "#B45309",
        "heatmap": "Temps",
    },
    "neon": {
        "label": "Neon",
        "template": "plotly_dark",
        "colorway": ["#00E5FF", "#B8FF4D", "#FF4DD8", "#FFD166", "#7C4DFF", "#FF6B6B"],
        "font_color": "#F4FBFF",
        "muted_color": "#A6B7C8",
        "grid_color": "rgba(0,229,255,0.16)",
        "paper_bg": "rgba(0,0,0,0)",
        "plot_bg": "rgba(4,9,18,0.82)",
        "accent": "#00E5FF",
        "heatmap": "Viridis",
    },
    "minimal": {
        "label": "Minimal",
        "template": "simple_white",
        "colorway": ["#52525B", "#18181B", "#71717A", "#A1A1AA", "#3F3F46", "#D4D4D8"],
        "font_color": "#18181B",
        "muted_color": "#71717A",
        "grid_color": "#ECECEF",
        "paper_bg": "rgba(0,0,0,0)",
        "plot_bg": "rgba(250,250,250,0.92)",
        "accent": "#18181B",
        "heatmap": "Greys",
    },
}


class ChartGenerationError(ValueError):
    """Raised when a chart cannot be generated from the plan."""


class ChartGenerator:
    def generate_dashboard(
        self,
        dataset_id: str,
        plan: DashboardPlan,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        theme: str = "executive_light",
        tool_calls: list[AgentToolCall] | None = None,
        controls: list[DashboardFilterControl] | None = None,
        active_filters: DashboardFilterRequest | None = None,
        total_row_count: int | None = None,
    ) -> DashboardResponse:
        dashboard_id = str(uuid4())
        theme_key = self._theme_key(theme)
        chart_errors: list[str] = []
        charts: list[ChartResponse] = []
        tool_calls = tool_calls or []

        # Assign chart ids up front so order is preserved when we parallelise.
        for index, chart_plan in enumerate(plan.charts):
            chart_plan.chart_id = chart_plan.chart_id or f"chart_{index + 1}"

        start = time.perf_counter()
        if app_settings.autodash_render_plotly_json and app_settings.autodash_parallel_charts and len(plan.charts) > 1:
            # Run pandas + plotly figure generation in parallel. pandas releases the GIL during
            # group-by, so a small thread pool gives a real speedup with no extra deps.
            charts_by_index: dict[int, ChartResponse] = {}
            errors_by_index: dict[int, str] = {}
            with ThreadPoolExecutor(max_workers=min(8, max(1, len(plan.charts)))) as pool:
                future_to_index = {
                    pool.submit(self._safe_generate_chart, chart_plan, dataframe, profile, theme_key): index
                    for index, chart_plan in enumerate(plan.charts)
                }
                for future in future_to_index:
                    index = future_to_index[future]
                    result, error = future.result()
                    if result is not None:
                        charts_by_index[index] = result
                    elif error:
                        errors_by_index[index] = error
            for index in range(len(plan.charts)):
                if index in charts_by_index:
                    charts.append(charts_by_index[index])
                elif index in errors_by_index:
                    chart_errors.append(errors_by_index[index])
        else:
            for chart_plan in plan.charts:
                try:
                    charts.append(self._generate_chart(chart_plan, dataframe, profile, theme_key))
                except ChartGenerationError as exc:
                    chart_errors.append(f"{chart_plan.title}: {exc}")
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "ChartGenerator: built %d charts in %.0f ms (server_render=%s parallel=%s)",
            len(charts),
            elapsed_ms,
            app_settings.autodash_render_plotly_json,
            app_settings.autodash_parallel_charts and len(plan.charts) > 1,
        )

        insights = list(plan.insights)
        if chart_errors:
            insights.append("Some chart suggestions were skipped because they did not match the dataset columns.")

        chart_data_issues, invalid_chart_ids = self._chart_data_quality_issues(charts, dataframe)
        if invalid_chart_ids and len(invalid_chart_ids) < len(charts):
            charts = [chart for chart in charts if chart.chart_id not in invalid_chart_ids]
            insights.append("Some chart suggestions were skipped because they would have rendered with no visible data.")
        tool_calls.append(
            AgentToolCall(
                tool_name="chart_data_check",
                status="repaired" if invalid_chart_ids else "completed",
                summary=(
                    "Removed chart specs that would render without visible data."
                    if invalid_chart_ids
                    else "Verified generated chart specs have renderable data traces."
                ),
                output={"issues": chart_data_issues[:12], "removed_chart_ids": sorted(invalid_chart_ids)},
            )
        )

        # Filter layout to only reference entities we actually rendered.
        layout = plan.layout.model_copy(deep=True)
        valid_ids = {c.chart_id for c in charts} | {k.kpi_id for k in plan.kpis} | {
            item.item_id for item in layout.items if item.item_id == "filters"
        } | {
            item.item_id for item in layout.items if item.item_id == "insights" or item.item_id.startswith("insights_page_")
        } | {
            item.item_id for item in layout.items if item.item_id == "dashboard_title" or item.item_id.startswith("dashboard_title_page_")
        }
        layout.items = [item for item in layout.items if item.item_id in valid_ids]
        layout_issues = self._layout_quality_issues(layout.items, charts, plan.kpis, controls or [], bool(insights))
        if layout_issues:
            layout.items = self._dense_layout_items(charts, plan.kpis, bool(insights), bool(controls))
            final_layout_issues = self._layout_quality_issues(layout.items, charts, plan.kpis, controls or [], bool(insights))
            tool_calls.append(
                AgentToolCall(
                    tool_name="visual_layout_check",
                    status="repaired" if not final_layout_issues else "warning",
                    summary=(
                        "Detected layout geometry issues, repaired the dashboard with dense page templates, and verified the repaired layout."
                        if not final_layout_issues
                        else "Detected layout geometry issues and repaired the dashboard, but some layout warnings remain."
                    ),
                    output={
                        "initial_issues": layout_issues[:12],
                        "issues": final_layout_issues[:12],
                        "repaired": True,
                    },
                )
            )
        else:
            tool_calls.append(
                AgentToolCall(
                    tool_name="visual_layout_check",
                    summary="Verified dashboard layout bounds, page coverage, titles, and overlap-free grid placement.",
                    output={"issues": [], "repaired": False},
                )
            )
        layout.page_titles = self._page_titles(layout.items, charts, plan, profile)

        # Build the canonical DashboardSpec used by the browser renderer.
        dashboard_spec = DashboardSpec(
            dashboard_title=self._dashboard_title(plan, profile),
            description=self._dashboard_description(plan, profile),
            theme=ThemeConfig(template=theme_key, font="Inter", background="#f4f6fb"),
            charts=[chart.spec for chart in charts if chart.spec is not None],
            layout=layout,
        )

        return DashboardResponse(
            dashboard_id=dashboard_id,
            dataset_id=dataset_id,
            theme=theme_key,
            title=self._dashboard_title(plan, profile),
            description=self._dashboard_description(plan, profile),
            kpis=self._calculate_kpis_batch(plan.kpis, dataframe, profile),
            charts=charts,
            insights=insights,
            dashboard_code=self._dashboard_code(plan, theme_key),
            tool_calls=tool_calls,
            controls=controls or [],
            active_filters=active_filters or DashboardFilterRequest(),
            filtered_row_count=int(len(dataframe)),
            total_row_count=total_row_count if total_row_count is not None else int(profile.row_count),
            layout=layout,
            spec=dashboard_spec,
        )


    def _chart_data_quality_issues(self, charts: list[ChartResponse], dataframe: pd.DataFrame) -> tuple[list[str], set[str]]:
        issues: list[str] = []
        invalid_ids: set[str] = set()

        def has_column(column: str | None) -> bool:
            return bool(column and column in dataframe.columns)

        def numeric_values(column: str | None) -> pd.Series:
            if not has_column(column):
                return pd.Series(dtype="float64")
            return pd.to_numeric(dataframe[column], errors="coerce").dropna()

        def add_issue(chart: ChartResponse, message: str) -> None:
            invalid_ids.add(chart.chart_id)
            issues.append(f"{chart.title}: {message}")

        for chart in charts:
            spec = chart.spec
            if spec is None:
                add_issue(chart, "missing chart spec")
                continue
            query = spec.data_query
            chart_type = spec.chart_type
            x_col = query.x
            y_col = query.y
            group_col = query.group_by

            for column in (x_col, y_col, group_col):
                if column and column not in dataframe.columns:
                    add_issue(chart, f"column '{column}' is not in the dataset")
                    break
            if chart.chart_id in invalid_ids:
                continue

            if chart_type in {"bar", "stacked_bar"}:
                if not has_column(x_col):
                    add_issue(chart, "bar chart has no category axis")
                elif query.aggregation == "count" and not y_col:
                    if int(dataframe[x_col].notna().sum()) == 0:
                        add_issue(chart, "count chart has no non-empty categories")
                elif not has_column(y_col) or numeric_values(y_col).empty:
                    add_issue(chart, "bar chart has no numeric values")
            elif chart_type == "line":
                if not has_column(x_col):
                    add_issue(chart, "line chart needs an x column")
                elif query.aggregation == "count" and not y_col:
                    if int(dataframe[x_col].notna().sum()) == 0:
                        add_issue(chart, "count line chart has no non-empty periods")
                elif not has_column(y_col):
                    add_issue(chart, "line chart needs a y column")
                else:
                    values = pd.to_numeric(dataframe[y_col], errors="coerce")
                    if not bool((dataframe[x_col].notna() & values.notna()).any()):
                        add_issue(chart, "line chart has no x/y pairs")
            elif chart_type == "scatter":
                if numeric_values(x_col).empty or numeric_values(y_col).empty:
                    add_issue(chart, "scatter chart needs numeric x/y values")
            elif chart_type in {"histogram", "box"}:
                target = y_col or x_col
                if numeric_values(target).empty:
                    add_issue(chart, f"{chart_type} chart has no numeric values")
            elif chart_type in {"pie", "treemap"}:
                if not has_column(x_col):
                    add_issue(chart, f"{chart_type} chart has no category column")
                elif query.aggregation == "count" and not y_col:
                    if int(dataframe[x_col].notna().sum()) == 0:
                        add_issue(chart, f"{chart_type} count chart has no categories")
                elif not has_column(y_col) or numeric_values(y_col).empty:
                    add_issue(chart, f"{chart_type} chart has no numeric values")
            elif chart_type in {"heatmap", "correlation_heatmap"}:
                if x_col and y_col and group_col:
                    if not (has_column(x_col) and has_column(y_col) and has_column(group_col)):
                        add_issue(chart, "heatmap pivot columns are incomplete")
                else:
                    numeric_count = sum(1 for column in dataframe.columns if not numeric_values(column).empty)
                    if numeric_count < 2:
                        add_issue(chart, "correlation heatmap needs at least two numeric columns")
        return issues, invalid_ids

    def generate_chart(
        self,
        chart_plan: ChartPlan,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        theme: str = "executive_light",
    ) -> ChartResponse:
        """Public wrapper for single-chart regeneration (e.g. from PATCH endpoint)."""
        return self._generate_chart(chart_plan, dataframe, profile, self._theme_key(theme))

    def _safe_generate_chart(
        self,
        chart_plan: ChartPlan,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        theme_key: str,
    ) -> tuple[ChartResponse | None, str | None]:
        try:
            return self._generate_chart(chart_plan, dataframe, profile, theme_key), None
        except ChartGenerationError as exc:
            return None, f"{chart_plan.title}: {exc}"

    def _generate_chart(
        self,
        chart_plan: ChartPlan,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        theme_key: str,
    ) -> ChartResponse:
        chart_type = "bar" if chart_plan.chart_type == "grouped_bar" else chart_plan.chart_type
        spec = self._chart_plan_to_spec(chart_plan)
        # Server-side fallback rendering only for the legacy chart types AND only when explicitly
        # requested (autodash_render_plotly_json). The browser renders charts from the ChartSpec
        # by default, so skipping the server render typically saves 3-10s per /generate call.
        plotly_json: dict[str, Any] = {}
        legacy_types = {"bar", "line", "scatter", "histogram", "box", "pie", "correlation_heatmap"}
        if app_settings.autodash_render_plotly_json and chart_type in legacy_types:
            try:
                if chart_type == "bar":
                    figure = self._bar_chart(chart_plan, dataframe, theme_key)
                elif chart_type == "line":
                    figure = self._line_chart(chart_plan, dataframe, theme_key)
                elif chart_type == "scatter":
                    figure = self._scatter_plot(chart_plan, dataframe, theme_key)
                elif chart_type == "histogram":
                    figure = self._histogram(chart_plan, dataframe, theme_key)
                elif chart_type == "box":
                    figure = self._box_plot(chart_plan, dataframe, theme_key)
                elif chart_type == "pie":
                    figure = self._pie_chart(chart_plan, dataframe, theme_key)
                else:
                    figure = self._correlation_heatmap(profile, dataframe, theme_key)
                self._style_figure(figure, theme_key)
                plotly_json = json.loads(figure.to_json())
            except ChartGenerationError:
                # Re-raise so the caller can record it; the spec is still useful so the browser can render.
                raise
            except Exception as exc:  # noqa: BLE001
                # Don't fail the whole dashboard if a single chart can't be rendered server-side; the
                # browser will render from spec instead.
                logger.warning("Server-side render failed for %s (%s); falling back to spec-only.", chart_type, exc)

        return ChartResponse(
            chart_id=chart_plan.chart_id,
            title=chart_plan.title,
            chart_type=chart_type,
            plotly_json=plotly_json,
            plotly_code=self._chart_code_stub(chart_plan, theme_key),
            explanation=chart_plan.explanation,
            spec=spec,
        )

    def _chart_code_stub(self, chart_plan: ChartPlan, theme_key: str) -> str:
        return (
            "import plotly.graph_objects as go\n\n"
            f"# AutoDash chart spec: {chart_plan.title}\n"
            f"# Theme: {self._theme(theme_key)['label']}\n"
            "# The browser renders this chart from the returned ChartSpec.\n"
            "fig = go.Figure()\n"
            "fig.show()\n"
        )

    @staticmethod
    def _chart_plan_to_spec(chart_plan: ChartPlan) -> ChartSpec:
        """Translate a ChartPlan (LLM/fallback output) into a canonical ChartSpec.

        The browser renderer treats this spec as the source of truth; the legacy
        plotly_json is kept as a fallback for snapshot exports only.
        """
        intent = "comparison"
        render_type = "bar" if chart_plan.chart_type == "grouped_bar" else chart_plan.chart_type
        if chart_plan.chart_type == "line":
            intent = "trend"
        elif chart_plan.chart_type == "scatter":
            intent = "relationship"
        elif chart_plan.chart_type in {"histogram", "box"}:
            intent = "distribution"
        elif chart_plan.chart_type in {"pie", "treemap", "stacked_bar", "grouped_bar"}:
            intent = "composition"
        elif chart_plan.chart_type == "kpi":
            intent = "metric"
        elif chart_plan.chart_type == "table":
            intent = "detail"

        return ChartSpec(
            chart_id=chart_plan.chart_id,
            title=chart_plan.title,
            chart_type=render_type,
            intent=intent,
            data_query=DataQuery(
                x=chart_plan.x_column,
                y=chart_plan.y_column,
                aggregation=chart_plan.aggregation,
                group_by=chart_plan.color_column,
                sort=chart_plan.sort if chart_plan.sort in {"asc", "desc", "none"} else ("desc" if chart_plan.chart_type in {"bar", "grouped_bar", "stacked_bar", "treemap"} else "none"),
                limit=chart_plan.limit if chart_plan.limit is not None else (30 if chart_plan.chart_type in {"bar", "grouped_bar", "stacked_bar", "treemap", "table"} else None),
            ),
            encoding=ChartEncoding(
                x_label=chart_plan.x_column,
                y_label=chart_plan.y_column,
                color_by=chart_plan.color_column,
            ),
            style=ChartStyle(),
            explanation=chart_plan.explanation,
        )

    def _bar_chart(self, chart: ChartPlan, dataframe: pd.DataFrame, theme_key: str) -> go.Figure:
        if chart.x_column and chart.y_column:
            data = self._aggregate(dataframe, chart.x_column, chart.y_column, chart.aggregation or "sum")
            return px.bar(
                data,
                x=chart.x_column,
                y=chart.y_column,
                color=self._valid_color(chart, data),
                color_discrete_sequence=self._theme(theme_key)["colorway"],
                title=chart.title,
            )
        if chart.x_column:
            data = self._top_counts(dataframe, chart.x_column)
            return px.bar(
                data,
                x=chart.x_column,
                y="count",
                color_discrete_sequence=self._theme(theme_key)["colorway"],
                title=chart.title,
            )
        raise ChartGenerationError("Bar charts need an x column.")

    def _line_chart(self, chart: ChartPlan, dataframe: pd.DataFrame, theme_key: str) -> go.Figure:
        if not chart.x_column or not chart.y_column:
            raise ChartGenerationError("Line charts need x and y columns.")
        data = self._aggregate(dataframe, chart.x_column, chart.y_column, chart.aggregation or "sum")
        data = data.sort_values(chart.x_column)
        return px.line(
            data,
            x=chart.x_column,
            y=chart.y_column,
            markers=True,
            color_discrete_sequence=self._theme(theme_key)["colorway"],
            title=chart.title,
        )

    def _scatter_plot(self, chart: ChartPlan, dataframe: pd.DataFrame, theme_key: str) -> go.Figure:
        if not chart.x_column or not chart.y_column:
            raise ChartGenerationError("Scatter plots need x and y columns.")
        data = dataframe[[column for column in [chart.x_column, chart.y_column, chart.color_column] if column]].dropna()
        if len(data) > 5000:
            data = data.sample(5000, random_state=7)
        return px.scatter(
            data,
            x=chart.x_column,
            y=chart.y_column,
            color=self._valid_color(chart, data),
            color_discrete_sequence=self._theme(theme_key)["colorway"],
            title=chart.title,
        )

    def _histogram(self, chart: ChartPlan, dataframe: pd.DataFrame, theme_key: str) -> go.Figure:
        column = chart.x_column or chart.y_column
        if not column:
            raise ChartGenerationError("Histograms need one numeric column.")
        return px.histogram(
            dataframe,
            x=column,
            nbins=30,
            color_discrete_sequence=self._theme(theme_key)["colorway"],
            title=chart.title,
        )

    def _box_plot(self, chart: ChartPlan, dataframe: pd.DataFrame, theme_key: str) -> go.Figure:
        y_column = chart.y_column or chart.x_column
        if not y_column:
            raise ChartGenerationError("Box plots need a numeric column.")
        return px.box(
            dataframe,
            x=chart.x_column if chart.x_column != y_column else None,
            y=y_column,
            color_discrete_sequence=self._theme(theme_key)["colorway"],
            title=chart.title,
        )

    def _pie_chart(self, chart: ChartPlan, dataframe: pd.DataFrame, theme_key: str) -> go.Figure:
        if not chart.x_column:
            raise ChartGenerationError("Pie charts need a category column.")
        if chart.y_column:
            data = self._aggregate(dataframe, chart.x_column, chart.y_column, chart.aggregation or "sum")
            return px.pie(
                data,
                names=chart.x_column,
                values=chart.y_column,
                color_discrete_sequence=self._theme(theme_key)["colorway"],
                title=chart.title,
            )
        data = self._top_counts(dataframe, chart.x_column, limit=8)
        return px.pie(
            data,
            names=chart.x_column,
            values="count",
            color_discrete_sequence=self._theme(theme_key)["colorway"],
            title=chart.title,
        )

    def _correlation_heatmap(self, profile: DatasetProfile, dataframe: pd.DataFrame, theme_key: str) -> go.Figure:
        numeric_columns = self._semantic_metric_columns(profile)[:12]
        if len(numeric_columns) < 2:
            raise ChartGenerationError("Correlation heatmaps need at least two numeric columns.")
        corr = dataframe[numeric_columns].corr(numeric_only=True).replace({np.nan: 0})
        figure = go.Figure(
            data=go.Heatmap(
                z=corr.values,
                x=corr.columns.tolist(),
                y=corr.index.tolist(),
                colorscale=self._theme(theme_key)["heatmap"],
                zmin=-1,
                zmax=1,
                hovertemplate="%{y} vs %{x}<br>Correlation: %{z:.2f}<extra></extra>",
            )
        )
        figure.update_layout(title="Metric Correlation Heatmap")
        return figure

    def _aggregate(self, dataframe: pd.DataFrame, x_column: str, y_column: str, aggregation: str) -> pd.DataFrame:
        self._require_columns(dataframe, [x_column, y_column])
        aggregation = aggregation if aggregation in AGGREGATIONS else "sum"

        data = dataframe[[x_column, y_column]].dropna()
        if aggregation == "count":
            grouped = data.groupby(x_column, dropna=False)[y_column].count()
        elif aggregation == "unique_count":
            grouped = data.groupby(x_column, dropna=False)[y_column].nunique()
        else:
            grouped = getattr(data.groupby(x_column, dropna=False)[y_column], aggregation)()

        result = grouped.reset_index().sort_values(y_column, ascending=False)
        return result.head(30)

    def _top_counts(self, dataframe: pd.DataFrame, column: str, limit: int = 20) -> pd.DataFrame:
        self._require_columns(dataframe, [column])
        counts = dataframe[column].fillna("(missing)").astype(str).value_counts().head(limit)
        return pd.DataFrame({column: counts.index.tolist(), "count": counts.values.tolist()})

    def _valid_color(self, chart: ChartPlan, dataframe: pd.DataFrame) -> str | None:
        return chart.color_column if chart.color_column and chart.color_column in dataframe.columns else None

    def _require_columns(self, dataframe: pd.DataFrame, columns: list[str]) -> None:
        missing = [column for column in columns if column not in dataframe.columns]
        if missing:
            raise ChartGenerationError(f"Missing columns: {', '.join(missing)}")

    def _style_figure(self, figure: go.Figure, theme_key: str) -> None:
        theme = self._theme(theme_key)
        figure.update_layout(
            template=theme["template"],
            colorway=theme["colorway"],
            margin={"l": 58, "r": 30, "t": 72, "b": 58},
            autosize=True,
            hovermode="closest",
            font={"family": "Inter, Geist, Arial, sans-serif", "size": 13, "color": theme["font_color"]},
            title={
                "font": {"size": 18, "color": theme["font_color"]},
                "x": 0,
                "xanchor": "left",
            },
            paper_bgcolor=theme["paper_bg"],
            plot_bgcolor=theme["plot_bg"],
            legend={
                "orientation": "h",
                "yanchor": "bottom",
                "y": 1.02,
                "xanchor": "right",
                "x": 1,
                "font": {"size": 12, "color": theme["muted_color"]},
            },
            hoverlabel={
                "bgcolor": theme["font_color"],
                "font": {"color": "#FAFAFA", "family": "Inter, Geist, Arial, sans-serif"},
                "bordercolor": theme["accent"],
            },
            uniformtext={"minsize": 11, "mode": "hide"},
        )
        figure.update_xaxes(
            showgrid=True,
            gridcolor=theme["grid_color"],
            zeroline=False,
            title_font={"size": 13, "color": theme["muted_color"]},
            tickfont={"size": 12, "color": theme["muted_color"]},
            linecolor=theme["grid_color"],
        )
        figure.update_yaxes(
            showgrid=True,
            gridcolor=theme["grid_color"],
            zeroline=False,
            title_font={"size": 13, "color": theme["muted_color"]},
            tickfont={"size": 12, "color": theme["muted_color"]},
            linecolor=theme["grid_color"],
        )
        figure.update_traces(
            marker_line_width=0.8,
            marker_line_color=theme["plot_bg"],
            opacity=0.94,
            selector={"type": "bar"},
        )
        figure.update_traces(
            line_width=3,
            marker_size=8,
            marker_line_width=1.2,
            marker_line_color=theme["plot_bg"],
            selector={"type": "scatter"},
        )
        figure.update_traces(
            textinfo="percent",
            textfont={"size": 13, "color": "#FAFAFA"},
            marker_line_width=2,
            marker_line_color=theme["plot_bg"],
            selector={"type": "pie"},
        )

    def _calculate_kpis_batch(
        self,
        kpi_plans: list[KpiPlan],
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
    ) -> list[KpiCardResponse]:
        """Compute all KPIs in one pass.

        The naive version called `_calculate_kpi` once per plan, and each of those
        did `dataframe[col].dropna()` plus a single aggregation. When two KPIs
        reference the same column that's wasted work. Here we group plans by
        column, dropna() the column once, and fan out the aggregations from the
        shared series. For a typical 5-KPI dashboard on a 25k-row CSV this cuts
        ~100-300 ms off /dashboard/generate.
        """
        # Group plans by column so each source column is materialised only once.
        column_groups: dict[str | None, list[tuple[int, KpiPlan]]] = {}
        for index, plan in enumerate(kpi_plans):
            column_groups.setdefault(plan.column, []).append((index, plan))

        # Compute a shared dropna'd series per column - the slowest step in the
        # old path - ONCE, and reuse it across every KPI that references it.
        shared_series: dict[str, pd.Series] = {}
        for column in column_groups:
            if column and column in dataframe.columns:
                shared_series[column] = dataframe[column].dropna()

        results: list[KpiCardResponse | None] = [None] * len(kpi_plans)
        for column, entries in column_groups.items():
            for index, plan in entries:
                results[index] = self._calculate_kpi(
                    index,
                    plan,
                    dataframe,
                    profile,
                    cached_series=shared_series.get(column) if column else None,
                )
        # results is filled in-order because every slot was assigned above.
        return [item for item in results if item is not None]

    def _calculate_kpi(
        self,
        index: int,
        plan: KpiPlan,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        cached_series: pd.Series | None = None,
    ) -> KpiCardResponse:
        aggregation = plan.aggregation if plan.aggregation in AGGREGATIONS else "count"
        value: Any
        if aggregation == "column_count":
            value = profile.column_count
        elif not plan.column:
            value = len(dataframe)
            aggregation = "count"
        elif plan.column not in dataframe.columns:
            value = None
        else:
            # Reuse the batched, dropna'd series when the batch helper supplies one;
            # otherwise do the per-column dropna on demand (single-KPI callers).
            series = cached_series if cached_series is not None else dataframe[plan.column].dropna()
            if aggregation == "sum":
                value = series.sum()
            elif aggregation == "mean":
                value = series.mean()
            elif aggregation == "median":
                value = series.median()
            elif aggregation == "min":
                value = series.min()
            elif aggregation == "max":
                value = series.max()
            elif aggregation == "unique_count":
                value = series.nunique()
            elif aggregation == "mode":
                modes = series.astype(str).mode()
                value = modes.iloc[0] if not modes.empty else None
            else:
                value = series.count()

        safe_value = json_safe(value)
        return KpiCardResponse(
            kpi_id=plan.kpi_id or f"kpi_{index + 1}",
            title=plan.title,
            value=safe_value,
            formatted_value=self._format_value(safe_value),
            aggregation=aggregation,
            column=plan.column,
            explanation=plan.explanation,
        )

    def _format_value(self, value: Any) -> str:
        if value is None:
            return "N/A"
        if isinstance(value, (int, np.integer)):
            return f"{int(value):,}"
        if isinstance(value, (float, np.floating)):
            if abs(float(value)) >= 1_000_000:
                return f"{float(value) / 1_000_000:.2f}M"
            if abs(float(value)) >= 1_000:
                return f"{float(value) / 1_000:.2f}K"
            return f"{float(value):,.2f}"
        return str(value)

    def _theme_key(self, theme: str) -> str:
        return theme if theme in PLOTLY_THEMES else "executive_light"

    def _theme(self, theme_key: str) -> dict[str, Any]:
        return PLOTLY_THEMES[self._theme_key(theme_key)]

    def _layout_quality_issues(
        self,
        items: list[LayoutItem],
        charts: list[ChartResponse],
        kpis: list[KpiPlan],
        controls: list[DashboardFilterControl],
        wants_insights: bool,
    ) -> list[str]:
        cols = 12
        rows = 12
        issues: list[str] = []
        chart_ids = {chart.chart_id for chart in charts}
        kpi_ids = {kpi.kpi_id for kpi in kpis}
        expected_ids = chart_ids | kpi_ids | {"dashboard_title"}
        if controls:
            expected_ids.add("filters")
        if wants_insights:
            expected_ids.add("insights")
        seen_ids = {item.item_id for item in items}
        missing = sorted(expected_ids - seen_ids)
        if missing:
            issues.append(f"missing layout items: {', '.join(missing[:6])}")

        cells: dict[tuple[int, int, int], str] = {}
        pages: dict[int, list[LayoutItem]] = {}
        for item in items:
            page = item.y // rows
            local_y = item.y % rows
            pages.setdefault(page, []).append(item)
            if item.w <= 0 or item.h <= 0:
                issues.append(f"{item.item_id} has invalid size")
                continue
            if item.x < 0 or item.x + item.w > cols:
                issues.append(f"{item.item_id} is outside horizontal bounds")
            if local_y + item.h > rows:
                issues.append(f"{item.item_id} crosses a page boundary")
            if item.kind == "title" and (item.x != 0 or local_y != 0 or item.w != cols or item.h != 1):
                issues.append(f"{item.item_id} is not a full-width title row")
            for y in range(local_y, min(rows, local_y + item.h)):
                for x in range(max(0, item.x), min(cols, item.x + item.w)):
                    key = (page, x, y)
                    previous = cells.get(key)
                    if previous and previous != item.item_id:
                        issues.append(f"{item.item_id} overlaps {previous}")
                    cells[key] = item.item_id

        for page, page_items in sorted(pages.items()):
            kinds = {item.kind for item in page_items}
            title_id = "dashboard_title" if page == 0 else f"dashboard_title_page_{page + 1}"
            if not any(item.kind == "title" and item.item_id == title_id for item in page_items):
                issues.append(f"page {page + 1} is missing its dashboard title")
            if charts and page == 0 and not any(item.kind == "chart" for item in page_items):
                issues.append("page 1 has no chart")
            non_title_kinds = kinds - {"title"}
            if non_title_kinds and non_title_kinds <= {"insights", "filters"}:
                issues.append(f"page {page + 1} is an orphan support-only page")
            page_has_chart = any(item.kind == "chart" for item in page_items)
            page_kpis = [item for item in page_items if item.kind == "kpi"]
            if page_has_chart and page_kpis:
                kpi_local_ys = {item.y % rows for item in page_kpis}
                band_coverage = sum(item.w for item in page_kpis if item.y % rows == 1)
                if kpi_local_ys != {1} or band_coverage < cols:
                    issues.append(f"page {page + 1} information cards are not in a full-width top band below the title")
            filled = sum(1 for cell_page, _, _ in cells if cell_page == page)
            if page_has_chart and filled / (cols * rows) < 0.78:
                issues.append(f"page {page + 1} coverage is too sparse")
            if non_title_kinds == {"kpi"} and filled / (cols * rows) < 0.58:
                issues.append(f"page {page + 1} is a sparse KPI-only page")

        return list(dict.fromkeys(issues))

    def _dense_layout_items(
        self,
        charts: list[ChartResponse],
        kpis: list[KpiPlan],
        wants_insights: bool,
        has_controls: bool,
    ) -> list[LayoutItem]:
        items: list[LayoutItem] = []

        def add_title(page: int) -> None:
            items.append(
                LayoutItem(
                    item_id="dashboard_title" if page == 0 else f"dashboard_title_page_{page + 1}",
                    kind="title",
                    x=0,
                    y=page * 12,
                    w=12,
                    h=1,
                )
            )

        if not charts:
            add_title(0)
            for index, kpi in enumerate(kpis[:8]):
                items.append(
                    LayoutItem(item_id=kpi.kpi_id, kind="kpi", x=(index % 4) * 3, y=1 + (index // 4) * 2, w=3, h=2)
                )
            if has_controls:
                items.append(LayoutItem(item_id="filters", kind="filters", x=0, y=5, w=6, h=3))
            if wants_insights:
                items.append(
                    LayoutItem(
                        item_id="insights",
                        kind="insights",
                        x=6 if has_controls else 0,
                        y=5,
                        w=6 if has_controls else 12,
                        h=3,
                    )
                )
            return items

        kpi_offset = 0

        def place_top_kpi_band(page: int, max_count: int) -> int:
            nonlocal kpi_offset
            page_kpis = kpis[kpi_offset : kpi_offset + max_count]
            base_y = page * 12
            width = 12 // len(page_kpis) if page_kpis else 0
            for index, kpi in enumerate(page_kpis):
                items.append(
                    LayoutItem(
                        item_id=kpi.kpi_id,
                        kind="kpi",
                        x=index * width,
                        y=base_y + 1,
                        w=12 - index * width if index == len(page_kpis) - 1 else width,
                        h=2,
                    )
                )
            kpi_offset += len(page_kpis)
            return len(page_kpis)

        def place_chart_grid(page: int, page_charts: list[ChartResponse], has_top_kpi_band: bool, reserved_bottom_rows: int = 0) -> None:
            base_y = page * 12
            chart_y = base_y + (3 if has_top_kpi_band else 1)
            chart_rows = 12 - (3 if has_top_kpi_band else 1) - reserved_bottom_rows
            columns = len(page_charts) or 1
            if len(page_charts) > 4:
                columns = 4
            elif len(page_charts) > 2:
                columns = 2
            rows = (len(page_charts) + columns - 1) // columns
            width = 12 // columns
            height = max(3, chart_rows // rows)
            for index, chart in enumerate(page_charts):
                column = index % columns
                row = index // columns
                items.append(
                    LayoutItem(
                        item_id=chart.chart_id,
                        kind="chart",
                        x=column * width,
                        y=chart_y + row * height,
                        w=12 - column * width if column == columns - 1 else width,
                        h=height,
                    )
                )

        add_title(0)
        compact_pages = True
        if compact_pages:
            has_top_kpi_band = place_top_kpi_band(0, min(4, len(kpis) - kpi_offset)) > 0
            reserve_support_band = wants_insights or has_controls
            place_chart_grid(0, charts[:8], has_top_kpi_band, 3 if reserve_support_band else 0)
            if wants_insights and has_controls:
                items.append(LayoutItem(item_id="insights", kind="insights", x=0, y=9, w=6, h=3))
            if wants_insights and not has_controls:
                items.append(LayoutItem(item_id="insights", kind="insights", x=0, y=9, w=12, h=3))
            if has_controls:
                items.append(LayoutItem(item_id="filters", kind="filters", x=6 if wants_insights else 0, y=9, w=6 if wants_insights else 12, h=3))
        else:
            has_top_kpi_band = place_top_kpi_band(0, min(4, len(kpis) - kpi_offset)) > 0
            content_y = 3 if has_top_kpi_band else 1
            content_h = 9 if has_top_kpi_band else 11
            items.append(
                LayoutItem(
                    item_id=charts[0].chart_id,
                    kind="chart",
                    x=0,
                    y=content_y,
                    w=8 if wants_insights or has_controls else 12,
                    h=content_h,
                )
            )
            if wants_insights and has_controls:
                items.append(LayoutItem(item_id="insights", kind="insights", x=8, y=content_y, w=4, h=2))
            if wants_insights and not has_controls:
                items.append(LayoutItem(item_id="insights", kind="insights", x=8, y=content_y, w=4, h=content_h))
            if has_controls:
                items.append(
                    LayoutItem(
                        item_id="filters",
                        kind="filters",
                        x=8,
                        y=content_y + (2 if wants_insights else 0),
                        w=4,
                        h=max(3, content_h - 2) if wants_insights else content_h,
                    )
                )

        remaining = charts[8:] if compact_pages else charts[1:]
        page = 1
        offset = 0
        while offset < len(remaining):
            remaining_count = len(remaining) - offset
            chart_count = min(8, remaining_count) if compact_pages else 3 if remaining_count == 3 or (remaining_count > 3 and remaining_count % 2 == 1) else min(2, remaining_count)
            page_charts = remaining[offset : offset + chart_count]
            base_y = page * 12
            add_title(page)
            if compact_pages:
                has_top_kpi_band = place_top_kpi_band(page, min(4, len(kpis) - kpi_offset)) > 0
                place_chart_grid(page, page_charts, has_top_kpi_band)
            else:
                has_top_kpi_band = place_top_kpi_band(page, min(4, len(kpis) - kpi_offset)) > 0
                chart_y = base_y + (3 if has_top_kpi_band else 1)
                chart_height = 9 if has_top_kpi_band else 11
                if len(page_charts) == 1:
                    items.append(
                        LayoutItem(
                            item_id=page_charts[0].chart_id,
                            kind="chart",
                            x=0,
                            y=chart_y,
                            w=12,
                            h=chart_height,
                        )
                    )
                else:
                    width = 12 // len(page_charts)
                    for index, chart in enumerate(page_charts):
                        items.append(LayoutItem(item_id=chart.chart_id, kind="chart", x=index * width, y=chart_y, w=width, h=chart_height))
            offset += chart_count
            page += 1

        first_kpi_overflow_page = page
        start_offset = kpi_offset
        for offset in range(kpi_offset, len(kpis), 12):
            page = first_kpi_overflow_page + ((offset - start_offset) // 12)
            base_y = page * 8
            page_kpis = kpis[offset : offset + 12]
            add_title(page)
            if len(page_kpis) <= 2:
                for index, kpi in enumerate(page_kpis):
                    items.append(LayoutItem(item_id=kpi.kpi_id, kind="kpi", x=index * 6, y=base_y + 1, w=6, h=4))
                continue
            if len(page_kpis) <= 4:
                for index, kpi in enumerate(page_kpis):
                    items.append(
                        LayoutItem(
                            item_id=kpi.kpi_id,
                            kind="kpi",
                            x=(index % 2) * 6,
                            y=base_y + 1 + (index // 2) * 3,
                            w=6,
                            h=3,
                        )
                    )
                continue
            for index, kpi in enumerate(page_kpis):
                items.append(
                    LayoutItem(
                        item_id=kpi.kpi_id,
                        kind="kpi",
                        x=(index % 4) * 3,
                        y=base_y + 1 + (index // 4) * 2,
                        w=3,
                        h=2,
                    )
                )

        return items

    def _dashboard_title(self, plan: DashboardPlan, profile: DatasetProfile) -> str:
        title = plan.title.strip()
        if title and not self._is_generic_title(title):
            return title

        metrics = self._semantic_metric_columns(profile)
        dimensions = profile.categorical_columns
        if metrics and dimensions:
            return f"{self._label(metrics[0])} Performance by {self._label(dimensions[0])}"
        if metrics:
            return f"{', '.join(self._label(metric) for metric in metrics[:3])} Performance Dashboard"
        if dimensions:
            return f"{self._label(dimensions[0])} Breakdown Dashboard"
        return "CSV Analytics Dashboard"

    def _dashboard_description(self, plan: DashboardPlan, profile: DatasetProfile) -> str:
        description = plan.description.strip()
        if description and not self._is_generic_description(description):
            return description

        parts = [
            f"Analyzes {profile.row_count:,} records across {profile.column_count:,} fields",
        ]
        metrics = self._semantic_metric_columns(profile)
        if metrics:
            parts.append(f"tracking {', '.join(self._label(column) for column in metrics[:3])}")
        if profile.categorical_columns:
            parts.append(f"split by {', '.join(self._label(column) for column in profile.categorical_columns[:3])}")
        return "; ".join(parts) + "."

    def _page_titles(
        self,
        items: list[LayoutItem],
        charts: list[ChartResponse],
        plan: DashboardPlan,
        profile: DatasetProfile,
    ) -> list[str]:
        existing = [title.strip() for title in (plan.layout.page_titles or [])]
        charts_by_id = {chart.chart_id: chart for chart in charts}
        last_page = max((item.y + item.h - 1) // 12 for item in items) if items else 0
        titles: list[str] = []
        for page in range(last_page + 1):
            if page < len(existing) and existing[page] and not existing[page].lower().startswith("page "):
                titles.append(existing[page])
                continue
            page_items = [item for item in items if item.y // 12 == page]
            hero = max(
                (item for item in page_items if item.kind == "chart" and item.item_id in charts_by_id),
                key=lambda item: item.w * item.h,
                default=None,
            )
            if hero:
                titles.append(charts_by_id[hero.item_id].title)
            elif any(item.kind == "kpi" for item in page_items):
                titles.append("Executive KPI overview")
            else:
                titles.append(self._dashboard_title(plan, profile))
        return titles

    def _is_generic_title(self, title: str) -> bool:
        normalized = title.strip().lower()
        generic_titles = {
            "dashboard",
            "auto dashboard",
            "csv dashboard",
            "data dashboard",
            "analytics dashboard",
        }
        return normalized in generic_titles

    def _semantic_metric_columns(self, profile: DatasetProfile) -> list[str]:
        metrics: list[str] = []
        for column in [*getattr(profile, "metric_candidates", []), *getattr(profile, "rate_metric_candidates", [])]:
            if column in profile.numeric_columns and column not in metrics:
                metrics.append(column)
        for column in profile.possible_metric_columns:
            if column in profile.numeric_columns and column not in metrics and not self._is_non_metric_numeric(column, profile):
                metrics.append(column)
        for column_profile in profile.columns:
            if (
                column_profile.name in profile.numeric_columns
                and column_profile.role in {"measure", "metric", "rate_metric"}
                and column_profile.name not in metrics
                and not self._is_non_metric_numeric(column_profile.name, profile)
            ):
                metrics.append(column_profile.name)
        return metrics

    def _is_non_metric_numeric(self, column: str, profile: DatasetProfile) -> bool:
        if column in profile.datetime_columns:
            return True
        column_profile = next((item for item in profile.columns if item.name == column), None)
        if column_profile and column_profile.role in {"datetime", "time", "dimension", "id", "identifier", "text", "boolean", "excluded"}:
            return True
        lower = column.lower()
        if any(marker in lower for marker in ("date", "time", "month", "year", "day", "created", "updated")):
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

    def _is_generic_description(self, description: str) -> bool:
        normalized = description.strip().lower().rstrip(".")
        generic_descriptions = {
            "an automatically generated dashboard for the uploaded dataset",
            "a rule-based dashboard generated from the dataset profile",
        }
        return normalized in generic_descriptions or "dataset profile" in normalized

    def _label(self, column: str) -> str:
        return column.replace("_", " ").replace("-", " ").title()

    def _chart_code(self, chart_plan: ChartPlan, figure: go.Figure, theme_key: str) -> str:
        figure_json = json.dumps(json.loads(figure.to_json()), indent=2)
        return (
            "import plotly.graph_objects as go\n\n"
            f"# AutoDash AI chart: {chart_plan.title}\n"
            f"# Theme: {self._theme(theme_key)['label']}\n"
            f"fig = go.Figure({figure_json})\n"
            "fig.show()\n"
        )

    def _dashboard_code(self, plan: DashboardPlan, theme_key: str) -> str:
        chart_titles = ", ".join(chart.title for chart in plan.charts[:6])
        return (
            "import plotly.graph_objects as go\n"
            "from plotly.subplots import make_subplots\n\n"
            f"# AutoDash AI dashboard: {plan.title}\n"
            f"# Theme: {self._theme(theme_key)['label']}\n"
            f"# Charts: {chart_titles}\n"
            "# Individual chart figure JSON is returned in each chart.plotly_json payload.\n"
        )

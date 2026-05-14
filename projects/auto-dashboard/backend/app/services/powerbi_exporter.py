from __future__ import annotations

import base64
import copy
import hashlib
import io
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import pandas as pd
from PIL import Image, ImageDraw, ImageFont

from app.models.schemas import ChartPlan, ChartResponse, DashboardFilterControl, DashboardPlan, DashboardResponse, DatasetProfile, KpiCardResponse
from app.services.data_profiler import json_safe


CANVAS_WIDTH = 1920
CANVAS_HEIGHT = 1080
PBIX_CANVAS_WIDTH = 1280
PBIX_CANVAS_HEIGHT = 720
PBIX_DASHBOARD_IMAGE = "autodash-dashboard.png"
PBI_TABLE_NAME = "AutoDashData"
PBI_ROW_ID_COLUMN = "__AutoDashRowId"
PBI_HISTOGRAM_BIN_PREFIX = "__AutoDashBin"
PBI_FONT_FAMILY = "'Geist', 'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif"
PBI_FONT_SANS = "'Geist', 'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif"
PBI_FONT_SEMIBOLD = "'Geist SemiBold', 'Segoe UI Semibold', wf_segoe-ui_semibold, helvetica, arial, sans-serif"
PBI_FONT_BOLD = "'Geist Bold', 'Segoe UI Bold', wf_segoe-ui_bold, helvetica, arial, sans-serif"
PBI_CSS_FONT_STACK = "Geist, Inter, 'Segoe UI', Arial, sans-serif"
PBITOOLS_MAX_EXPORT_SECONDS = 29.0
PBITOOLS_DEFAULT_EXPORT_SECONDS = 28.0
PBITOOLS_MIN_EXPORT_SECONDS = 5.0
PBI_VISUAL_MAPPINGS: dict[str, dict[str, Any]] = {
    "bar": {"visual": "clusteredColumnChart", "x_role": "Category", "y_role": "Y", "series_role": "Series", "requires_y": True, "aggregate_y": True},
    "line": {"visual": "lineChart", "x_role": "Category", "y_role": "Y", "series_role": "Series", "requires_y": True, "aggregate_y": True},
    "scatter": {"visual": "scatterChart", "x_role": "X", "y_role": "Y", "series_role": "Series", "requires_y": True, "aggregate_y": False},
    "histogram": {"visual": "clusteredColumnChart", "x_role": "Category", "y_role": "Y", "requires_y": False, "aggregate_y": True, "count_rows": True, "bin_x": True},
    "pie": {"visual": "pieChart", "x_role": "Category", "y_role": "Y", "requires_y": True, "aggregate_y": True},
    "box": {"visual": "tableEx", "x_role": "Rows", "y_role": "Values", "requires_y": True, "aggregate_y": True},
    "correlation_heatmap": {"visual": "matrix", "x_role": "Rows", "requires_y": False, "aggregate_y": False},
}


class PowerBIExportUnavailableError(RuntimeError):
    pass


class PowerBIExporter:
    def __init__(self) -> None:
        self._pbitools_cache_lock = threading.Lock()

    def build_export_bundle(
        self,
        dashboard: DashboardResponse,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        filename: str,
        plan: DashboardPlan | None = None,
    ) -> tuple[bytes, str]:
        slug = self._slugify(dashboard.title or filename)
        template_path = self._pbix_template_path()
        if not template_path.exists():
            raise PowerBIExportUnavailableError(
                "Power BI export requires a seed PBIX template. Set AUTODASH_PBIX_TEMPLATE_PATH to a valid .pbix file."
            )

        pbitools_mode = self._pbitools_mode()
        if pbitools_mode != "never":
            extract_tool = self._pbi_tools_extract_path()
            compile_tool = self._pbi_tools_compile_path()
            if extract_tool and compile_tool:
                try:
                    return self._build_pbitools_pbix(
                        dashboard=dashboard,
                        dataframe=dataframe,
                        profile=profile,
                        filename=filename,
                        template_path=template_path,
                        slug=slug,
                        plan=plan,
                        extract_tool=extract_tool,
                        compile_tool=compile_tool,
                        budget_seconds=self._pbitools_budget_seconds(),
                    )
                except PowerBIExportUnavailableError:
                    if pbitools_mode == "required":
                        raise
            elif pbitools_mode == "required":
                raise PowerBIExportUnavailableError("pbi-tools mode is required, but pbi-tools was not found.")

        return self._build_seed_pbix(
            dashboard=dashboard,
            dataframe=dataframe,
            profile=profile,
            filename=filename,
            template_path=template_path,
            slug=slug,
            plan=plan,
        )

    def _pbix_template_path(self) -> Path:
        configured = os.getenv("AUTODASH_PBIX_TEMPLATE_PATH")
        if configured:
            return Path(configured)
        return Path(__file__).resolve().parents[3] / "DF_CA2_individual_template.pbix"

    def _pbitools_mode(self) -> str:
        mode = os.getenv("AUTODASH_PBITOOLS_MODE", "required").strip().lower()
        if mode in {"0", "false", "off", "no", "never"}:
            return "never"
        if mode in {"required", "require", "only"}:
            return "required"
        return "auto"

    def _pbitools_budget_seconds(self) -> float:
        try:
            requested = float(os.getenv("AUTODASH_PBITOOLS_EXPORT_BUDGET_SECONDS", str(PBITOOLS_DEFAULT_EXPORT_SECONDS)))
        except ValueError:
            requested = PBITOOLS_DEFAULT_EXPORT_SECONDS
        return max(PBITOOLS_MIN_EXPORT_SECONDS, min(PBITOOLS_MAX_EXPORT_SECONDS, requested))

    def _pbi_tools_extract_path(self) -> Path | None:
        return self._first_existing_tool(
            [
                os.getenv("AUTODASH_PBITOOLS_EXTRACT_PATH"),
                os.getenv("AUTODASH_PBITOOLS_PATH"),
                str(Path(__file__).resolve().parents[3] / ".tools" / "pbi-tools" / "pbi-tools.exe"),
                shutil.which("pbi-tools.exe"),
                shutil.which("pbi-tools"),
            ]
        )

    def _pbi_tools_compile_path(self) -> Path | None:
        return self._first_existing_tool(
            [
                os.getenv("AUTODASH_PBITOOLS_COMPILE_PATH"),
                os.getenv("AUTODASH_PBITOOLS_PATH"),
                str(Path(__file__).resolve().parents[3] / ".tools" / "pbi-tools-net9" / "pbi-tools.core.exe"),
                str(Path(__file__).resolve().parents[3] / ".tools" / "pbi-tools" / "pbi-tools.exe"),
                shutil.which("pbi-tools.core.exe"),
                shutil.which("pbi-tools.exe"),
                shutil.which("pbi-tools"),
            ]
        )

    def _first_existing_tool(self, candidates: list[str | None]) -> Path | None:
        for candidate in candidates:
            if not candidate:
                continue
            path = Path(candidate)
            if path.exists():
                return path
        return None

    def _build_pbitools_pbix(
        self,
        dashboard: DashboardResponse,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        filename: str,
        template_path: Path,
        slug: str,
        plan: DashboardPlan | None,
        extract_tool: Path,
        compile_tool: Path,
        budget_seconds: float,
    ) -> tuple[bytes, str]:
        deadline = time.monotonic() + budget_seconds
        cache_project_path = self._ensure_pbitools_project_cache(template_path, extract_tool, deadline)
        with tempfile.TemporaryDirectory(prefix="autodash-pbix-") as temp_dir:
            temp_path = Path(temp_dir)
            project_path = temp_path / "project"
            out_path = temp_path / "out"
            out_path.mkdir(parents=True, exist_ok=True)
            shutil.copytree(cache_project_path, project_path)
            self._prepare_pbitools_project(project_path, dashboard, dataframe, profile, plan)
            self._run_pbi_tools([str(compile_tool), "compile", str(project_path), str(out_path), "PBIT", "true"], template_path.parent, deadline)
            pbit_files = sorted(out_path.glob("*.pbit"))
            if not pbit_files:
                raise PowerBIExportUnavailableError("pbi-tools finished without producing a PBIT file.")
            return pbit_files[0].read_bytes(), f"{slug}.pbit"

    def _ensure_pbitools_project_cache(self, template_path: Path, extract_tool: Path, deadline: float) -> Path:
        cache_root = Path(__file__).resolve().parents[2] / "data" / "pbitools_cache"
        cache_key = self._pbitools_cache_key(template_path, extract_tool)
        cache_path = cache_root / cache_key
        marker_path = cache_path / ".autodash-cache.json"
        if marker_path.exists() and (cache_path / "Report").exists():
            return cache_path
        with self._pbitools_cache_lock:
            if marker_path.exists() and (cache_path / "Report").exists():
                return cache_path
            cache_root.mkdir(parents=True, exist_ok=True)
            temp_path = cache_root / f".{cache_key}.{uuid4().hex}.tmp"
            if temp_path.exists():
                shutil.rmtree(temp_path, ignore_errors=True)
            try:
                self._run_pbi_tools(
                    [
                        str(extract_tool),
                        "extract",
                        str(template_path),
                        "-extractFolder",
                        str(temp_path),
                        "-modelSerialization",
                        "Raw",
                    ],
                    template_path.parent,
                    deadline,
                )
                marker_path = temp_path / ".autodash-cache.json"
                marker_path.write_text(
                    json.dumps(
                        {
                            "template": str(template_path.resolve()),
                            "template_size": template_path.stat().st_size,
                            "template_mtime_ns": template_path.stat().st_mtime_ns,
                            "extract_tool": str(extract_tool.resolve()),
                        },
                        separators=(",", ":"),
                    ),
                    encoding="utf-8",
                )
                if cache_path.exists():
                    shutil.rmtree(cache_path, ignore_errors=True)
                temp_path.rename(cache_path)
            except Exception:
                shutil.rmtree(temp_path, ignore_errors=True)
                raise
        return cache_path

    def _pbitools_cache_key(self, template_path: Path, extract_tool: Path) -> str:
        stat = template_path.stat()
        raw = f"{template_path.resolve()}|{stat.st_size}|{stat.st_mtime_ns}|{extract_tool.resolve()}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        return f"{self._slugify(template_path.stem)}-{digest}"

    def _run_pbi_tools(self, command: list[str], cwd: Path, deadline: float) -> None:
        timeout = deadline - time.monotonic()
        if timeout <= 0:
            raise PowerBIExportUnavailableError("pbi-tools export exceeded the configured time budget.")
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
        process = subprocess.Popen(
            command,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=creationflags,
        )
        try:
            stdout, _ = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            self._kill_process_tree(process)
            stdout = exc.output or ""
            raise PowerBIExportUnavailableError("pbi-tools export exceeded the configured time budget.") from exc
        if process.returncode != 0:
            output = "\n".join((stdout or "").splitlines()[-12:])
            raise PowerBIExportUnavailableError(f"pbi-tools failed with exit code {process.returncode}: {output}")

    def _kill_process_tree(self, process: subprocess.Popen[str]) -> None:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            process.kill()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

    def _prepare_pbitools_project(
        self,
        project_path: Path,
        dashboard: DashboardResponse,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        plan: DashboardPlan | None,
    ) -> None:
        title = self._display_title(dashboard)
        (project_path / "DiagramLayout.json").unlink(missing_ok=True)
        model_path = project_path / "Model"
        shutil.rmtree(model_path, ignore_errors=True)
        model_path.mkdir(parents=True, exist_ok=True)
        (model_path / "database.json").write_text(
            json.dumps(self._build_pbit_model(dataframe, profile, plan), indent=2, default=json_safe),
            encoding="utf-8",
        )
        report_path = project_path / "Report" / "report.json"
        section_path = next((project_path / "Report" / "sections").iterdir())
        visual_path = section_path / "visualContainers"
        shutil.rmtree(visual_path, ignore_errors=True)
        visual_path.mkdir(parents=True, exist_ok=True)
        shutil.rmtree(project_path / "Report" / "StaticResources" / "RegisteredResources", ignore_errors=True)
        shutil.rmtree(project_path / "StaticResources" / "RegisteredResources", ignore_errors=True)

        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["resourcePackages"] = [
            package
            for package in report.get("resourcePackages", [])
            if (package.get("resourcePackage") or {}).get("name") != "RegisteredResources"
        ]
        report_path.write_text(json.dumps(report, indent=2, default=json_safe), encoding="utf-8")

        section_json_path = section_path / "section.json"
        section = json.loads(section_json_path.read_text(encoding="utf-8"))
        section["displayName"] = title[:120]
        section["width"] = PBIX_CANVAS_WIDTH
        section["height"] = PBIX_CANVAS_HEIGHT
        section_json_path.write_text(json.dumps(section, indent=2, default=json_safe), encoding="utf-8")
        (section_path / "config.json").write_text(
            json.dumps(self._pbix_section_config(dashboard), indent=2, default=json_safe),
            encoding="utf-8",
        )
        description = self._display_description(dashboard)
        rows_per_page = max(4, int(getattr(getattr(dashboard, "layout", None), "rows_per_page", 8) or 8))
        self._write_pbitools_visuals(
            visual_path,
            self._pbix_native_layouts(
                dashboard,
                profile,
                title,
                description,
                {},
                plan=plan,
                bind_data=True,
                rows_per_page=rows_per_page,
            ),
        )

        for theme_path in (project_path / "StaticResources" / "SharedResources" / "BaseThemes").glob("*.json"):
            theme_path.write_text(json.dumps(self._build_theme(dashboard), separators=(",", ":"), default=json_safe), encoding="utf-8")

    def _write_pbitools_visuals(self, visual_path: Path, visuals: list[dict[str, Any]]) -> None:
        for index, visual in enumerate(visuals):
            config = json.loads(visual.get("config", "{}"))
            visual_type = (config.get("singleVisual") or {}).get("visualType") or "visual"
            title = (
                ((config.get("singleVisual") or {}).get("vcObjects") or {})
                .get("title", [{}])[0]
                .get("properties", {})
                .get("text", {})
                .get("expr", {})
                .get("Literal", {})
                .get("Value", visual_type)
            )
            safe_title = self._slugify(str(title).strip("'"))[:48]
            folder = visual_path / f"{index:05d}_{safe_title}"
            folder.mkdir(parents=True, exist_ok=True)
            (folder / "visualContainer.json").write_text(
                json.dumps(
                    {
                        "height": visual["height"],
                        "width": visual["width"],
                        "x": visual["x"],
                        "y": visual["y"],
                        "z": visual["z"],
                    },
                    indent=2,
                    default=json_safe,
                ),
                encoding="utf-8",
            )
            (folder / "config.json").write_text(json.dumps(config, indent=2, default=json_safe), encoding="utf-8")
            (folder / "filters.json").write_text(visual.get("filters", "[]"), encoding="utf-8")
            if "query" in visual:
                (folder / "query.json").write_text(visual["query"], encoding="utf-8")
            if "dataTransforms" in visual:
                (folder / "dataTransforms.json").write_text(visual["dataTransforms"], encoding="utf-8")

    def _build_pbit_model(self, dataframe: pd.DataFrame, profile: DatasetProfile, plan: DashboardPlan | None) -> dict[str, Any]:
        export_frame = dataframe.copy()
        if PBI_ROW_ID_COLUMN not in export_frame.columns:
            export_frame.insert(0, PBI_ROW_ID_COLUMN, range(1, len(export_frame) + 1))
        for chart in plan.charts if plan else []:
            if chart.chart_type == "histogram" and chart.x_column in export_frame.columns:
                bin_column = self._histogram_bin_column(chart.x_column)
                if bin_column not in export_frame.columns:
                    export_frame[bin_column] = self._histogram_bin_labels(export_frame[chart.x_column])
        csv_buffer = io.StringIO()
        export_frame.to_csv(csv_buffer, index=False)
        encoded_csv = base64.b64encode(csv_buffer.getvalue().encode("utf-8")).decode("ascii")
        model_columns = [self._pbi_model_column(column, export_frame, profile) for column in export_frame.columns]
        transforms = ", ".join(
            f"{{{self._m_string(str(column))}, {self._pbi_m_type(self._pbi_model_data_type(str(column), export_frame, profile))}}}"
            for column in export_frame.columns
        )
        expression = [
            "let",
            f"    EncodedCsv = {self._m_string(encoded_csv)},",
            "    BinaryCsv = Binary.FromText(EncodedCsv, BinaryEncoding.Base64),",
            "    Source = Csv.Document(BinaryCsv,[Delimiter=\",\", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),",
            "    #\"Promoted Headers\" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),",
            f"    #\"Changed Type\" = Table.TransformColumnTypes(#\"Promoted Headers\",{{{transforms}}}, \"en-US\")",
            "in",
            "    #\"Changed Type\"",
        ]
        return {
            "name": "AutoDashModel",
            "compatibilityLevel": 1550,
            "model": {
                "culture": "en-US",
                "dataAccessOptions": {"legacyRedirects": True, "returnErrorValuesAsNull": True},
                "defaultPowerBIDataSourceVersion": "powerBI_V3",
                "sourceQueryCulture": "en-US",
                "tables": [
                    {
                        "name": PBI_TABLE_NAME,
                        "lineageTag": str(uuid4()),
                        "columns": model_columns,
                        "partitions": [
                            {
                                "name": PBI_TABLE_NAME,
                                "mode": "import",
                                "source": {"type": "m", "expression": expression},
                            }
                        ],
                        "annotations": [{"name": "PBI_ResultType", "value": "Table"}],
                    }
                ],
                "relationships": [],
                "cultures": [{"name": "en-US", "linguisticMetadata": {"content": {"Version": "1.0.0", "Language": "en-US"}, "contentType": "json"}}],
                "annotations": [{"name": "PBI_QueryOrder", "value": json.dumps([PBI_TABLE_NAME])}],
            },
        }

    def _pbi_model_column(self, column: Any, dataframe: pd.DataFrame, profile: DatasetProfile) -> dict[str, Any]:
        name = str(column)
        data_type = self._pbi_model_data_type(name, dataframe, profile)
        is_bin_column = name.startswith(f"{PBI_HISTOGRAM_BIN_PREFIX}_")
        summarize = "none" if (name == PBI_ROW_ID_COLUMN or is_bin_column) else ("sum" if data_type in {"int64", "double"} else "none")
        column_model: dict[str, Any] = {
            "name": name,
            "dataType": data_type,
            "sourceColumn": name,
            "lineageTag": str(uuid4()),
            "summarizeBy": summarize,
            "annotations": [{"name": "SummarizationSetBy", "value": "Automatic"}],
        }
        if data_type == "int64":
            column_model["formatString"] = "0"
        elif data_type == "double":
            column_model["formatString"] = "#,0" if is_bin_column else "#,0.00"
        return column_model

    def _pbi_model_data_type(self, column: str, dataframe: pd.DataFrame, profile: DatasetProfile) -> str:
        if column.startswith(f"{PBI_HISTOGRAM_BIN_PREFIX}_"):
            return "double"
        if column == PBI_ROW_ID_COLUMN:
            return "int64"
        if column in profile.datetime_columns or column in profile.possible_date_columns:
            return "dateTime"
        if column in dataframe.columns:
            series = dataframe[column]
            if pd.api.types.is_bool_dtype(series):
                return "boolean"
            if pd.api.types.is_integer_dtype(series):
                return "int64"
            if pd.api.types.is_numeric_dtype(series):
                return "double"
        return "string"

    def _pbi_m_type(self, data_type: str) -> str:
        return {
            "int64": "Int64.Type",
            "double": "type number",
            "dateTime": "type datetime",
            "boolean": "type logical",
            "string": "type text",
        }.get(data_type, "type text")

    def _m_string(self, value: str) -> str:
        return '"' + value.replace('"', '""') + '"'

    def _histogram_bin_column(self, column: str) -> str:
        return f"{PBI_HISTOGRAM_BIN_PREFIX}_{self._slugify(column).replace('-', '_')}"

    def _histogram_bin_labels(self, series: pd.Series, bin_count: int = 10) -> list[float | None]:
        values = pd.to_numeric(series, errors="coerce")
        clean = values.dropna()
        if clean.empty:
            return [None for _ in values]
        low = float(clean.min())
        high = float(clean.max())
        if low == high:
            return [low if pd.notna(value) else None for value in values]
        bins = pd.cut(values, bins=bin_count, include_lowest=True)
        midpoints: list[float | None] = []
        for value in bins:
            if pd.isna(value):
                midpoints.append(None)
            else:
                midpoints.append(float((value.left + value.right) / 2))
        return midpoints

    def _build_seed_pbix(
        self,
        dashboard: DashboardResponse,
        dataframe: pd.DataFrame,
        profile: DatasetProfile,
        filename: str,
        template_path: Path,
        slug: str,
        plan: DashboardPlan | None,
    ) -> tuple[bytes, str]:
        with zipfile.ZipFile(template_path, "r") as source:
            layout = json.loads(source.read("Report/Layout").decode("utf-16-le"))
            layout = self._dashboard_pbix_layout(layout, dashboard, profile, plan)
            theme = self._build_theme(dashboard)
            layout_bytes = json.dumps(layout, separators=(",", ":"), default=json_safe).encode("utf-16-le")
            theme_bytes = json.dumps(theme, separators=(",", ":"), default=json_safe).encode("utf-8")

            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as target:
                for entry in source.infolist():
                    if entry.filename == "SecurityBindings":
                        continue
                    if entry.filename.startswith("Report/StaticResources/RegisteredResources/"):
                        continue
                    if entry.filename == "Report/Layout":
                        data = layout_bytes
                    elif entry.filename.startswith("Report/StaticResources/SharedResources/BaseThemes/") and entry.filename.endswith(".json"):
                        data = theme_bytes
                    else:
                        data = source.read(entry.filename)
                    target.writestr(entry.filename, data)

        return buffer.getvalue(), f"{slug}.pbix"

    def _dashboard_pbix_layout(
        self,
        template_layout: dict[str, Any],
        dashboard: DashboardResponse,
        profile: DatasetProfile,
        plan: DashboardPlan | None,
        image_resource_name: str | None = None,
    ) -> dict[str, Any]:
        layout = copy.deepcopy(template_layout)
        title = self._display_title(dashboard)
        description = self._display_description(dashboard)

        # Detect the number of pages from the saved layout. Default to a single page.
        layout_obj = getattr(dashboard, "layout", None)
        rows_per_page = max(4, int(getattr(layout_obj, "rows_per_page", 8) or 8)) if layout_obj else 8
        items = list(getattr(layout_obj, "items", []) or [])
        if items:
            page_indices = sorted({int(it.y) // rows_per_page for it in items})
        else:
            page_indices = [0]

        template_section = copy.deepcopy(layout["sections"][0])
        prototype: dict[str, Any] | None = None
        if not image_resource_name:
            prototype = self._textbox_prototype(template_section)

        new_sections: list[dict[str, Any]] = []
        for ordinal, page_index in enumerate(page_indices):
            section = copy.deepcopy(template_section)
            section["name"] = f"ReportSection{ordinal + 1}"
            page_label = (
                f"{title[:90]} - Page {ordinal + 1}" if len(page_indices) > 1 else title[:120]
            )
            section["displayName"] = page_label
            section["ordinal"] = ordinal
            section["width"] = PBIX_CANVAS_WIDTH
            section["height"] = PBIX_CANVAS_HEIGHT
            section["config"] = json.dumps(
                self._pbix_section_config(dashboard, image_resource_name), separators=(",", ":")
            )

            if image_resource_name and ordinal == 0:
                # Snapshot mode: keep the image-only first page; subsequent pages get a
                # placeholder textbox so Power BI shows them as empty pages.
                section["visualContainers"] = []
            elif image_resource_name:
                section["visualContainers"] = []
            else:
                assert prototype is not None
                page_title = (
                    f"{title} - Page {ordinal + 1}" if len(page_indices) > 1 else title
                )
                section["visualContainers"] = self._pbix_native_layouts(
                    dashboard,
                    profile,
                    page_title,
                    description,
                    prototype,
                    plan=plan,
                    bind_data=False,
                    page_index=page_index,
                    rows_per_page=rows_per_page,
                )
            new_sections.append(section)
        layout["sections"] = new_sections

        layout["resourcePackages"] = [
            package
            for package in layout.get("resourcePackages", [])
            if (package.get("resourcePackage") or {}).get("name") != "RegisteredResources"
        ]
        if image_resource_name:
            layout["resourcePackages"].append(self._registered_resource_package(image_resource_name))
        return layout

    def _textbox_prototype(self, section: dict[str, Any]) -> dict[str, Any]:
        for visual in section.get("visualContainers", []):
            config = json.loads(visual.get("config", "{}"))
            if (config.get("singleVisual") or {}).get("visualType") == "textbox":
                return visual
        raise PowerBIExportUnavailableError(
            "The seed PBIX does not contain a textbox visual that can be used as a layout prototype."
        )

    def _layout_positions(
        self,
        layout: Any,
        page_index: int = 0,
        rows_per_page: int = 8,
    ) -> dict[str, dict[str, float | int]]:
        """Convert a 12-col web grid layout into PBIX pixel positions on a 1280x720 page.

        Only items on `page_index` (where page = floor(item.y / rows_per_page)) are returned.
        Their y is normalized to within-page coordinates so each Power BI page is its own
        1280x720 canvas with a title band reserved at the top.
        """
        if layout is None:
            return {}
        items = getattr(layout, "items", None) or []
        if not items:
            return {}
        title_band = 96
        side_margin = 20
        top_margin = title_band + 12
        bottom_margin = 20
        gap_x = 8
        gap_y = 10
        cols = max(1, int(getattr(layout, "cols", 12) or 12))
        available_w = PBIX_CANVAS_WIDTH - 2 * side_margin
        available_h = PBIX_CANVAS_HEIGHT - top_margin - bottom_margin
        col_width = (available_w - (cols - 1) * gap_x) / cols
        # Use the configured rows_per_page so each page renders at the same density,
        # regardless of how many items happen to land on this particular page.
        row_height = (available_h - (rows_per_page - 1) * gap_y) / rows_per_page

        positions: dict[str, dict[str, float | int]] = {}
        for index, it in enumerate(items):
            item_page = int(it.y) // rows_per_page
            if item_page != page_index:
                continue
            local_y = int(it.y) % rows_per_page
            x = side_margin + int(it.x) * (col_width + gap_x)
            y = top_margin + local_y * (row_height + gap_y)
            width = int(it.w) * col_width + (int(it.w) - 1) * gap_x
            height = int(it.h) * row_height + (int(it.h) - 1) * gap_y
            z = 2000 + index
            positions[it.item_id] = {
                "x": x,
                "y": y,
                "z": z,
                "width": width,
                "height": height,
                "tabOrder": z,
            }
        return positions

    def _title_band_position(self) -> dict[str, float | int]:
        return {
            "x": 20,
            "y": 20,
            "z": 1000,
            "width": PBIX_CANVAS_WIDTH - 40,
            "height": 76,
            "tabOrder": 1000,
        }

    def _pbix_native_layouts(
        self,
        dashboard: DashboardResponse,
        profile: DatasetProfile,
        title: str,
        description: str,
        prototype: dict[str, Any],
        plan: DashboardPlan | None = None,
        bind_data: bool = False,
        page_index: int = 0,
        rows_per_page: int = 8,
    ) -> list[dict[str, Any]]:
        theme = self._theme_for_dashboard(dashboard)
        grid = self._web_grid()
        kpis = self._business_kpis(dashboard)
        chart_plans = {chart.chart_id: chart for chart in (plan.charts if plan else [])}

        # Prefer the LLM/user layout if one is saved on the dashboard.
        layout_positions = self._layout_positions(
            getattr(dashboard, "layout", None),
            page_index=page_index,
            rows_per_page=rows_per_page,
        )
        use_layout = bool(layout_positions)

        title_position = (
            self._title_band_position()
            if use_layout
            else self._position_from_box(self._grid_box(grid, 1, 12, 1, 1), 1000)
        )
        visuals: list[dict[str, Any]] = [
            self._pbix_textbox(
                prototype,
                title_position,
                [(title, 24, True), (description, 10, False)],
                background=theme["panel"],
                border=theme["border"],
            )
        ]
        # When a saved layout exists, only render the KPIs/charts whose layout entry is on this page.
        # Without a layout, fall back to the legacy "first 4 charts on page 0 only" behaviour.
        if use_layout:
            kpis_for_page = [k for k in kpis if k.kpi_id in layout_positions]
            charts_for_page = [c for c in dashboard.charts if c.chart_id in layout_positions]
        else:
            kpis_for_page = list(kpis[:4]) if page_index == 0 else []
            charts_for_page = list(dashboard.charts[:4]) if page_index == 0 else []

        for index, kpi in enumerate(kpis_for_page):
            if use_layout and kpi.kpi_id in layout_positions:
                position = {**layout_positions[kpi.kpi_id], "z": 1100 + index, "tabOrder": 1100 + index}
            else:
                position = self._position_from_box(self._grid_box(grid, 1 + index * 3, 3, 2, 1), 1100 + index)
            visuals.append(
                self._pbix_textbox(
                    prototype,
                    position,
                    [(kpi.aggregation.replace("_", " "), 8, False), (kpi.title, 10, True), (kpi.formatted_value, 18, True)],
                    background=theme["panel"],
                    border=theme["border"],
                )
            )

        default_chart_positions = [
            self._position_from_box(self._grid_box(grid, 1, 4, 3, 1), 2000),
            self._position_from_box(self._grid_box(grid, 5, 4, 3, 1), 2001),
            self._position_from_box(self._grid_box(grid, 1, 4, 4, 1), 2002),
            self._position_from_box(self._grid_box(grid, 5, 4, 4, 1), 2003),
        ]
        for index, chart in enumerate(charts_for_page):
            if use_layout and chart.chart_id in layout_positions:
                position = {**layout_positions[chart.chart_id], "z": 2000 + index, "tabOrder": 2000 + index}
            elif index < len(default_chart_positions):
                position = default_chart_positions[index]
            else:
                continue
            chart_plan = chart_plans.get(chart.chart_id)
            visuals.append(
                self._pbix_chart_visual(position, chart, theme, chart_plan if bind_data else None)
            )
            visuals.append(
                self._pbix_textbox(
                    prototype,
                    {**position, "z": int(position["z"]) + 100, "tabOrder": int(position["z"]) + 100, "height": 60},
                    [
                        (chart.title, 11, True),
                        (chart.chart_type.replace("_", " "), 8, False),
                    ],
                    background=theme["panel"],
                    border=theme["panel"],
                    shadow=False,
                )
            )

        insight_text = self._display_insights(dashboard, profile, limit=2)
        # Render the filters/insights blocks only on the page that actually owns them.
        has_support_on_page = use_layout and ("insights" in layout_positions or "filters" in layout_positions)
        if not use_layout and page_index != 0:
            return visuals
        if use_layout and not has_support_on_page:
            return visuals
        if use_layout and ("filters" in layout_positions or "insights" in layout_positions):
            support_key = "filters" if "filters" in layout_positions else "insights"
            filter_position = {**layout_positions[support_key], "z": 3000, "tabOrder": 3000}
        else:
            filter_position = self._position_from_box(self._grid_box(grid, 9, 4, 3, 1), 3000)
        if dashboard.controls:
            visuals.append(
                self._pbix_textbox(
                    prototype,
                    filter_position,
                    [],
                    background=theme["panel"],
                    border=theme["border"],
                )
            )
            visuals.append(
                self._pbix_textbox(
                    prototype,
                    {**filter_position, "z": 3001, "tabOrder": 3001, "height": 44},
                    [("SLICERS", 8, True), ("CSV row filters", 6, False)],
                    background=theme["panel"],
                    border=theme["panel"],
                    shadow=False,
                )
            )
            slicer_width = (float(filter_position["width"]) - 44) / 2
            slicer_height = 64
            slicer_row_gap = 74
            for index, control in enumerate(dashboard.controls[:4]):
                column = index % 2
                row = index // 2
                visuals.append(
                    self._pbix_slicer_visual(
                        {
                            "x": float(filter_position["x"]) + 16 + column * (slicer_width + 12),
                            "y": float(filter_position["y"]) + 54 + row * slicer_row_gap,
                            "z": 3100 + index,
                            "width": slicer_width,
                            "height": slicer_height,
                            "tabOrder": 3100 + index,
                        },
                        control,
                        theme,
                    )
                )
        else:
            side_lines: list[tuple[str, int, bool]] = [("Filters", 10, True)]
            for control in dashboard.controls[:4]:
                values = ", ".join(option.label for option in control.options[:3]) or "All"
                side_lines.append((control.label, 8, True))
                side_lines.append((values, 8, False))
            visuals.append(
                self._pbix_textbox(
                    prototype,
                    filter_position,
                    side_lines,
                    background=theme["panel"],
                    border=theme["border"],
                )
            )
        insights_position = (
            {**layout_positions["insights"], "z": 4000, "tabOrder": 4000}
            if use_layout and "insights" in layout_positions
            else {**filter_position, "z": 4000, "tabOrder": 4000}
            if use_layout and "filters" in layout_positions
            else self._position_from_box(self._grid_box(grid, 9, 4, 4, 1), 4000)
        )
        visuals.extend(
            self._pbix_insight_card_visuals(
                prototype,
                insights_position,
                insight_text,
                theme,
            )
        )
        return visuals

    def _position_from_box(self, box: tuple[float, float, float, float], z: int) -> dict[str, float | int]:
        x1, y1, x2, y2 = box
        return {"x": x1, "y": y1, "z": z, "width": x2 - x1, "height": y2 - y1, "tabOrder": z}

    def _pbix_textbox(
        self,
        prototype: dict[str, Any],
        position: dict[str, float | int],
        lines: list[tuple[str, int, bool]],
        background: str,
        border: str,
        shadow: bool = True,
    ) -> dict[str, Any]:
        position = {**position, "tabOrder": int(position["z"])}
        visual = self._pbix_visual_base(position)
        paragraphs = [
            {
                "textRuns": [
                    {
                        "value": value,
                        "textStyle": {
                            "fontSize": f"{font_size}pt",
                            "fontFamily": PBI_FONT_BOLD if bold else PBI_FONT_SANS,
                            **({"fontWeight": "bold"} if bold else {}),
                        },
                    }
                ]
            }
            for value, font_size, bold in lines
        ]
        config = {
            "name": f"autodash{uuid4().hex[:12]}",
            "layouts": [{"id": 0, "position": position}],
            "singleVisual": {
                "visualType": "textbox",
                "drillFilterOtherVisuals": True,
                "objects": {"general": [{"properties": {"paragraphs": paragraphs}}]},
                "vcObjects": self._pbix_visual_chrome(background, border, shadow=shadow),
            },
        }
        visual["config"] = json.dumps(config, separators=(",", ":"))
        return visual

    def _pbix_insight_card_visuals(
        self,
        prototype: dict[str, Any],
        position: dict[str, float | int],
        insights: list[str],
        theme: dict[str, Any],
    ) -> list[dict[str, Any]]:
        x = float(position["x"])
        y = float(position["y"])
        width = float(position["width"])
        base_z = int(position["z"])
        card_gap = 10
        card_height = min(62, max(48, (float(position["height"]) - 70 - card_gap) / max(len(insights), 1)))
        visuals = [
            self._pbix_textbox(
                prototype,
                position,
                [],
                background=theme["panel"],
                border=theme["border"],
            ),
            self._pbix_textbox(
                prototype,
                {**position, "z": base_z + 1, "tabOrder": base_z + 1, "height": 54},
                [("INSIGHTS", 8, True), ("Recommended talking points", 6, False)],
                background=theme["panel"],
                border=theme["panel"],
                shadow=False,
            ),
        ]

        for index, insight in enumerate(insights[:2]):
            visuals.append(
                self._pbix_textbox(
                    prototype,
                    {
                        "x": x + 12,
                        "y": y + 70 + index * (card_height + card_gap),
                        "z": base_z + 10 + index,
                        "width": width - 24,
                        "height": card_height,
                        "tabOrder": base_z + 10 + index,
                    },
                    [(insight, 8, False)],
                    background=theme["panelStrong"],
                    border=theme["border"],
                    shadow=False,
                )
            )
        return visuals

    def _pbix_chart_visual(
        self,
        position: dict[str, float | int],
        chart: ChartResponse,
        theme: dict[str, Any],
        chart_plan: ChartPlan | None,
    ) -> dict[str, Any]:
        position = {**position, "tabOrder": int(position["z"])}
        visual = self._pbix_visual_base(position)
        binding = self._pbix_chart_binding(chart, chart_plan)
        profile = self._pbi_visual_profile(chart)
        chart_objects = self._pbix_chart_objects(chart, profile, theme, binding)
        config = {
            "name": f"autodash{uuid4().hex[:12]}",
            "layouts": [{"id": 0, "position": position}],
            "singleVisual": {
                "visualType": profile["visual"],
                **({"projections": binding["projections"], "prototypeQuery": binding["query"]} if binding else {}),
                "drillFilterOtherVisuals": True,
                "objects": chart_objects,
                "vcObjects": self._pbix_visual_chrome(
                    theme["panel"],
                    theme["border"],
                    shadow=True,
                    title=chart.title,
                    title_color=theme["foreground"],
                ),
            },
        }
        visual["config"] = json.dumps(config, separators=(",", ":"))
        if binding:
            visual["query"] = json.dumps(
                {
                    "Commands": [
                        {
                            "SemanticQueryDataShapeCommand": {
                                "Query": binding["query"],
                                "Binding": {
                                    "Primary": {"Groupings": [{"Projections": list(range(len(binding["select"])))}]},
                                    "DataReduction": {"DataVolume": 4, "Primary": {"Sample": {}}},
                                    "Version": 1,
                                },
                                "ExecutionMetricsKind": 1,
                            }
                        }
                    ]
                },
                separators=(",", ":"),
                default=json_safe,
            )
            visual["dataTransforms"] = json.dumps({"selects": binding["select"]}, separators=(",", ":"), default=json_safe)
        return visual

    def _pbix_slicer_visual(
        self,
        position: dict[str, float | int],
        control: DashboardFilterControl,
        theme: dict[str, Any],
    ) -> dict[str, Any]:
        position = {**position, "tabOrder": int(position["z"])}
        visual = self._pbix_visual_base(position)
        binding = self._pbix_slicer_binding(control)
        text_size = self._pbi_literal("8D")
        config = {
            "name": f"autodash{uuid4().hex[:12]}",
            "layouts": [{"id": 0, "position": position}],
            "singleVisual": {
                "visualType": "slicer",
                "projections": binding["projections"],
                "prototypeQuery": binding["query"],
                "drillFilterOtherVisuals": True,
                "objects": {
                    "data": [{"properties": {"mode": self._pbi_literal("'Dropdown'")}}],
                    "general": [
                        {
                            "properties": {
                                "outlineColor": self._pbi_solid_color(theme["border"]),
                                "outlineWeight": self._pbi_literal("0D"),
                            }
                        }
                    ],
                    "selection": [
                        {
                            "properties": {
                                "selectAllCheckboxEnabled": self._pbi_literal("false"),
                                "singleSelect": self._pbi_literal("false"),
                                "strictSingleSelect": self._pbi_literal("false"),
                            }
                        }
                    ],
                    "header": [
                        {
                            "properties": {
                                "text": self._pbi_literal(self._pbix_string_literal(control.label)),
                                "showRestatement": self._pbi_literal("false"),
                                "fontSize": text_size,
                                "textSize": text_size,
                                "fontFamily": self._pbi_literal(self._pbix_string_literal(PBI_FONT_FAMILY)),
                                "fontColor": self._pbi_solid_color(theme["foreground"]),
                                "background": self._pbi_solid_color(theme["panel"]),
                            }
                        }
                    ],
                    "items": [
                        {
                            "properties": {
                                "fontSize": text_size,
                                "textSize": text_size,
                                "fontFamily": self._pbi_literal(self._pbix_string_literal(PBI_FONT_FAMILY)),
                                "fontColor": self._pbi_solid_color(theme["foreground"]),
                                "background": self._pbi_solid_color(theme["panel"]),
                            }
                        }
                    ],
                },
                "vcObjects": self._pbix_slicer_chrome(),
            },
        }
        visual["config"] = json.dumps(config, separators=(",", ":"), default=json_safe)
        visual["query"] = json.dumps(
            {
                "Commands": [
                    {
                        "SemanticQueryDataShapeCommand": {
                            "Query": binding["query"],
                            "Binding": {
                                "Primary": {"Groupings": [{"Projections": [0]}]},
                                "DataReduction": {"DataVolume": 3, "Primary": {"Window": {}}},
                                "IncludeEmptyGroups": True,
                                "Version": 1,
                            },
                            "ExecutionMetricsKind": 1,
                        }
                    }
                ]
            },
            separators=(",", ":"),
            default=json_safe,
        )
        visual["dataTransforms"] = json.dumps(
            {
                "objects": {
                    "data": [{"properties": {"mode": self._pbi_literal("'Dropdown'")}}],
                    "general": [{"properties": {"outlineColor": self._pbi_solid_color(theme["border"]), "outlineWeight": self._pbi_literal("1D")}}],
                    "header": [
                        {
                            "properties": {
                                "text": self._pbi_literal(self._pbix_string_literal(control.label)),
                                "showRestatement": self._pbi_literal("false"),
                                "fontSize": text_size,
                                "textSize": text_size,
                                "fontFamily": self._pbi_literal(self._pbix_string_literal(PBI_FONT_FAMILY)),
                                "fontColor": self._pbi_solid_color(theme["foreground"]),
                                "background": self._pbi_solid_color(theme["panel"]),
                            }
                        }
                    ],
                    "items": [
                        {
                            "properties": {
                                "fontSize": text_size,
                                "textSize": text_size,
                                "fontFamily": self._pbi_literal(self._pbix_string_literal(PBI_FONT_FAMILY)),
                                "fontColor": self._pbi_solid_color(theme["foreground"]),
                                "background": self._pbi_solid_color(theme["panel"]),
                            }
                        }
                    ],
                },
                "projectionOrdering": {"Values": [0]},
                "projectionActiveItems": {"Values": [{"queryRef": binding["select"]["Name"], "suppressConcat": False}]},
                "queryMetadata": {
                    "Select": [{"Restatement": control.label, "Name": binding["select"]["Name"], "Type": 3}],
                    "Filters": [{"type": 2, "expression": self._pbi_column_expression(control.column, entity=True)}],
                },
                "visualElements": [{"DataRoles": [{"Name": "Values", "Projection": 0, "isActive": True}]}],
                "selects": [
                    {
                        "displayName": control.label,
                        "queryName": binding["select"]["Name"],
                        "roles": {"Values": True},
                        "type": {"category": None, "underlyingType": 1},
                        "expr": self._pbi_column_expression(control.column, entity=True),
                    }
                ],
            },
            separators=(",", ":"),
            default=json_safe,
        )
        return visual

    def _pbix_slicer_binding(self, control: DashboardFilterControl) -> dict[str, Any]:
        select = self._pbi_column_select(control.column)
        return {
            "query": {"Version": 2, "From": [{"Name": "a", "Entity": PBI_TABLE_NAME, "Type": 0}], "Select": [select]},
            "select": select,
            "projections": {"Values": [{"queryRef": select["Name"], "active": True}]},
        }

    def _pbix_chart_objects(self, chart: ChartResponse, profile: dict[str, Any], theme: dict[str, Any], binding: dict[str, Any] | None = None) -> dict[str, Any]:
        has_series = bool(binding and (binding.get("projections") or {}).get("Series"))
        is_histogram = bool(profile.get("bin_x"))
        objects: dict[str, Any] = {
            "general": [{"properties": {"responsive": self._pbi_literal("true")}}],
            "categoryAxis": [
                {
                    "properties": {
                        "show": self._pbi_literal("true"),
                        "fontSize": self._pbi_literal("8D"),
                        "fontFamily": self._pbi_literal(self._pbix_string_literal(PBI_FONT_FAMILY)),
                        "labelColor": self._pbi_solid_color(theme["muted"]),
                        "title": self._pbi_literal("false" if is_histogram else "true"),
                        "showAxisTitle": self._pbi_literal("false" if is_histogram else "true"),
                        "labelDisplayUnits": self._pbi_literal("0D" if is_histogram else "1D"),
                    }
                }
            ],
            "valueAxis": [
                {
                    "properties": {
                        "show": self._pbi_literal("true"),
                        "fontSize": self._pbi_literal("8D"),
                        "fontFamily": self._pbi_literal(self._pbix_string_literal(PBI_FONT_FAMILY)),
                        "labelColor": self._pbi_solid_color(theme["muted"]),
                        "title": self._pbi_literal("false" if is_histogram else "true"),
                        "showAxisTitle": self._pbi_literal("false" if is_histogram else "true"),
                        "gridlineColor": self._pbi_solid_color(theme["grid"]),
                        "labelDisplayUnits": self._pbi_literal("1D" if is_histogram else "1000D"),
                        "labelPrecision": self._pbi_literal("0D"),
                    }
                }
            ],
            "legend": [
                {
                    "properties": {
                        "show": self._pbi_literal("true" if has_series else "false"),
                        "fontSize": self._pbi_literal("8D"),
                        "fontFamily": self._pbi_literal(self._pbix_string_literal(PBI_FONT_FAMILY)),
                        "labelColor": self._pbi_solid_color(theme["muted"]),
                        "position": self._pbi_literal("'BottomCenter'"),
                    }
                }
            ],
            "labels": [{"properties": {"show": self._pbi_literal("false")}}],
        }
        if not has_series:
            objects["dataPoint"] = [{"properties": {"defaultColor": self._pbi_solid_color(theme["accent"])}}]
        return objects

    def _pbix_slicer_chrome(self) -> dict[str, Any]:
        return {
            "background": [{"properties": {"show": self._pbi_literal("false")}}],
            "border": [{"properties": {"show": self._pbi_literal("false")}}],
            "dropShadow": [{"properties": {"show": self._pbi_literal("false")}}],
        }

    def _pbix_chart_binding(self, chart: ChartResponse, chart_plan: ChartPlan | None) -> dict[str, Any] | None:
        if not chart_plan:
            return None
        profile = self._pbi_visual_profile(chart)
        x_source_column = chart_plan.x_column
        x_column = self._histogram_bin_column(x_source_column) if profile.get("bin_x") and x_source_column else x_source_column
        y_column = chart_plan.y_column
        color_column = chart_plan.color_column
        aggregation = chart_plan.aggregation or ("count" if chart.chart_type == "histogram" else "sum")
        if profile.get("count_rows"):
            y_column = PBI_ROW_ID_COLUMN
            aggregation = "count"
        if not x_column:
            return None
        if profile.get("requires_y") and not y_column:
            return None
        select: list[dict[str, Any]] = []
        projections: dict[str, list[dict[str, Any]]] = {}

        def add_column(
            column: str,
            projection: str,
            active: bool = False,
            native_reference_name: str | None = None,
            query_reference_name: str | None = None,
        ) -> None:
            item = self._pbi_column_select(column, native_reference_name=native_reference_name, query_reference_name=query_reference_name)
            select.append(item)
            projection_item: dict[str, Any] = {"queryRef": item["Name"]}
            if active:
                projection_item["active"] = True
            projections.setdefault(projection, []).append(projection_item)

        def add_aggregate(column: str, projection: str, function: int) -> None:
            item = self._pbi_aggregate_select(column, function)
            select.append(item)
            projections.setdefault(projection, []).append({"queryRef": item["Name"]})

        add_column(
            x_column,
            str(profile["x_role"]),
            active=True,
            native_reference_name=x_source_column if profile.get("bin_x") else None,
            query_reference_name=f"{PBI_TABLE_NAME}.{x_source_column}" if profile.get("bin_x") and x_source_column else None,
        )
        y_role = profile.get("y_role")
        if y_role and y_column:
            if profile.get("aggregate_y", True):
                add_aggregate(y_column, str(y_role), self._pbi_aggregate_function(aggregation))
            else:
                add_column(y_column, str(y_role))
        series_role = profile.get("series_role")
        if series_role and color_column:
            add_column(color_column, str(series_role))

        if not select:
            return None
        return {
            "query": {"Version": 2, "From": [{"Name": "a", "Entity": PBI_TABLE_NAME, "Type": 0}], "Select": select},
            "select": select,
            "projections": projections,
        }

    def _pbi_visual_profile(self, chart: ChartResponse) -> dict[str, Any]:
        trace_type = self._plotly_trace_type(chart)
        profile = PBI_VISUAL_MAPPINGS.get(trace_type) or PBI_VISUAL_MAPPINGS.get(chart.chart_type) or PBI_VISUAL_MAPPINGS["bar"]
        return dict(profile)

    def _plotly_trace_type(self, chart: ChartResponse) -> str:
        if chart.chart_type in PBI_VISUAL_MAPPINGS and chart.chart_type != "scatter":
            return chart.chart_type
        data = chart.plotly_json.get("data") or []
        first_trace = data[0] if data and isinstance(data[0], dict) else {}
        trace_type = str(first_trace.get("type") or chart.chart_type)
        if trace_type == "scatter":
            mode = str(first_trace.get("mode") or "")
            return "line" if "lines" in mode else "scatter"
        if trace_type == "bar":
            return "bar"
        if trace_type in PBI_VISUAL_MAPPINGS:
            return trace_type
        return chart.chart_type

    def _pbi_column_select(
        self,
        column: str,
        native_reference_name: str | None = None,
        query_reference_name: str | None = None,
    ) -> dict[str, Any]:
        return {
            "Column": self._pbi_column_expression(column),
            "Name": query_reference_name or f"{PBI_TABLE_NAME}.{column}",
            "NativeReferenceName": native_reference_name or column,
        }

    def _pbi_column_expression(self, column: str, entity: bool = False) -> dict[str, Any]:
        source_ref = {"Entity": PBI_TABLE_NAME} if entity else {"Source": "a"}
        return {"Expression": {"SourceRef": source_ref}, "Property": column}

    def _pbi_literal(self, value: str) -> dict[str, Any]:
        return {"expr": {"Literal": {"Value": value}}}

    def _pbi_solid_color(self, color: str) -> dict[str, Any]:
        return {"solid": {"color": self._pbi_literal(self._pbix_string_literal(color))}}

    def _pbi_aggregate_select(self, column: str, function: int) -> dict[str, Any]:
        label = self._pbi_aggregate_label(function)
        return {
            "Aggregation": {
                "Expression": {"Column": {"Expression": {"SourceRef": {"Source": "a"}}, "Property": column}},
                "Function": function,
            },
            "Name": f"{label}({PBI_TABLE_NAME}.{column})",
            "NativeReferenceName": f"{label} of {column}",
        }

    def _pbi_aggregate_function(self, aggregation: str | None) -> int:
        return {
            "sum": 0,
            "avg": 1,
            "average": 1,
            "mean": 1,
            "min": 2,
            "max": 3,
            "count": 5,
            "count_distinct": 6,
            "median": 1,
        }.get((aggregation or "sum").lower(), 0)

    def _pbi_aggregate_label(self, function: int) -> str:
        return {0: "Sum", 1: "Average", 2: "Min", 3: "Max", 5: "Count", 6: "DistinctCount"}.get(function, "Sum")

    def _pbix_visual_base(self, position: dict[str, float | int]) -> dict[str, Any]:
        return {
            "x": position["x"],
            "y": position["y"],
            "z": position["z"],
            "width": position["width"],
            "height": position["height"],
            "filters": "[]",
            "tabOrder": position["tabOrder"],
        }

    def _pbix_visual_chrome(
        self,
        background: str,
        border: str,
        shadow: bool,
        title: str | None = None,
        title_color: str | None = None,
    ) -> dict[str, Any]:
        objects: dict[str, Any] = {
            "background": [
                {
                    "properties": {
                        "show": {"expr": {"Literal": {"Value": "true"}}},
                        "color": {"solid": {"color": {"expr": {"Literal": {"Value": self._pbix_string_literal(background)}}}}},
                        "transparency": {"expr": {"Literal": {"Value": "0D"}}},
                    }
                }
            ],
            "border": [
                {
                    "properties": {
                        "show": {"expr": {"Literal": {"Value": "true"}}},
                        "color": {"solid": {"color": {"expr": {"Literal": {"Value": self._pbix_string_literal(border)}}}}},
                        "radius": {"expr": {"Literal": {"Value": "10D"}}},
                    }
                }
            ],
            "dropShadow": [{"properties": {"show": {"expr": {"Literal": {"Value": "true" if shadow else "false"}}}}}],
        }
        if title:
            objects["title"] = [
                {
                    "properties": {
                        "show": {"expr": {"Literal": {"Value": "true"}}},
                        "text": {"expr": {"Literal": {"Value": self._pbix_string_literal(title)}}},
                        "fontSize": {"expr": {"Literal": {"Value": "10D"}}},
                        "fontFamily": {"expr": {"Literal": {"Value": self._pbix_string_literal(PBI_FONT_FAMILY)}}},
                        "fontColor": {"solid": {"color": {"expr": {"Literal": {"Value": self._pbix_string_literal(title_color or "#141414")}}}}},
                    }
                }
            ]
        return objects

    def _pbix_string_literal(self, value: str) -> str:
        return "'" + str(value).replace("'", "''") + "'"

    def _pbix_section_config(self, dashboard: DashboardResponse, image_resource_name: str | None = None) -> dict[str, Any]:
        theme = self._theme_for_dashboard(dashboard)
        if image_resource_name:
            image = {
                "image": {
                    "name": {"expr": {"Literal": {"Value": f"'{image_resource_name}'"}}},
                    "url": {
                        "expr": {
                            "ResourcePackageItem": {
                                "PackageName": "RegisteredResources",
                                "PackageType": 1,
                                "ItemName": image_resource_name,
                            }
                        }
                    },
                    "scaling": {"expr": {"Literal": {"Value": "'Fit'"}}},
                }
            }
            properties = {
                "image": image,
                "transparency": {"expr": {"Literal": {"Value": "0D"}}},
                "color": {"solid": {"color": {"expr": {"Literal": {"Value": f"'{theme['background']}'"}}}}},
            }
            return {"objects": {"background": [{"properties": properties}], "outspace": [{"properties": properties}]}}
        return {
            "objects": {
                "background": [
                    {
                        "properties": {
                            "transparency": {"expr": {"Literal": {"Value": "0D"}}},
                            "color": {"solid": {"color": {"expr": {"Literal": {"Value": f"'{theme['background']}'"}}}}},
                        }
                    }
                ]
            }
        }

    def _registered_resource_package(self, image_resource_name: str = PBIX_DASHBOARD_IMAGE) -> dict[str, Any]:
        return {
            "resourcePackage": {
                "name": "RegisteredResources",
                "type": 1,
                "items": [{"type": 100, "path": image_resource_name, "name": image_resource_name}],
                "disabled": False,
            }
        }

    def _content_types_with_png(self, content_types: bytes) -> bytes:
        text = content_types.decode("utf-8-sig")
        if 'Extension="png"' in text:
            return content_types
        text = text.replace("<Default Extension=\"gif\" ContentType=\"\" />", "<Default Extension=\"gif\" ContentType=\"\" /><Default Extension=\"png\" ContentType=\"\" />")
        return ("\ufeff" + text.lstrip("\ufeff")).encode("utf-8")

    def _theme_for_dashboard(self, dashboard: DashboardResponse) -> dict[str, Any]:
        themes: dict[str, dict[str, Any]] = {
            "executive_light": {
                "background": "#F6F8FB",
                "foreground": "#141414",
                "panel": "#FFFFFF",
                "panelStrong": "#F9FAFC",
                "border": "#DDE4EF",
                "muted": "#667085",
                "accent": "#275EFE",
                "accentSoft": "#E7EDFF",
                "plotBackground": "rgba(255,255,255,0.88)",
                "grid": "#E8EDF5",
                "tableAccent": "#275EFE",
                "dataColors": ["#275EFE", "#10A37F", "#E7A321", "#D64545", "#7C3AED", "#0E7490"],
            },
            "midnight": {
                "background": "#070B14",
                "foreground": "#E8EEF9",
                "panel": "#0D1324",
                "panelStrong": "#111A30",
                "border": "#24304A",
                "muted": "#9AA8BF",
                "accent": "#8AB4FF",
                "accentSoft": "#172A4D",
                "plotBackground": "rgba(10,15,28,0.78)",
                "grid": "rgba(232,238,249,0.12)",
                "tableAccent": "#8AB4FF",
                "dataColors": ["#8AB4FF", "#7CF6C3", "#F6C177", "#F7768E", "#BB9AF7", "#7DCFFF"],
            },
            "finance": {
                "background": "#F4F7F3",
                "foreground": "#18211F",
                "panel": "#FBFCF8",
                "panelStrong": "#FFFFFF",
                "border": "#D9E5DB",
                "muted": "#647067",
                "accent": "#0F766E",
                "accentSoft": "#DDF3EE",
                "plotBackground": "rgba(248,250,247,0.88)",
                "grid": "#E3ECE7",
                "tableAccent": "#0F766E",
                "dataColors": ["#0F766E", "#C0841A", "#334155", "#2563EB", "#9333EA", "#DC2626"],
            },
            "editorial": {
                "background": "#F7F3EC",
                "foreground": "#161616",
                "panel": "#FEFCF8",
                "panelStrong": "#FFFFFF",
                "border": "#DDD2C1",
                "muted": "#6B6B6B",
                "accent": "#B45309",
                "accentSoft": "#F7E3C2",
                "plotBackground": "rgba(253,251,247,0.92)",
                "grid": "#EAE4DA",
                "tableAccent": "#B45309",
                "dataColors": ["#111827", "#B45309", "#0F766E", "#BE123C", "#4F46E5", "#6B7280"],
            },
            "neon": {
                "background": "#040810",
                "foreground": "#F4FBFF",
                "panel": "#08111F",
                "panelStrong": "#0C1729",
                "border": "#18324C",
                "muted": "#A6B7C8",
                "accent": "#00E5FF",
                "accentSoft": "#082F40",
                "plotBackground": "rgba(4,9,18,0.86)",
                "grid": "rgba(0,229,255,0.16)",
                "tableAccent": "#00E5FF",
                "dataColors": ["#00E5FF", "#B8FF4D", "#FF4DD8", "#FFD166", "#7C4DFF", "#FF6B6B"],
            },
            "minimal": {
                "background": "#F5F5F5",
                "foreground": "#18181B",
                "panel": "#FEFEFE",
                "panelStrong": "#FFFFFF",
                "border": "#DDDDDF",
                "muted": "#71717A",
                "accent": "#18181B",
                "accentSoft": "#E4E4E7",
                "plotBackground": "rgba(250,250,250,0.94)",
                "grid": "#ECECEF",
                "tableAccent": "#18181B",
                "dataColors": ["#52525B", "#18181B", "#71717A", "#A1A1AA", "#3F3F46", "#D4D4D8"],
            },
        }
        return themes.get(dashboard.theme, themes["executive_light"])

    def _render_dashboard_snapshot(self, dashboard: DashboardResponse, profile: DatasetProfile) -> bytes:
        theme = self._theme_for_dashboard(dashboard)
        image = Image.new("RGBA", (PBIX_CANVAS_WIDTH, PBIX_CANVAS_HEIGHT), self._solid_color(theme["background"]))
        draw = ImageDraw.Draw(image)
        grid = self._web_grid()
        title_box = self._grid_box(grid, 1, 12, 1, 1)
        self._draw_panel(draw, title_box, theme)
        self._draw_ellipsis(draw, self._display_title(dashboard), (title_box[0] + 18, title_box[1] + 13), self._font(22, True), self._solid_color(theme["foreground"]), title_box[2] - title_box[0] - 36)
        self._draw_ellipsis(draw, self._display_description(dashboard), (title_box[0] + 18, title_box[1] + 45), self._font(11), self._solid_color(theme["muted"]), title_box[2] - title_box[0] - 36)

        kpis = self._business_kpis(dashboard)
        for index in range(4):
            box = self._grid_box(grid, 1 + index * 3, 3, 2, 1)
            if index < len(kpis):
                self._draw_kpi_card(draw, box, kpis[index], theme)
            else:
                self._draw_kpi_summary(draw, box, dashboard, theme, index)

        self._draw_visual_layout(image, draw, dashboard, theme)
        side_box = self._grid_box(grid, 9, 4, 3, 2)
        side_gap = 16
        half_height = (side_box[3] - side_box[1] - side_gap) / 2
        top_box = (side_box[0], side_box[1], side_box[2], side_box[1] + half_height)
        bottom_box = (side_box[0], side_box[1] + half_height + side_gap, side_box[2], side_box[3])
        if dashboard.controls:
            self._draw_controls(draw, top_box, dashboard, theme)
        else:
            self._draw_kpi_summary(draw, top_box, dashboard, theme, 1)
        self._draw_insights(draw, bottom_box, dashboard, profile, theme)

        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()

    def _web_grid(self) -> dict[str, Any]:
        x = 20
        y = 20
        width = PBIX_CANVAS_WIDTH - 40
        height = PBIX_CANVAS_HEIGHT - 40
        gap_x = 16
        gap_y = 20
        rows = [88, 112, (height - 88 - 112 - 3 * gap_y) / 2, (height - 88 - 112 - 3 * gap_y) / 2]
        col_width = (width - 11 * gap_x) / 12
        return {"x": x, "y": y, "width": width, "height": height, "gap_x": gap_x, "gap_y": gap_y, "rows": rows, "col_width": col_width}

    def _grid_box(self, grid: dict[str, Any], col_start: int, col_span: int, row_start: int, row_span: int) -> tuple[float, float, float, float]:
        x = grid["x"] + (col_start - 1) * (grid["col_width"] + grid["gap_x"])
        y = grid["y"] + sum(grid["rows"][: row_start - 1]) + (row_start - 1) * grid["gap_y"]
        width = col_span * grid["col_width"] + (col_span - 1) * grid["gap_x"]
        height = sum(grid["rows"][row_start - 1 : row_start - 1 + row_span]) + (row_span - 1) * grid["gap_y"]
        return (x, y, x + width, y + height)

    def _draw_visual_layout(self, image: Image.Image, draw: ImageDraw.ImageDraw, dashboard: DashboardResponse, theme: dict[str, Any]) -> None:
        charts = dashboard.charts[:4]
        grid = self._web_grid()
        if not charts:
            self._draw_metric_summary(draw, self._grid_box(grid, 1, 8, 3, 2), dashboard, theme)
            self._draw_kpi_summary(draw, self._grid_box(grid, 1, 4, 4, 1), dashboard, theme, 0)
            self._draw_kpi_summary(draw, self._grid_box(grid, 5, 4, 4, 1), dashboard, theme, 2)
            return
        if len(charts) == 1:
            self._draw_chart_card(image, draw, self._grid_box(grid, 1, 8, 3, 2), charts[0], theme)
            return
        if len(charts) == 2:
            self._draw_chart_card(image, draw, self._grid_box(grid, 1, 8, 3, 1), charts[0], theme)
            self._draw_chart_card(image, draw, self._grid_box(grid, 1, 8, 4, 1), charts[1], theme)
            return
        if len(charts) == 3:
            self._draw_chart_card(image, draw, self._grid_box(grid, 1, 8, 3, 1), charts[0], theme)
            self._draw_chart_card(image, draw, self._grid_box(grid, 1, 4, 4, 1), charts[1], theme)
            self._draw_chart_card(image, draw, self._grid_box(grid, 5, 4, 4, 1), charts[2], theme)
            return
        self._draw_chart_card(image, draw, self._grid_box(grid, 1, 4, 3, 1), charts[0], theme)
        self._draw_chart_card(image, draw, self._grid_box(grid, 5, 4, 3, 1), charts[1], theme)
        self._draw_chart_card(image, draw, self._grid_box(grid, 1, 4, 4, 1), charts[2], theme)
        self._draw_chart_card(image, draw, self._grid_box(grid, 5, 4, 4, 1), charts[3], theme)

    def _draw_chart_card(self, image: Image.Image, draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], chart: ChartResponse, theme: dict[str, Any]) -> None:
        self._draw_panel(draw, box, theme)
        x1, y1, x2, y2 = box
        self._draw_ellipsis(draw, chart.title, (x1 + 12, y1 + 8), self._font(12, True), self._solid_color(theme["foreground"]), x2 - x1 - 24)
        self._draw_ellipsis(draw, str(chart.chart_type).replace("_", " "), (x1 + 12, y1 + 26), self._font(9), self._solid_color(theme["muted"]), x2 - x1 - 24)
        plot_box = (int(x1 + 8), int(y1 + 43), int(x2 - 8), int(y2 - 8))
        plot_width = max(plot_box[2] - plot_box[0], 80)
        plot_height = max(plot_box[3] - plot_box[1], 80)
        try:
            plot = self._render_chart_image(chart, plot_width, plot_height, theme)
            image.alpha_composite(plot, dest=(plot_box[0], plot_box[1]))
        except Exception:
            self._draw_wrapped(draw, chart.explanation or "Chart preview unavailable.", (plot_box[0] + 8, plot_box[1] + 8), self._font(10), self._solid_color(theme["muted"]), plot_width - 16, 4)

    def _render_chart_image(self, chart: ChartResponse, width: int, height: int, theme: dict[str, Any]) -> Image.Image:
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        traces = chart.plotly_json.get("data") or []
        if not traces:
            self._draw_wrapped(draw, chart.explanation or "Chart preview unavailable.", (12, 12), self._font(10), self._solid_color(theme["muted"]), width - 24, 4)
            return image

        chart_type = str(chart.chart_type).lower()
        if chart_type in {"pie", "donut"}:
            self._draw_pie_preview(draw, traces[0], (8, 4, width - 8, height - 8), theme)
            return image
        if chart_type in {"box"}:
            values = self._numeric_values(traces[0].get("y") or traces[0].get("x") or [])
            self._draw_box_preview(draw, values, (44, 8, width - 12, height - 32), theme)
            return image
        if chart_type in {"correlation_heatmap", "heatmap"}:
            self._draw_heatmap_preview(draw, traces[0], (44, 8, width - 12, height - 32), theme)
            return image
        if chart_type in {"bar", "histogram"}:
            self._draw_bar_preview(draw, traces, (44, 8, width - 12, height - 32), theme, histogram=chart_type == "histogram")
            return image
        if chart_type == "scatter":
            self._draw_xy_preview(draw, traces, (44, 8, width - 12, height - 32), theme, lines=False)
            return image
        self._draw_xy_preview(draw, traces, (44, 8, width - 12, height - 32), theme, lines=True)
        return image

    def _draw_bar_preview(
        self,
        draw: ImageDraw.ImageDraw,
        traces: list[dict[str, Any]],
        box: tuple[int, int, int, int],
        theme: dict[str, Any],
        histogram: bool = False,
    ) -> None:
        trace = traces[0]
        if histogram:
            raw_values = self._numeric_values(trace.get("x") or trace.get("y") or [])
            categories, values = self._histogram_bins(raw_values)
        else:
            categories = [str(value) for value in (trace.get("x") or trace.get("labels") or [])]
            values = self._numeric_values(trace.get("y") or trace.get("values") or [])
        count = min(len(values), 24)
        if count == 0:
            return
        categories = (categories or [str(index + 1) for index in range(count)])[:count]
        values = values[:count]
        x1, y1, x2, y2 = box
        y_min, y_max = self._value_extent(values, include_zero=True)
        self._draw_plot_grid(draw, box, theme, y_min, y_max, categories)
        plot_width = x2 - x1
        slot = plot_width / count
        bar_width = max(3, slot * 0.62)
        base_y = self._scale(0, y_min, y_max, y2, y1)
        color = self._solid_color(theme["dataColors"][0])
        for index, value in enumerate(values):
            cx = x1 + slot * index + slot / 2
            value_y = self._scale(value, y_min, y_max, y2, y1)
            draw.rounded_rectangle((cx - bar_width / 2, min(base_y, value_y), cx + bar_width / 2, max(base_y, value_y)), radius=2, fill=color)

    def _draw_xy_preview(
        self,
        draw: ImageDraw.ImageDraw,
        traces: list[dict[str, Any]],
        box: tuple[int, int, int, int],
        theme: dict[str, Any],
        lines: bool,
    ) -> None:
        series: list[tuple[list[Any], list[float]]] = []
        all_y: list[float] = []
        for trace in traces[:6]:
            y_values = self._numeric_values(trace.get("y") or [])
            if not y_values:
                continue
            x_values = list(trace.get("x") or range(len(y_values)))[: len(y_values)]
            y_values = y_values[: len(x_values)]
            series.append((x_values, y_values))
            all_y.extend(y_values)
        if not series:
            return
        x1, y1, x2, y2 = box
        max_len = max(len(points) for points, _ in series)
        y_min, y_max = self._value_extent(all_y, include_zero=False)
        labels = [str(value) for value in series[0][0]]
        self._draw_plot_grid(draw, box, theme, y_min, y_max, labels)
        for series_index, (_, y_values) in enumerate(series):
            color = self._solid_color(theme["dataColors"][series_index % len(theme["dataColors"])])
            points = [
                (
                    self._scale(index, 0, max(max_len - 1, 1), x1, x2),
                    self._scale(value, y_min, y_max, y2, y1),
                )
                for index, value in enumerate(y_values)
            ]
            if lines and len(points) > 1:
                draw.line(points, fill=color, width=3, joint="curve")
            for px, py in points:
                draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=color)

    def _draw_pie_preview(self, draw: ImageDraw.ImageDraw, trace: dict[str, Any], box: tuple[int, int, int, int], theme: dict[str, Any]) -> None:
        values = self._numeric_values(trace.get("values") or trace.get("y") or [])
        labels = [str(value) for value in (trace.get("labels") or trace.get("x") or [])]
        total = sum(value for value in values if value > 0)
        if total <= 0:
            return
        x1, y1, x2, y2 = box
        diameter = min(x2 - x1, y2 - y1) - 8
        pie_box = (x1 + 4, y1 + 4, x1 + 4 + diameter, y1 + 4 + diameter)
        start = -90
        for index, value in enumerate(values[:8]):
            end = start + 360 * max(value, 0) / total
            draw.pieslice(pie_box, start=start, end=end, fill=self._solid_color(theme["dataColors"][index % len(theme["dataColors"])]))
            start = end
        legend_x = pie_box[2] + 12
        legend_y = y1 + 8
        for index, label in enumerate(labels[:5]):
            color = self._solid_color(theme["dataColors"][index % len(theme["dataColors"])])
            draw.rounded_rectangle((legend_x, legend_y + index * 18, legend_x + 10, legend_y + 10 + index * 18), radius=2, fill=color)
            self._draw_ellipsis(draw, label, (legend_x + 16, legend_y + index * 18 - 2), self._font(8), self._solid_color(theme["muted"]), max(40, x2 - legend_x - 20))

    def _draw_box_preview(self, draw: ImageDraw.ImageDraw, values: list[float], box: tuple[int, int, int, int], theme: dict[str, Any]) -> None:
        if not values:
            return
        values = sorted(values)
        x1, y1, x2, y2 = box
        low, q1, median, q3, high = self._percentile(values, 0), self._percentile(values, 25), self._percentile(values, 50), self._percentile(values, 75), self._percentile(values, 100)
        y_min, y_max = self._value_extent(values, include_zero=False)
        self._draw_plot_grid(draw, box, theme, y_min, y_max, [""])
        center = (x1 + x2) / 2
        box_width = min(80, (x2 - x1) * 0.28)
        low_y, q1_y, median_y, q3_y, high_y = [self._scale(value, y_min, y_max, y2, y1) for value in [low, q1, median, q3, high]]
        color = self._solid_color(theme["dataColors"][0])
        draw.line((center, high_y, center, q3_y), fill=color, width=2)
        draw.line((center, q1_y, center, low_y), fill=color, width=2)
        draw.rectangle((center - box_width / 2, q3_y, center + box_width / 2, q1_y), outline=color, width=2)
        draw.line((center - box_width / 2, median_y, center + box_width / 2, median_y), fill=color, width=3)
        draw.line((center - box_width / 3, high_y, center + box_width / 3, high_y), fill=color, width=2)
        draw.line((center - box_width / 3, low_y, center + box_width / 3, low_y), fill=color, width=2)

    def _draw_heatmap_preview(self, draw: ImageDraw.ImageDraw, trace: dict[str, Any], box: tuple[int, int, int, int], theme: dict[str, Any]) -> None:
        z_values = trace.get("z") or []
        if not z_values:
            return
        matrix = [[self._coerce_float(value) or 0 for value in row] for row in z_values if isinstance(row, list)]
        if not matrix:
            return
        flat = [value for row in matrix for value in row]
        min_value, max_value = min(flat), max(flat)
        x1, y1, x2, y2 = box
        rows = len(matrix)
        cols = max(len(row) for row in matrix)
        cell_width = (x2 - x1) / cols
        cell_height = (y2 - y1) / rows
        for row_index, row in enumerate(matrix):
            for col_index, value in enumerate(row):
                ratio = 0.5 if max_value == min_value else (value - min_value) / (max_value - min_value)
                color = self._interpolate_color(theme["accentSoft"], theme["accent"], ratio)
                draw.rectangle((x1 + col_index * cell_width, y1 + row_index * cell_height, x1 + (col_index + 1) * cell_width, y1 + (row_index + 1) * cell_height), fill=color)

    def _draw_plot_grid(
        self,
        draw: ImageDraw.ImageDraw,
        box: tuple[int, int, int, int],
        theme: dict[str, Any],
        y_min: float,
        y_max: float,
        labels: list[str],
    ) -> None:
        x1, y1, x2, y2 = box
        grid_color = self._solid_color(theme["grid"])
        muted = self._solid_color(theme["muted"])
        font = self._font(8)
        for index in range(5):
            ratio = index / 4
            y = y2 - ratio * (y2 - y1)
            draw.line((x1, y, x2, y), fill=grid_color, width=1)
            value = y_min + ratio * (y_max - y_min)
            self._draw_ellipsis(draw, self._compact_number(value), (2, y - 6), font, muted, x1 - 6)
        draw.line((x1, y1, x1, y2), fill=grid_color, width=1)
        draw.line((x1, y2, x2, y2), fill=grid_color, width=1)
        if labels:
            positions = [0, len(labels) // 2, len(labels) - 1] if len(labels) > 2 else list(range(len(labels)))
            for index in sorted(set(positions)):
                x = self._scale(index, 0, max(len(labels) - 1, 1), x1, x2)
                self._draw_ellipsis(draw, labels[index], (x - 28, y2 + 6), font, muted, 56)

    def _numeric_values(self, values: Any) -> list[float]:
        if values is None:
            return []
        if not isinstance(values, list):
            values = list(values) if hasattr(values, "__iter__") and not isinstance(values, str) else [values]
        numeric: list[float] = []
        for value in values:
            number = self._coerce_float(value)
            if number is not None:
                numeric.append(number)
        return numeric

    def _coerce_float(self, value: Any) -> float | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if math.isfinite(number) else None

    def _value_extent(self, values: list[float], include_zero: bool) -> tuple[float, float]:
        clean = [value for value in values if math.isfinite(value)]
        if not clean:
            return 0, 1
        if include_zero:
            clean = [*clean, 0]
        low, high = min(clean), max(clean)
        if low == high:
            padding = abs(low) * 0.1 or 1
            return low - padding, high + padding
        padding = (high - low) * 0.08
        return low - padding, high + padding

    def _scale(self, value: float, source_min: float, source_max: float, target_min: float, target_max: float) -> float:
        if source_max == source_min:
            return (target_min + target_max) / 2
        return target_min + (value - source_min) * (target_max - target_min) / (source_max - source_min)

    def _histogram_bins(self, values: list[float], bin_count: int = 14) -> tuple[list[str], list[float]]:
        if not values:
            return [], []
        low, high = min(values), max(values)
        if low == high:
            return [self._compact_number(low)], [float(len(values))]
        step = (high - low) / bin_count
        bins = [0.0 for _ in range(bin_count)]
        for value in values:
            index = min(int((value - low) / step), bin_count - 1)
            bins[index] += 1
        labels = [self._compact_number(low + step * index) for index in range(bin_count)]
        return labels, bins

    def _percentile(self, values: list[float], percentile: float) -> float:
        if not values:
            return 0
        position = (len(values) - 1) * percentile / 100
        lower = math.floor(position)
        upper = math.ceil(position)
        if lower == upper:
            return values[int(position)]
        return values[lower] * (upper - position) + values[upper] * (position - lower)

    def _interpolate_color(self, start: str, end: str, ratio: float) -> tuple[int, int, int, int]:
        start_rgba = self._solid_color(start)
        end_rgba = self._solid_color(end)
        ratio = max(0, min(1, ratio))
        return tuple(int(start_rgba[index] + (end_rgba[index] - start_rgba[index]) * ratio) for index in range(4))

    def _compact_number(self, value: float) -> str:
        absolute = abs(value)
        if absolute >= 1_000_000:
            return f"{value / 1_000_000:.1f}M"
        if absolute >= 1_000:
            return f"{value / 1_000:.0f}k"
        if absolute >= 10:
            return f"{value:.0f}"
        return f"{value:.1f}"

    def _draw_kpi_card(self, draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], kpi: KpiCardResponse, theme: dict[str, Any]) -> None:
        self._draw_panel(draw, box, theme)
        x1, y1, x2, _ = box
        self._draw_ellipsis(draw, kpi.aggregation.replace("_", " "), (x1 + 14, y1 + 12), self._font(9), self._solid_color(theme["muted"]), x2 - x1 - 66)
        self._draw_ellipsis(draw, kpi.title, (x1 + 14, y1 + 30), self._font(12, True), self._solid_color(theme["foreground"]), x2 - x1 - 66)
        draw.rounded_rectangle((x2 - 44, y1 + 14, x2 - 16, y1 + 42), radius=8, fill=self._solid_color(theme["accentSoft"]))
        draw.line((x2 - 37, y1 + 32, x2 - 30, y1 + 25, x2 - 23, y1 + 30), fill=self._solid_color(theme["accent"]), width=2)
        self._draw_ellipsis(draw, kpi.formatted_value, (x1 + 14, y1 + 64), self._font(20, True), self._solid_color(theme["foreground"]), x2 - x1 - 28)

    def _draw_kpi_summary(self, draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], dashboard: DashboardResponse, theme: dict[str, Any], start: int) -> None:
        self._draw_panel(draw, box, theme)
        x1, y1, x2, _ = box
        self._draw_ellipsis(draw, "Supporting metrics", (x1 + 14, y1 + 12), self._font(10, True), self._solid_color(theme["foreground"]), x2 - x1 - 28)
        y = y1 + 38
        for kpi in self._business_kpis(dashboard)[start : start + 3]:
            draw.rounded_rectangle((x1 + 14, y, x2 - 14, y + 30), radius=7, fill=self._solid_color(theme["panelStrong"]), outline=self._solid_color(theme["border"]))
            self._draw_ellipsis(draw, kpi.title, (x1 + 24, y + 8), self._font(9), self._solid_color(theme["muted"]), (x2 - x1) * 0.55)
            self._draw_ellipsis(draw, kpi.formatted_value, (x2 - 126, y + 7), self._font(10, True), self._solid_color(theme["foreground"]), 108)
            y += 36

    def _draw_metric_summary(self, draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], dashboard: DashboardResponse, theme: dict[str, Any]) -> None:
        self._draw_panel(draw, box, theme)
        x1, y1, x2, _ = box
        self._draw_ellipsis(draw, "Dashboard focus", (x1 + 16, y1 + 16), self._font(11, True), self._solid_color(theme["foreground"]), x2 - x1 - 32)
        self._draw_wrapped(draw, self._display_description(dashboard), (x1 + 16, y1 + 40), self._font(12), self._solid_color(theme["muted"]), x2 - x1 - 32, 3)

    def _draw_controls(self, draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], dashboard: DashboardResponse, theme: dict[str, Any]) -> None:
        self._draw_panel(draw, box, theme)
        x1, y1, x2, _ = box
        self._draw_ellipsis(draw, "Filters", (x1 + 14, y1 + 12), self._font(10, True), self._solid_color(theme["foreground"]), x2 - x1 - 28)
        y = y1 + 38
        for control in dashboard.controls[:3]:
            self._draw_ellipsis(draw, control.label, (x1 + 14, y), self._font(9, True), self._solid_color(theme["foreground"]), x2 - x1 - 28)
            values = ", ".join(option.label for option in control.options[:3]) or "All values"
            self._draw_ellipsis(draw, values, (x1 + 14, y + 16), self._font(9), self._solid_color(theme["muted"]), x2 - x1 - 28)
            y += 40

    def _draw_insights(self, draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], dashboard: DashboardResponse, profile: DatasetProfile, theme: dict[str, Any]) -> None:
        self._draw_panel(draw, box, theme)
        x1, y1, x2, _ = box
        self._draw_ellipsis(draw, "INSIGHTS", (x1 + 14, y1 + 12), self._font(10, True), self._solid_color(theme["foreground"]), x2 - x1 - 28)
        self._draw_ellipsis(draw, "Recommended talking points", (x1 + 14, y1 + 28), self._font(8), self._solid_color(theme["muted"]), x2 - x1 - 28)
        insights = self._display_insights(dashboard, profile, limit=2)
        y = y1 + 50
        for insight in insights:
            draw.rounded_rectangle((x1 + 14, y, x2 - 14, y + 58), radius=9, fill=self._solid_color(theme["panelStrong"]), outline=self._solid_color(theme["border"]))
            self._draw_wrapped(draw, insight, (x1 + 24, y + 9), self._font(10), self._solid_color(theme["muted"]), x2 - x1 - 48, 2)
            y += 68

    def _draw_panel(self, draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], theme: dict[str, Any]) -> None:
        x1, y1, x2, y2 = box
        draw.rounded_rectangle((x1 + 3, y1 + 5, x2 + 3, y2 + 5), radius=16, fill=(0, 0, 0, 18))
        draw.rounded_rectangle((x1, y1, x2, y2), radius=14, fill=self._solid_color(theme["panel"]), outline=self._solid_color(theme["border"]), width=1)

    def _draw_wrapped(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        xy: tuple[float, float],
        font: ImageFont.ImageFont,
        fill: tuple[int, int, int, int],
        max_width: float,
        max_lines: int,
    ) -> None:
        x, y = xy
        for line in self._wrapped_lines(draw, text, font, max_width, max_lines):
            draw.text((x, y), line, font=font, fill=fill)
            y += self._text_height(draw, line, font) + 4

    def _wrapped_lines(self, draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: float, max_lines: int) -> list[str]:
        words = str(text).split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if self._text_width(draw, candidate, font) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
            if len(lines) >= max_lines:
                break
        if current and len(lines) < max_lines:
            lines.append(current)
        if len(lines) == max_lines and words:
            lines[-1] = self._ellipsize(draw, lines[-1], font, max_width)
        return lines

    def _draw_ellipsis(self, draw: ImageDraw.ImageDraw, text: str, xy: tuple[float, float], font: ImageFont.ImageFont, fill: tuple[int, int, int, int], max_width: float) -> None:
        draw.text(xy, self._ellipsize(draw, str(text), font, max_width), font=font, fill=fill)

    def _ellipsize(self, draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: float) -> str:
        if self._text_width(draw, text, font) <= max_width:
            return text
        suffix = "..."
        while text and self._text_width(draw, f"{text}{suffix}", font) > max_width:
            text = text[:-1]
        return f"{text}{suffix}" if text else suffix

    def _text_width(self, draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
        box = draw.textbbox((0, 0), text, font=font)
        return box[2] - box[0]

    def _text_height(self, draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
        box = draw.textbbox((0, 0), text, font=font)
        return box[3] - box[1]

    def _font(self, size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
        candidates = (
            [
                "Geist-Bold.ttf",
                "Geist-SemiBold.ttf",
                "seguisb.ttf",
                "arialbd.ttf",
                "arial.ttf",
            ]
            if bold
            else [
                "Geist-Regular.ttf",
                "Geist.ttf",
                "segoeui.ttf",
                "arial.ttf",
            ]
        )
        for candidate in candidates:
            try:
                return ImageFont.truetype(candidate, size=size)
            except OSError:
                continue
        return ImageFont.load_default()

    def _solid_color(self, value: str) -> tuple[int, int, int, int]:
        value = str(value).strip()
        if value.startswith("#") and len(value) in {4, 7}:
            if len(value) == 4:
                value = "#" + "".join(character * 2 for character in value[1:])
            return (int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16), 255)
        match = re.match(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)", value)
        if match:
            alpha = float(match.group(4)) if match.group(4) is not None else 1
            return (int(match.group(1)), int(match.group(2)), int(match.group(3)), int(alpha * 255))
        return (255, 255, 255, 255)

    def _build_layout(
        self,
        dashboard: DashboardResponse,
        profile: DatasetProfile,
        plan: DashboardPlan | None,
    ) -> dict[str, Any]:
        chart_pages = [dashboard.charts[index : index + 4] for index in range(0, len(dashboard.charts), 4)] or [[]]
        chart_plans = {chart.chart_id: chart for chart in (plan.charts if plan else [])}
        pages = []
        for page_index, charts in enumerate(chart_pages):
            pages.append(
                {
                    "name": f"Page {page_index + 1}",
                    "displayName": dashboard.title if page_index == 0 else f"{dashboard.title} - Details {page_index + 1}",
                    "width": CANVAS_WIDTH,
                    "height": CANVAS_HEIGHT,
                    "background": dashboard.theme,
                    "objects": self._page_objects(dashboard, profile, charts, chart_plans, page_index),
                }
            )
        return {
            "format": "autodash-powerbi-layout-v1",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT, "aspectRatio": "16:9"},
            "pages": pages,
            "notes": [
                "Native PBIX binary generation is not a supported public Power BI API.",
                "Use this layout spec, theme, data CSV, and PBIP scaffold as the Power BI conversion handoff.",
                "The HTML reference preserves the exact Plotly rendering for visual comparison.",
            ],
        }

    def _page_objects(
        self,
        dashboard: DashboardResponse,
        profile: DatasetProfile,
        charts: list[ChartResponse],
        chart_plans: dict[str, ChartPlan],
        page_index: int,
    ) -> list[dict[str, Any]]:
        objects: list[dict[str, Any]] = [
            {
                "type": "title",
                "name": "Dashboard title",
                "text": dashboard.title,
                "subtitle": dashboard.description,
                "position": {"x": 40, "y": 32, "width": 1160, "height": 120},
            },
            {
                "type": "metadata",
                "name": "Dataset summary",
                "text": f"{dashboard.filtered_row_count or profile.row_count:,} of {dashboard.total_row_count or profile.row_count:,} rows • {profile.column_count:,} columns",
                "position": {"x": 1220, "y": 32, "width": 660, "height": 120},
            },
        ]

        if page_index == 0:
            for index, kpi in enumerate(dashboard.kpis[:4]):
                objects.append(
                    {
                        "type": "card",
                        "name": kpi.title,
                        "measure": kpi.column,
                        "aggregation": kpi.aggregation,
                        "value": kpi.formatted_value,
                        "position": {"x": 40 + index * 295, "y": 176, "width": 275, "height": 142},
                    }
                )
            slicer_x = 1220
            for index, control in enumerate(dashboard.controls[:3]):
                objects.append(
                    {
                        "type": "slicer",
                        "name": control.label,
                        "column": control.column,
                        "controlType": control.control_type,
                        "options": [option.model_dump() for option in control.options[:12]],
                        "position": {"x": slicer_x + index * 220, "y": 176, "width": 200, "height": 142},
                    }
                )

        positions = self._visual_positions(page_index)
        for chart, position in zip(charts, positions):
            chart_plan = chart_plans.get(chart.chart_id)
            objects.append(
                {
                    "type": "visual",
                    "name": chart.title,
                    "chartType": chart.chart_type,
                    "powerBIVisual": self._powerbi_visual_type(chart.chart_type),
                    "fields": self._chart_fields(chart, chart_plan),
                    "position": position,
                    "plotlyJson": chart.plotly_json,
                    "conversionNotes": self._conversion_notes(chart),
                }
            )

        insight_text = self._display_insights(dashboard, profile, limit=2)
        if page_index == 0 and insight_text:
            panel_position = {"x": 1420, "y": 350, "width": 460, "height": 676}
            objects.append(
                {
                    "type": "insightPanel",
                    "name": "Recommended insights",
                    "title": "INSIGHTS",
                    "subtitle": "Recommended talking points",
                    "position": panel_position,
                }
            )
            for index, insight in enumerate(insight_text):
                objects.append(
                    {
                        "type": "insightCard",
                        "name": f"Insight {index + 1}",
                        "text": insight,
                        "position": {
                            "x": panel_position["x"] + 24,
                            "y": panel_position["y"] + 86 + index * 86,
                            "width": panel_position["width"] - 48,
                            "height": 72,
                        },
                    }
                )
        return objects

    def _visual_positions(self, page_index: int) -> list[dict[str, int]]:
        if page_index == 0:
            return [
                {"x": 40, "y": 350, "width": 820, "height": 420},
                {"x": 880, "y": 350, "width": 520, "height": 420},
                {"x": 40, "y": 792, "width": 665, "height": 234},
                {"x": 725, "y": 792, "width": 675, "height": 234},
            ]
        return [
            {"x": 40, "y": 176, "width": 900, "height": 398},
            {"x": 980, "y": 176, "width": 900, "height": 398},
            {"x": 40, "y": 614, "width": 900, "height": 412},
            {"x": 980, "y": 614, "width": 900, "height": 412},
        ]

    def _chart_fields(self, chart: ChartResponse, chart_plan: ChartPlan | None) -> dict[str, Any]:
        data = chart.plotly_json.get("data") or []
        first_trace = data[0] if data else {}
        return {
            "xColumn": chart_plan.x_column if chart_plan else None,
            "yColumn": chart_plan.y_column if chart_plan else None,
            "colorColumn": chart_plan.color_column if chart_plan else None,
            "aggregation": chart_plan.aggregation if chart_plan else None,
            "x": first_trace.get("x"),
            "y": first_trace.get("y"),
            "labels": first_trace.get("labels"),
            "values": first_trace.get("values"),
            "names": first_trace.get("names"),
        }

    def _powerbi_visual_type(self, chart_type: str) -> str:
        return {
            "bar": "clusteredColumnChart",
            "line": "lineChart",
            "scatter": "scatterChart",
            "histogram": "clusteredColumnChart",
            "box": "tableEx",
            "pie": "pieChart",
            "correlation_heatmap": "matrix",
        }.get(chart_type, "tableEx")

    def _conversion_notes(self, chart: ChartResponse) -> list[str]:
        if chart.chart_type == "box":
            return ["Power BI has no default native box plot. Use a marketplace box-and-whisker visual or recreate with summary measures."]
        if chart.chart_type == "correlation_heatmap":
            return ["Recreate as a matrix with conditional formatting or use a custom heatmap visual."]
        return ["Can be recreated with native Power BI visuals using the included CSV and layout coordinates."]

    def _build_theme(self, dashboard: DashboardResponse) -> dict[str, Any]:
        theme = self._theme_for_dashboard(dashboard)
        colorway = []
        for chart in dashboard.charts:
            layout = chart.plotly_json.get("layout") or {}
            for color in layout.get("colorway") or []:
                if color not in colorway:
                    colorway.append(color)
        return {
            "name": f"AutoDash {dashboard.theme}",
            "dataColors": colorway[:8] or theme["dataColors"],
            "background": theme["background"],
            "foreground": theme["foreground"],
            "tableAccent": (colorway[:1] or [theme["tableAccent"]])[0],
            "textClasses": {
                "title": {"fontFace": PBI_FONT_FAMILY},
                "header": {"fontFace": PBI_FONT_FAMILY},
                "label": {"fontFace": PBI_FONT_FAMILY},
                "callout": {"fontFace": PBI_FONT_FAMILY},
            },
        }

    def _build_manifest(
        self,
        dashboard: DashboardResponse,
        profile: DatasetProfile,
        filename: str,
        layout: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "dashboardId": dashboard.dashboard_id,
            "datasetId": dashboard.dataset_id,
            "sourceFilename": filename,
            "title": dashboard.title,
            "description": dashboard.description,
            "profile": profile.model_dump(),
            "activeFilters": dashboard.active_filters.model_dump(),
            "visualCount": len(dashboard.charts),
            "kpiCount": len(dashboard.kpis),
            "pageCount": len(layout["pages"]),
        }

    def _build_plotly_reference_html(self, dashboard: DashboardResponse, layout: dict[str, Any]) -> str:
        title = self._display_title(dashboard)
        description = self._display_description(dashboard)
        kpis = self._business_kpis(dashboard)
        insights = self._display_insights(dashboard, limit=2)
        chart_pages = [dashboard.charts[index : index + 4] for index in range(0, len(dashboard.charts), 4)] or [[]]
        pages = []
        chart_scripts = []

        for page_index, charts in enumerate(chart_pages):
            visual_nodes = []
            for chart_index, chart in enumerate(charts):
                node_id = f"chart-{page_index + 1}-{chart_index + 1}"
                plotly_layout = {
                    **(chart.plotly_json.get("layout") or {}),
                    "autosize": True,
                    "title": None,
                    "paper_bgcolor": "rgba(0,0,0,0)",
                    "plot_bgcolor": "#ffffff",
                    "margin": {"l": 52, "r": 18, "t": 8, "b": 48},
                }
                visual_nodes.append(
                    f'<section class="visual"><h2>{self._escape_html(chart.title)}</h2><p>{self._escape_html(chart.chart_type.replace("_", " "))}</p><div id="{node_id}"></div></section>'
                )
                chart_scripts.append(
                    f"Plotly.newPlot('{node_id}', {json.dumps(chart.plotly_json.get('data') or [], default=json_safe)}, {json.dumps(plotly_layout, default=json_safe)}, {{displaylogo: false, responsive: true}});"
                )

            kpi_nodes = "".join(
                f'<section class="kpi"><span>{self._escape_html(kpi.aggregation.replace("_", " "))}</span><strong>{self._escape_html(kpi.title)}</strong><b>{self._escape_html(kpi.formatted_value)}</b></section>'
                for kpi in kpis[:4]
            )
            metric_nodes = "".join(
                f'<div class="metric"><span>{self._escape_html(kpi.title)}</span><strong>{self._escape_html(kpi.formatted_value)}</strong></div>'
                for kpi in kpis[4:7]
            )
            insight_nodes = "".join(f'<div class="insight">{self._escape_html(insight)}</div>' for insight in insights)
            side_panel = (
                f'<aside class="side"><h2>Supporting metrics</h2><div class="metric-list">{metric_nodes}</div><h2 class="section-label">INSIGHTS</h2><p class="section-subtitle">Recommended talking points</p><div class="insight-list">{insight_nodes}</div></aside>'
                if page_index == 0 and (metric_nodes or insight_nodes)
                else ""
            )
            pages.append(
                f"""<main class="page">
<header class="header"><h1>{self._escape_html(title if page_index == 0 else f"{title} - Details {page_index + 1}")}</h1><p>{self._escape_html(description)}</p></header>
{f'<section class="kpis">{kpi_nodes}</section>' if page_index == 0 and kpi_nodes else ''}
<section class="grid">{''.join(visual_nodes[:2])}{side_panel}{''.join(visual_nodes[2:])}</section>
</main>"""
            )
        return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{self._escape_html(title)}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>
body {{ margin: 0; background: #eef2f7; font-family: {PBI_CSS_FONT_STACK}; color: #141414; }}
.page {{ width: min(1600px, calc(100vw - 48px)); min-height: 900px; margin: 24px auto; padding: 28px; box-sizing: border-box; background: #f8fafc; border: 1px solid #dbe3ef; border-radius: 28px; box-shadow: 0 28px 80px rgba(15,23,42,.18); }}
.header, .kpi, .visual, .side {{ background: white; border: 1px solid #dde4ef; border-radius: 18px; box-shadow: 0 16px 34px rgba(15,23,42,.08); }}
.header {{ padding: 24px 28px; margin-bottom: 22px; }}
h1 {{ margin: 0; font-size: 32px; letter-spacing: -0.04em; }}
p {{ margin: 6px 0 0; color: #667085; font-size: 13px; }}
.kpis {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin-bottom: 22px; }}
.kpi {{ min-height: 108px; padding: 16px 18px; box-sizing: border-box; }}
.kpi span {{ display: block; color: #667085; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }}
.kpi strong {{ display: block; margin-top: 6px; font-size: 15px; }}
.kpi b {{ display: block; margin-top: 14px; font-size: 26px; letter-spacing: -0.04em; }}
.grid {{ display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: 255px; gap: 18px; }}
.visual {{ grid-column: span 4; min-width: 0; padding: 16px; overflow: hidden; }}
.visual h2, .side h2 {{ margin: 0; font-size: 15px; }}
.section-label {{ margin-top: 18px !important; font-size: 13px !important; letter-spacing: .18em; }}
.section-subtitle {{ margin: 2px 0 0; color: #667085; font-size: 11px; }}
.visual > div {{ height: 196px; }}
.side {{ grid-column: span 4; grid-row: span 2; padding: 16px; overflow: hidden; }}
.metric-list, .insight-list {{ display: grid; gap: 10px; margin: 14px 0 18px; }}
.metric, .insight {{ border: 1px solid #e5ebf3; border-radius: 12px; background: #f8fafc; padding: 10px 12px; color: #475467; font-size: 13px; }}
.metric {{ display: flex; justify-content: space-between; gap: 14px; }}
.metric strong {{ color: #141414; }}
</style>
</head>
<body>
{''.join(pages)}
<script>{''.join(chart_scripts)}</script>
</body>
</html>"""

    def _display_title(self, dashboard: DashboardResponse) -> str:
        title = dashboard.title.strip()
        if title.lower().rstrip(".") not in {"analyze this dataset and build the best dashboard", "generated dashboard", "csv analytics dashboard"}:
            return title
        by_chart = next((match for chart in dashboard.charts if (match := re.match(r"^(.+?)\s+by\s+(.+)$", chart.title, re.IGNORECASE))), None)
        if by_chart:
            return f"{self._label(by_chart.group(1))} Performance by {self._label(by_chart.group(2))}"
        kpis = self._business_kpis(dashboard)
        metric = self._clean_metric_label(kpis[0].title) if kpis else "Business"
        return f"{metric} Performance Dashboard"

    def _display_description(self, dashboard: DashboardResponse) -> str:
        description = dashboard.description.strip()
        normalized = description.lower().rstrip(".")
        if "rule-based dashboard" not in normalized and "dataset profile" not in normalized and "automatically generated dashboard" not in normalized:
            return description
        metrics = [self._clean_metric_label(kpi.title) for kpi in self._business_kpis(dashboard)[:3]]
        if metrics:
            return f"Focused view of {', '.join(metrics)} with stakeholder KPIs and visual trends from the uploaded data."
        return "Focused stakeholder dashboard with the most relevant KPIs, trends, and segment comparisons from the uploaded data."

    def _business_kpis(self, dashboard: DashboardResponse) -> list[KpiCardResponse]:
        kpis = [kpi for kpi in dashboard.kpis if not self._is_structural_kpi(kpi)]
        return kpis or dashboard.kpis

    def _is_structural_kpi(self, kpi: KpiCardResponse) -> bool:
        title = kpi.title.strip().lower()
        return title in {"rows", "columns", "row count", "column count"} or kpi.aggregation == "column_count"

    def _is_structural_insight(self, insight: str) -> bool:
        return bool(re.search(r"dataset contains .* rows .* columns", insight, re.IGNORECASE))

    def _display_insights(self, dashboard: DashboardResponse, profile: DatasetProfile | None = None, limit: int = 2) -> list[str]:
        insights = [insight for insight in dashboard.insights if not self._is_structural_insight(insight)]
        if insights:
            return insights[:limit]
        if profile:
            return [f"{profile.row_count:,} rows profiled from {profile.column_count:,} columns."]
        return []

    def _clean_metric_label(self, value: str) -> str:
        return self._label(re.sub(r"^(mean|average|sum|total|median|most frequent)\s+", "", value, flags=re.IGNORECASE))

    def _label(self, value: str) -> str:
        return re.sub(r"[_-]+", " ", value).strip().title()

    def _build_power_query(self, filename: str) -> str:
        return f"""let
    Source = Csv.Document(File.Contents("data/source.csv"),[Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    PromotedHeaders = Table.PromoteHeaders(Source, [PromoteAllScalars=true])
in
    PromotedHeaders

"""

    def _build_readme(self, dashboard: DashboardResponse, slug: str) -> str:
        return f"""# AutoDash Power BI Export Bundle

Dashboard: {dashboard.title}

## What this contains

- `data/source.csv`: the uploaded CSV used by the dashboard.
- `layout/autodash-powerbi-layout.json`: 1920x1080 Power BI-style page coordinates for cards, slicers, charts, and insights.
- `layout/powerbi-theme.json`: a Power BI theme file derived from the dashboard colors.
- `reference/exact-plotly-dashboard.html`: exact Plotly rendering reference for visual parity checks.
- `powerquery/import-source.m`: Power Query starter query for importing the CSV.
- `pbip-scaffold/{slug}.pbip`: a PBIP-style scaffold for teams using Power BI Project workflows.

## Important limitation

Power BI `.pbix` is a proprietary binary container and Microsoft does not provide a stable public API for generating a finished `.pbix` from arbitrary Plotly JSON. This bundle is the conversion pipeline handoff: it preserves the exact dashboard as HTML and provides the data, theme, layout coordinates, and native visual mapping needed to rebuild or automate a Power BI report.

## Recommended path

1. Open Power BI Desktop.
2. Import `data/source.csv`.
3. Import `layout/powerbi-theme.json` as the report theme.
4. Recreate visuals using `layout/autodash-powerbi-layout.json` positions.
5. Compare against `reference/exact-plotly-dashboard.html` for visual parity.
6. Save as `.pbix` from Power BI Desktop.
"""

    def _build_pbip_file(self, slug: str) -> dict[str, Any]:
        return {
            "version": "1.0",
            "artifacts": [
                {"report": {"path": f"./{slug}.Report"}},
                {"semanticModel": {"path": f"./{slug}.SemanticModel"}},
            ],
        }

    def _build_model_bim(self, profile: DatasetProfile, filename: str) -> dict[str, Any]:
        return {
            "name": "AutoDashModel",
            "compatibilityLevel": 1567,
            "model": {
                "culture": "en-US",
                "tables": [
                    {
                        "name": "Source",
                        "columns": [
                            {"name": column.name, "dataType": self._powerbi_data_type(column.inferred_type), "sourceColumn": column.name}
                            for column in profile.columns
                        ],
                        "partitions": [
                            {
                                "name": "Source",
                                "mode": "import",
                                "source": {
                                    "type": "m",
                                    "expression": self._build_power_query(filename),
                                },
                            }
                        ],
                    }
                ],
            },
        }

    def _powerbi_data_type(self, inferred_type: str) -> str:
        if inferred_type == "numeric":
            return "double"
        if inferred_type == "datetime":
            return "dateTime"
        return "string"

    def _slugify(self, value: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
        return cleaned[:60] or "autodash-dashboard"

    def _escape_html(self, value: str) -> str:
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

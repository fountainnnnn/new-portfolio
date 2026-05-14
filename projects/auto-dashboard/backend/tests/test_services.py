import json
import os
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path

os.environ["OPENAI_API_KEY"] = ""
os.environ["AUTODASH_DB_PATH"] = str(Path(tempfile.gettempdir()) / f"autodash-test-{os.getpid()}.sqlite")

from app.models.schemas import ChartPlan, DashboardFilterControl, DashboardFilterOption, DashboardPlan, DatasetProfile
from app.services.chart_generator import ChartGenerator
from app.services.data_profiler import DataProfiler
from app.services.openai_dashboard_agent import OpenAIDashboardAgent
from app.services.powerbi_exporter import PowerBIExportUnavailableError, PowerBIExporter
from fastapi.testclient import TestClient
from main import app


def test_profile_fallback_plan_and_chart_generation() -> None:
    csv = """date,region,sales,profit,orders
2025-01-01,North,1200,220,12
2025-01-02,South,900,180,9
2025-01-03,North,1500,310,14
2025-01-04,West,700,90,7
"""
    dataframe, profile = DataProfiler().profile_csv(csv.encode("utf-8"), "sales.csv")
    plan = OpenAIDashboardAgent()._fallback_plan(profile, "Create a sales performance dashboard")
    dashboard = ChartGenerator().generate_dashboard("dataset_1", plan, dataframe, profile, theme="midnight")

    assert profile.row_count == 4
    assert "sales" in profile.numeric_columns
    assert "date" in profile.datetime_columns
    assert dashboard.theme == "midnight"
    assert dashboard.charts
    assert dashboard.charts[0].plotly_code.startswith("import plotly.graph_objects")
    assert dashboard.kpis
    assert dashboard.title == "Sales Performance by Region"
    assert "Analyze this dataset" not in dashboard.title
    assert "rule-based dashboard" not in dashboard.description.lower()
    assert "Sales" in dashboard.description
    assert "Region" in dashboard.description
    assert dashboard.kpis[0].title == "Mean Sales"
    assert all(kpi.title not in {"Rows", "Columns"} for kpi in dashboard.kpis[:4])


def test_generate_and_refine_endpoint_preserves_dataset_context() -> None:
    client = TestClient(app)
    files = {
        "file": (
            "sales.csv",
            b"date,region,sales,profit\n2025-01-01,North,100,20\n2025-01-02,South,150,35\n",
            "text/csv",
        )
    }
    upload = client.post("/upload", files=files)
    assert upload.status_code == 200

    generated = client.post(
        "/dashboard/generate",
        json={
            "dataset_id": upload.json()["dataset_id"],
            "user_prompt": "Create a sales performance dashboard",
            "theme": "finance",
        },
    )
    assert generated.status_code == 200
    assert generated.json()["theme"] == "finance"
    assert generated.json()["tool_calls"]

    refined = client.post(
        "/dashboard/refine",
        json={
            "dashboard_id": generated.json()["dashboard_id"],
            "user_prompt": "Make it more executive and professional",
            "theme": "editorial",
        },
    )
    assert refined.status_code == 200
    assert refined.json()["theme"] == "editorial"
    assert refined.json()["charts"]
    assert refined.json()["tool_calls"][0]["tool_name"] == "load_current_dashboard"


def test_refine_endpoint_applies_visible_fallback_tweaks_from_chat_prompt() -> None:
    client = TestClient(app)
    files = {
        "file": (
            "sales.csv",
            b"date,region,sales,profit\n2025-01-01,North,100,20\n2025-01-02,South,150,35\n",
            "text/csv",
        )
    }
    upload = client.post("/upload", files=files)
    generated = client.post(
        "/dashboard/generate",
        json={
            "dataset_id": upload.json()["dataset_id"],
            "user_prompt": "Create a sales performance dashboard",
            "theme": "executive_light",
        },
    )

    refined = client.post(
        "/dashboard/refine",
        json={
            "dashboard_id": generated.json()["dashboard_id"],
            "user_prompt": "Make it dark and replace the first chart with a box plot",
            "theme": "executive_light",
        },
    )

    body = refined.json()
    assert refined.status_code == 200
    assert body["theme"] == "midnight"
    assert body["charts"][0]["chart_type"] == "box"
    assert any("Refinement applied" in insight for insight in body["insights"])


def test_dashboard_filter_endpoint_regenerates_from_selected_csv_rows() -> None:
    client = TestClient(app)
    files = {
        "file": (
            "sales.csv",
            b"date,region,sales,profit\n2025-01-01,North,100,20\n2025-01-02,South,150,35\n2025-01-03,North,200,50\n",
            "text/csv",
        )
    }
    upload = client.post("/upload", files=files)
    generated = client.post(
        "/dashboard/generate",
        json={
            "dataset_id": upload.json()["dataset_id"],
            "user_prompt": "Create a regional sales dashboard",
            "theme": "executive_light",
        },
    )

    body = generated.json()
    assert generated.status_code == 200
    assert body["controls"]
    assert body["filtered_row_count"] == 3
    assert body["total_row_count"] == 3
    assert "sales" in body["title"].lower()

    filtered = client.post(
        f"/dashboard/{body['dashboard_id']}/filter",
        json={
            "categorical_filters": {"region": "North"},
            "date_filters": {},
        },
    )
    filtered_body = filtered.json()

    assert filtered.status_code == 200
    assert filtered_body["active_filters"]["categorical_filters"]["region"] == "North"
    assert filtered_body["filtered_row_count"] == 2
    assert filtered_body["total_row_count"] == 3
    assert filtered_body["kpis"][0]["title"] == "Mean Sales"
    assert filtered_body["kpis"][0]["formatted_value"] == "150.00"


def test_powerbi_export_endpoint_returns_fast_native_pbit_file() -> None:
    client = TestClient(app)
    upload = client.post(
        "/upload",
        files={
            "file": (
                "sales.csv",
                b"date,region,sales,profit\n2025-01-01,North,100,20\n2025-01-02,South,150,35\n",
                "text/csv",
            )
        },
    )
    generated = client.post(
        "/dashboard/generate",
        json={
            "dataset_id": upload.json()["dataset_id"],
            "user_prompt": "Create a regional sales dashboard",
            "theme": "finance",
        },
    )

    response = client.get(
        f"/dashboard/{generated.json()['dashboard_id']}/powerbi/export",
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    assert response.headers["content-disposition"].endswith('.pbit"')
    assert "content-disposition" in response.headers["access-control-expose-headers"].lower()
    with zipfile.ZipFile(BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert {"Version", "Report/Layout", "DataModelSchema"}.issubset(names)
        assert "SecurityBindings" not in names
        snapshot_name = "Report/StaticResources/RegisteredResources/autodash-dashboard.png"
        assert snapshot_name not in names
        archive.testzip()
        layout = json.loads(archive.read("Report/Layout").decode("utf-16-le"))
        theme_name = next(name for name in names if name.startswith("Report/StaticResources/SharedResources/BaseThemes/"))
        theme = json.loads(archive.read(theme_name).decode("utf-8"))
        section = layout["sections"][0]
        layout_text = json.dumps(layout)
        visual_types = [
            (json.loads(visual.get("config", "{}")).get("singleVisual") or {}).get("visualType")
            for visual in section["visualContainers"]
        ]
        assert section["displayName"] == "Sales Performance by Region"
        assert len(section["visualContainers"]) >= 8
        assert "textbox" in visual_types
        assert any(visual_type in {"clusteredColumnChart", "lineChart", "scatterChart", "pieChart", "tableEx", "matrix"} for visual_type in visual_types)
        assert "autodash-dashboard.png" not in section["config"]
        assert "RegisteredResources" not in json.dumps(layout.get("resourcePackages", []))
        assert "Individual Insights" not in layout_text
        assert "INSIGHTS" in layout_text
        assert "Recommended talking points" in layout_text
        assert "fontFamily" in layout_text
        assert "Geist" in layout_text
        assert "Segoe UI" in layout_text
        assert theme["background"] == "#F4F7F3"
        assert "Geist" in theme["textClasses"]["title"]["fontFace"]
        assert "Segoe UI" in theme["textClasses"]["title"]["fontFace"]
        model = json.loads(archive.read("DataModelSchema").decode("utf-16-le"))
        model_text = json.dumps(model)
        assert "AutoDashData" in model_text
        assert "Binary.FromText" in model_text
        assert any(
            "AutoDashData." in json.dumps(json.loads(visual.get("config", "{}")).get("singleVisual") or {})
            for visual in section["visualContainers"]
        )


def test_powerbi_export_maps_histogram_and_filters_to_native_visuals() -> None:
    rows = ["date,region,channel,product_category,sales,profit,discount_rate,return_rate"]
    regions = ["North", "South", "East", "West"]
    channels = ["Direct", "Online", "Retail"]
    categories = ["Software", "Hardware", "Services"]
    for index in range(36):
        rows.append(
            f"2025-01-{index % 28 + 1:02d},{regions[index % 4]},{channels[index % 3]},{categories[index % 3]},"
            f"{8000 + index * 640},{1200 + index * 220},{0.02 + (index % 5) / 100:.2f},{0.01 + (index % 4) / 100:.2f}"
        )
    csv = "\n".join(rows).encode("utf-8")
    dataframe, profile = DataProfiler().profile_csv(csv, "sales.csv")
    plan = DashboardPlan(
        title="Sales Performance by Region",
        description="A polished executive-ready dashboard refined from the previous version.",
        charts=[
            ChartPlan(chart_id="chart_1", title="sales Trend Over Time", chart_type="line", x_column="date", y_column="sales", aggregation="sum"),
            ChartPlan(chart_id="chart_2", title="sales by region", chart_type="bar", x_column="region", y_column="sales", aggregation="sum"),
            ChartPlan(chart_id="chart_3", title="sales vs profit", chart_type="scatter", x_column="sales", y_column="profit", color_column="region"),
            ChartPlan(chart_id="chart_4", title="sales Distribution", chart_type="histogram", x_column="sales"),
        ],
    )
    controls = [
        DashboardFilterControl(
            control_id=f"filter_{column}",
            label=column,
            column=column,
            control_type="category",
            options=[DashboardFilterOption(label=value, value=value) for value in values],
        )
        for column, values in [
            ("region", regions),
            ("channel", channels),
            ("product_category", categories),
            ("date", ["2025-01-01", "2025-01-02"]),
        ]
    ]
    dashboard = ChartGenerator().generate_dashboard(
        "dataset_1",
        plan,
        dataframe,
        profile,
        theme="finance",
        controls=controls,
    )

    content, filename = PowerBIExporter().build_export_bundle(dashboard, dataframe, profile, "sales.csv", plan)

    assert filename.endswith(".pbit")
    with zipfile.ZipFile(BytesIO(content)) as archive:
        layout = json.loads(archive.read("Report/Layout").decode("utf-16-le"))
        model_text = json.dumps(json.loads(archive.read("DataModelSchema").decode("utf-16-le")))
        section = layout["sections"][0]
        single_visuals = [json.loads(visual.get("config", "{}")).get("singleVisual") or {} for visual in section["visualContainers"]]
        visual_types = [single.get("visualType") for single in single_visuals]
        visual_text = json.dumps(single_visuals)
        projection_text = json.dumps([single.get("projections") for single in single_visuals])
        slicer_containers = [
            visual
            for visual in section["visualContainers"]
            if (json.loads(visual.get("config", "{}")).get("singleVisual") or {}).get("visualType") == "slicer"
        ]
        slicer_text = json.dumps(
            [
                json.loads(visual.get("config", "{}")).get("singleVisual") or {}
                for visual in slicer_containers
            ]
        ) + "".join(visual.get("dataTransforms", "") for visual in slicer_containers)

        assert "__AutoDashBin_sales" in model_text
        assert visual_types.count("slicer") >= 4
        assert all(float(visual["height"]) >= 60 for visual in slicer_containers)
        assert '"textSize"' in slicer_text
        assert '"8D"' in slicer_text
        assert "__AutoDashBin_sales" not in projection_text
        assert "AutoDashData.sales" in projection_text
        assert "Count(AutoDashData.__AutoDashRowId)" in visual_text
        assert "AutoDashData.region" in visual_text
        assert "AutoDashData.channel" in visual_text
        assert "AutoDashData.product_category" in visual_text
        assert "AutoDashData.date" in visual_text


def test_powerbi_export_pbitools_budget_is_capped_and_falls_back(monkeypatch) -> None:
    csv = b"date,region,sales,profit\n2025-01-01,North,100,20\n2025-01-02,South,150,35\n"
    dataframe, profile = DataProfiler().profile_csv(csv, "sales.csv")
    plan = OpenAIDashboardAgent()._fallback_plan(profile, "Create a regional sales dashboard")
    dashboard = ChartGenerator().generate_dashboard("dataset_1", plan, dataframe, profile, theme="finance")
    exporter = PowerBIExporter()

    monkeypatch.setenv("AUTODASH_PBITOOLS_EXPORT_BUDGET_SECONDS", "120")
    monkeypatch.setattr(exporter, "_pbitools_mode", lambda: "auto")
    monkeypatch.setattr(exporter, "_pbi_tools_extract_path", lambda: Path(__file__))
    monkeypatch.setattr(exporter, "_pbi_tools_compile_path", lambda: Path(__file__))

    def fail_pbitools(
        dashboard,
        dataframe,
        profile: DatasetProfile,
        filename: str,
        template_path: Path,
        slug: str,
        plan: DashboardPlan | None,
        extract_tool: Path,
        compile_tool: Path,
        budget_seconds: float,
    ) -> tuple[bytes, str]:
        assert budget_seconds == 29.0
        raise PowerBIExportUnavailableError("pbi-tools export exceeded the configured time budget.")

    monkeypatch.setattr(exporter, "_build_pbitools_pbix", fail_pbitools)

    content, filename = exporter.build_export_bundle(dashboard, dataframe, profile, "sales.csv", plan)

    assert filename.endswith(".pbix")
    with zipfile.ZipFile(BytesIO(content)) as archive:
        names = set(archive.namelist())
        assert "Report/StaticResources/RegisteredResources/autodash-dashboard.png" not in names
        layout = json.loads(archive.read("Report/Layout").decode("utf-16-le"))
        assert layout["sections"][0]["visualContainers"]


def test_chat_session_persistence_round_trip() -> None:
    client = TestClient(app)
    upload = client.post(
        "/upload",
        files={
            "file": (
                "sales.csv",
                b"date,region,sales,profit\n2025-01-01,North,100,20\n2025-01-02,South,150,35\n",
                "text/csv",
            )
        },
    )
    generated = client.post(
        "/dashboard/generate",
        json={
            "dataset_id": upload.json()["dataset_id"],
            "user_prompt": "Create a regional sales dashboard",
            "theme": "finance",
        },
    )
    session_payload = {
        "session_id": "test-session-1",
        "title": "Regional sales chat",
        "dataset": upload.json(),
        "dashboard": generated.json(),
        "prompt": "Create a regional sales dashboard",
        "messages": [
            {"role": "assistant", "content": "Upload a CSV."},
            {"role": "user", "content": "Create a regional sales dashboard"},
        ],
        "selected_theme_id": "finance",
        "settings": {"showInsights": True, "showExplanations": True, "compactCharts": False},
        "updated_at": 12345,
    }

    saved = client.put("/chat-sessions/test-session-1", json=session_payload)
    listed = client.get("/chat-sessions")
    loaded = client.get("/chat-sessions/test-session-1")

    assert saved.status_code == 200
    assert listed.status_code == 200
    assert loaded.status_code == 200
    assert listed.json()[0]["session_id"] == "test-session-1"
    assert loaded.json()["dashboard"]["dashboard_id"] == generated.json()["dashboard_id"]
    assert loaded.json()["dataset"]["dataset_id"] == upload.json()["dataset_id"]
    assert loaded.json()["messages"][1]["content"] == "Create a regional sales dashboard"

    deleted = client.delete("/chat-sessions/test-session-1")
    missing = client.get("/chat-sessions/test-session-1")

    assert deleted.status_code == 204
    assert missing.status_code == 404


def test_powerbi_export_can_restore_dashboard_from_chat_session() -> None:
    client = TestClient(app)
    upload = client.post(
        "/upload",
        files={
            "file": (
                "sales.csv",
                b"date,region,sales,profit\n2025-01-01,North,100,20\n2025-01-02,South,150,35\n",
                "text/csv",
            )
        },
    )
    generated = client.post(
        "/dashboard/generate",
        json={
            "dataset_id": upload.json()["dataset_id"],
            "user_prompt": "Create a regional sales dashboard",
            "theme": "finance",
        },
    )
    dashboard_body = generated.json()
    session_dashboard_id = "chat-only-dashboard"
    dashboard_body["dashboard_id"] = session_dashboard_id
    client.put(
        "/chat-sessions/export-session",
        json={
            "session_id": "export-session",
            "title": "Export session",
            "dataset": upload.json(),
            "dashboard": dashboard_body,
            "prompt": "Create a regional sales dashboard",
            "messages": [{"role": "assistant", "content": "Generated dashboard."}],
            "selected_theme_id": "finance",
            "settings": {"showInsights": True, "showExplanations": True, "compactCharts": False},
            "updated_at": 99999,
        },
    )

    response = client.get(f"/powerbi/export/{session_dashboard_id}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    assert response.headers["content-disposition"].endswith('.pbit"')
    with zipfile.ZipFile(BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert "DataModelSchema" in names
        assert "Report/StaticResources/RegisteredResources/autodash-dashboard.png" not in names
        layout = json.loads(archive.read("Report/Layout").decode("utf-16-le"))
        section = layout["sections"][0]
        assert section["displayName"] == "Sales Performance by Region"
        assert section["visualContainers"]
        assert "autodash-dashboard.png" not in json.dumps(layout)
        model = json.loads(archive.read("DataModelSchema").decode("utf-16-le"))
        assert "AutoDashData" in json.dumps(model)

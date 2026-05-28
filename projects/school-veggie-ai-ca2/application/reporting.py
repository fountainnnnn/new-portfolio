"""PDF reporting utilities for user prediction history."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from statistics import median
from typing import Iterable


def _pretty_label(label: str | None) -> str:
    raw = (label or "").strip()
    mapping = {
        "Bitter_Gourd": "Bitter gourd",
        "Cauliflower_Broccoli": "Cauliflower / Broccoli",
        "Cucumber_BottleGourd": "Cucumber / Bottle gourd",
        "Radish_Carrot": "Radish / Carrot",
    }
    if raw in mapping:
        return mapping[raw]
    if not raw:
        return "Unknown"
    return raw.replace("_", " ")


def _fmt_dt(value: datetime | None) -> str:
    if not value:
        return "-"
    dt = value
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).strftime("%Y-%m-%d %H:%M UTC")


def _fmt_short(value: datetime | None) -> str:
    if not value:
        return "-"
    dt = value
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).strftime("%d %b %H:%M")


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        n = float(value)  # type: ignore[arg-type]
    except Exception:
        return default
    if n != n:  # NaN
        return default
    return n


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except Exception:
        return default


def _get_predict_mode(metrics: dict | None) -> str:
    if not isinstance(metrics, dict):
        return "single"
    client = metrics.get("client")
    if isinstance(client, dict):
        mode = str(client.get("predict_mode") or "").strip().lower()
        if mode in {"single", "fridge"}:
            return mode
    mode = str(metrics.get("predict_mode") or "").strip().lower()
    if mode in {"single", "fridge"}:
        return mode
    return "single"


def _extract_top_k(raw: object) -> list[tuple[str, float]]:
    if not isinstance(raw, list):
        return []
    out: list[tuple[str, float]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        label = _pretty_label(str(item.get("label") or ""))
        score = max(0.0, min(1.0, _safe_float(item.get("score"), 0.0)))
        if label and label != "Unknown":
            out.append((label, score))
    out.sort(key=lambda x: x[1], reverse=True)
    return out[:5]


@dataclass(frozen=True)
class PredictionRow:
    ts: datetime | None
    mode: str
    model: str
    label: str
    original_label: str
    is_corrected: bool
    confidence: float
    tile_index: int
    tile_total: int
    top_k: list[tuple[str, float]]
    compare_agrees: bool | None
    image_bytes: bytes | None


def build_prediction_report_pdf(*, user, predictions: Iterable, total_count: int | None = None) -> bytes:
    """Build a redesigned PDF report for a user's prediction history."""

    try:
        from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
        from reportlab.graphics.charts.lineplots import LinePlot
        from reportlab.graphics.charts.piecharts import Pie
        from reportlab.graphics.shapes import Drawing, Line, Rect, String
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            Image as RLImage,
            KeepInFrame,
            KeepTogether,
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise RuntimeError("pdf_dependency_missing") from exc

    rows: list[PredictionRow] = []
    for p in predictions:
        metrics = getattr(p, "metrics", None)
        mode = _get_predict_mode(metrics)
        tile_index = 0
        tile_total = 0
        if isinstance(metrics, dict):
            client = metrics.get("client")
            if isinstance(client, dict):
                tile_index = _safe_int(client.get("fridge_tile_index"), 0)
                tile_total = _safe_int(client.get("fridge_tile_total"), 0)

        compare = getattr(p, "compare", None)
        compare_agrees: bool | None = None
        if isinstance(compare, dict) and "agrees" in compare:
            compare_agrees = bool(compare.get("agrees"))

        label = _pretty_label(str(getattr(p, "label", "") or ""))
        original = _pretty_label(str(getattr(p, "original_label", "") or ""))
        if not original or original == "Unknown":
            original = label
        is_corrected = bool(getattr(p, "is_corrected", False))
        if not is_corrected and original and label and original != label:
            is_corrected = True

        rows.append(
            PredictionRow(
                ts=getattr(p, "created_at", None),
                mode=mode,
                model=str(getattr(p, "model", "") or ""),
                label=label,
                original_label=original,
                is_corrected=is_corrected,
                confidence=max(0.0, min(1.0, _safe_float(getattr(p, "confidence", 0.0), 0.0))),
                tile_index=max(0, tile_index),
                tile_total=max(0, tile_total),
                top_k=_extract_top_k(getattr(p, "top_k", None)),
                compare_agrees=compare_agrees,
                image_bytes=getattr(p, "image_bytes", None),
            )
        )

    total = int(total_count) if isinstance(total_count, int) and total_count >= 0 else len(rows)
    generated_at = datetime.now(UTC)
    included = len(rows)

    label_counts = Counter([r.label for r in rows if r.label and r.label != "Unknown"])
    model_counts = Counter([r.model for r in rows if r.model])
    mode_counts = Counter([r.mode for r in rows if r.mode])
    corrected_count = sum(1 for r in rows if r.is_corrected)
    with_image_count = sum(1 for r in rows if r.image_bytes)
    compare_count = sum(1 for r in rows if r.compare_agrees is not None)
    compare_disagree = sum(1 for r in rows if r.compare_agrees is False)
    fridge_rows = [r for r in rows if r.mode == "fridge"]
    single_rows = [r for r in rows if r.mode != "fridge"]

    confidences = [r.confidence for r in rows]
    avg_conf = (sum(confidences) / included) if included else 0.0
    med_conf = median(confidences) if included else 0.0
    high_conf_count = sum(1 for c in confidences if c >= 0.95)
    low_conf_count = sum(1 for c in confidences if c < 0.70)

    days_active = len({(r.ts.date() if r.ts else None) for r in rows if r.ts is not None})
    fav_label = label_counts.most_common(1)[0][0] if label_counts else "-"
    first_ts = rows[-1].ts if rows else None
    last_ts = rows[0].ts if rows else None

    bins = [
        ("0-50%", 0.00, 0.50),
        ("50-70%", 0.50, 0.70),
        ("70-85%", 0.70, 0.85),
        ("85-95%", 0.85, 0.95),
        ("95-100%", 0.95, 1.01),
    ]
    conf_dist = [sum(1 for r in rows if lo <= r.confidence < hi) for _, lo, hi in bins]

    model_conf: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        model_conf[r.model].append(r.confidence)

    label_quality_rows: list[tuple[str, int, float, int, int]] = []
    label_bucket: dict[str, list[PredictionRow]] = defaultdict(list)
    for r in rows:
        if r.label and r.label != "Unknown":
            label_bucket[r.label].append(r)
    for label, items in label_bucket.items():
        count = len(items)
        avg = sum(i.confidence for i in items) / count if count else 0.0
        corr = sum(1 for i in items if i.is_corrected)
        strong = sum(1 for i in items if i.confidence >= 0.95)
        label_quality_rows.append((label, count, avg, corr, strong))
    label_quality_rows.sort(key=lambda x: (-x[1], -x[2], x[0]))

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.1 * cm,
        bottomMargin=1.8 * cm,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        title="VeggieAI Prediction Report",
        author="VeggieAI",
    )

    # Theme
    brand = colors.HexColor("#22c55e")
    accent = colors.HexColor("#38bdf8")
    violet = colors.HexColor("#a855f7")
    amber = colors.HexColor("#f59e0b")
    ink = colors.HexColor("#0b1220")
    text = colors.HexColor("#0f172a")
    muted = colors.HexColor("#475569")
    line = colors.HexColor("#dbe4ef")
    panel = colors.HexColor("#f8fbff")

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="RptTitle",
            parent=styles["Heading1"],
            fontSize=20,
            leading=24,
            textColor=text,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="RptSection",
            parent=styles["Heading2"],
            fontSize=13,
            leading=16,
            textColor=text,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="RptBody",
            parent=styles["BodyText"],
            fontSize=9.6,
            leading=13,
            textColor=muted,
        )
    )
    styles.add(
        ParagraphStyle(
            name="RptTiny",
            parent=styles["BodyText"],
            fontSize=8.3,
            leading=10.2,
            textColor=muted,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardLabel",
            parent=styles["BodyText"],
            fontSize=8.4,
            leading=10.4,
            textColor=colors.HexColor("#64748b"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardValue",
            parent=styles["BodyText"],
            fontSize=12.5,
            leading=14.2,
            textColor=text,
            spaceBefore=2,
            spaceAfter=2,
            wordWrap="CJK",
            splitLongWords=1,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardHint",
            parent=styles["BodyText"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#64748b"),
        )
    )

    def _page_decor(c, _doc):
        width, height = A4
        c.saveState()
        header_h = 72
        y0 = height - header_h

        c.setFillColor(ink)
        c.rect(0, y0, width, header_h, stroke=0, fill=1)
        c.setFillColor(brand)
        c.rect(0, height - 5, width, 2.4, stroke=0, fill=1)
        c.setFillColor(accent)
        c.rect(0, height - 2.6, width, 2.2, stroke=0, fill=1)

        c.setFillColor(brand)
        c.circle(doc.leftMargin + 6, height - 26, 6.8, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(doc.leftMargin + 6, height - 30, "V")

        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 14.5)
        c.drawString(doc.leftMargin + 18, height - 29, "VeggieAI Performance Report")
        c.setFont("Helvetica", 9.2)
        name = (getattr(user, "full_name", None) or getattr(user, "username", None) or "User").strip()
        c.drawString(doc.leftMargin + 18, height - 44, f"{name}  |  Generated {_fmt_dt(generated_at)}")

        c.setFont("Helvetica", 8.6)
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.drawString(doc.leftMargin, 12, "VeggieAI")
        c.drawRightString(width - doc.rightMargin, 12, f"Page {c.getPageNumber()}")
        c.restoreState()

    def _metric_card(title: str, value: str, hint: str, accent_color):
        wrapped_value = value.replace(" / ", " /<br/>")
        value_box = KeepInFrame(
            maxWidth=4.7 * cm,
            maxHeight=1.35 * cm,
            content=[Paragraph(f"<b>{wrapped_value}</b>", styles["CardValue"])],
            mode="shrink",
        )
        card = Table(
            [
                [Paragraph(title, styles["CardLabel"])],
                [value_box],
                [Paragraph(hint, styles["CardHint"])],
            ],
            colWidths=[5.2 * cm],
        )
        card.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), panel),
                    ("BOX", (0, 0), (-1, -1), 0.7, line),
                    ("LINEABOVE", (0, 0), (-1, 0), 3.0, accent_color),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        return card

    def _summary_table(title: str, rows_data: list[list[str]], widths: list[float]):
        tbl = Table(rows_data, colWidths=widths, repeatRows=1, hAlign="LEFT")
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), ink),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                    ("GRID", (0, 0), (-1, -1), 0.35, line),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fbff")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        block = Table([[Paragraph(title, styles["RptSection"])], [tbl]], colWidths=[sum(widths)], hAlign="LEFT")
        block.setStyle(
            TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        return block

    def _card_frame(width: float, height: float, title: str, subtitle: str = ""):
        d = Drawing(width, height)
        d.add(Rect(0, 0, width, height, fillColor=colors.white, strokeColor=line, strokeWidth=0.8))
        d.add(Rect(0, height - 18, width, 18, fillColor=colors.HexColor("#f1f7ff"), strokeColor=line, strokeWidth=0))
        d.add(String(8, height - 12.5, title, fontName="Helvetica-Bold", fontSize=8.8, fillColor=text))
        if subtitle:
            d.add(String(width - 8, height - 12.5, subtitle, fontName="Helvetica", fontSize=7.2, fillColor=muted, textAnchor="end"))
        return d

    def _top_labels_chart(parts: list[tuple[str, int]]):
        w = 16.8 * cm
        h = 7.2 * cm
        d = _card_frame(w, h, "Top Predicted Labels", "Most frequent classes in included records")
        if not parts:
            d.add(String(10, h / 2, "No label data available", fontName="Helvetica", fontSize=9, fillColor=muted))
            return d

        labels = [p[0] if len(p[0]) < 18 else f"{p[0][:16]}.." for p in parts]
        vals = [int(p[1]) for p in parts]
        labels_rev = list(reversed(labels))
        vals_rev = list(reversed(vals))

        chart = HorizontalBarChart()
        chart.x = 4.8 * cm
        chart.y = 0.8 * cm
        chart.width = 11.3 * cm
        chart.height = 5.6 * cm
        chart.data = [vals_rev]
        chart.categoryAxis.categoryNames = labels_rev
        chart.categoryAxis.labels.fontName = "Helvetica"
        chart.categoryAxis.labels.fontSize = 7.0
        chart.categoryAxis.labels.fillColor = muted
        chart.valueAxis.valueMin = 0
        chart.valueAxis.valueMax = max(vals_rev) + max(1, int(max(vals_rev) * 0.2))
        chart.valueAxis.valueStep = max(1, int(chart.valueAxis.valueMax // 4))
        chart.valueAxis.labels.fontName = "Helvetica"
        chart.valueAxis.labels.fontSize = 7.0
        chart.valueAxis.labels.fillColor = muted
        chart.bars[0].fillColor = brand
        chart.bars[0].strokeColor = brand
        chart.bars[0].strokeWidth = 0.4
        d.add(chart)
        return d

    def _confidence_dist_chart():
        w = 16.8 * cm
        h = 7.2 * cm
        d = _card_frame(w, h, "Confidence Distribution", "Lower clutter view by confidence bands")
        chart = VerticalBarChart()
        chart.x = 1.2 * cm
        chart.y = 0.9 * cm
        chart.width = 14.8 * cm
        chart.height = 5.3 * cm
        chart.data = [conf_dist]
        chart.categoryAxis.categoryNames = [b[0] for b in bins]
        chart.categoryAxis.labels.fontName = "Helvetica"
        chart.categoryAxis.labels.fontSize = 7.0
        chart.categoryAxis.labels.fillColor = muted
        ymax = max(conf_dist) + max(1, int(max(conf_dist) * 0.2)) if conf_dist else 1
        chart.valueAxis.valueMin = 0
        chart.valueAxis.valueMax = ymax
        chart.valueAxis.valueStep = max(1, int(ymax // 4))
        chart.valueAxis.labels.fontName = "Helvetica"
        chart.valueAxis.labels.fontSize = 7.0
        chart.valueAxis.labels.fillColor = muted
        chart.bars[0].fillColor = accent
        chart.bars[0].strokeColor = accent
        chart.bars[0].strokeWidth = 0.4
        d.add(chart)
        return d

    def _confidence_trend_chart(series: list[float]):
        w = 16.8 * cm
        h = 7.2 * cm
        d = _card_frame(w, h, "Confidence Trend", "Oldest to newest across recent predictions")
        if not series:
            d.add(String(10, h / 2, "No trend data available", fontName="Helvetica", fontSize=9, fillColor=muted))
            return d

        data = [(i + 1, float(v)) for i, v in enumerate(series)]
        chart = LinePlot()
        chart.x = 1.2 * cm
        chart.y = 1.0 * cm
        chart.width = 14.8 * cm
        chart.height = 5.2 * cm
        chart.data = [data]
        chart.lines[0].strokeColor = violet
        chart.lines[0].strokeWidth = 1.9
        chart.xValueAxis.valueMin = 1
        chart.xValueAxis.valueMax = max(2, len(series))
        step = max(1, len(series) // 7)
        chart.xValueAxis.valueSteps = list(range(1, len(series) + 1, step))
        chart.xValueAxis.labels.fontName = "Helvetica"
        chart.xValueAxis.labels.fontSize = 7.0
        chart.xValueAxis.labels.fillColor = muted
        chart.yValueAxis.valueMin = 0
        chart.yValueAxis.valueMax = 100
        chart.yValueAxis.valueStep = 20
        chart.yValueAxis.labels.fontName = "Helvetica"
        chart.yValueAxis.labels.fontSize = 7.0
        chart.yValueAxis.labels.fillColor = muted
        d.add(chart)
        d.add(Line(0.8 * cm, 1.0 * cm + 0.95 * chart.height, 16.0 * cm, 1.0 * cm + 0.95 * chart.height, strokeColor=brand, strokeWidth=0.6))
        return d

    def _mode_pie(parts: list[tuple[str, int]]):
        w = 8.2 * cm
        h = 6.6 * cm
        d = _card_frame(w, h, "Mode split", "")
        if not parts:
            d.add(String(8, h / 2, "No mode data", fontName="Helvetica", fontSize=8.5, fillColor=muted))
            return d
        p = Pie()
        p.x = 0.6 * cm
        p.y = 0.95 * cm
        p.width = 4.6 * cm
        p.height = 4.6 * cm
        p.data = [int(v) for _, v in parts]
        p.labels = ["" for _ in parts]
        p.simpleLabels = 0
        p.sideLabels = 0
        p.slices.strokeWidth = 0.3
        p.slices.strokeColor = line
        p.slices[0].fillColor = brand
        if len(parts) > 1:
            p.slices[1].fillColor = accent
        if len(parts) > 2:
            p.slices[2].fillColor = violet
        d.add(p)
        legend_x = 5.55 * cm
        legend_y = 4.95 * cm
        palette = [brand, accent, violet]
        for idx, (k, v) in enumerate(parts[:3]):
            y = legend_y - idx * 0.8 * cm
            d.add(Rect(legend_x, y, 0.28 * cm, 0.28 * cm, fillColor=palette[idx], strokeColor=palette[idx], strokeWidth=0.4))
            d.add(String(legend_x + 0.36 * cm, y + 0.02 * cm, f"{k} ({v})", fontName="Helvetica", fontSize=7.0, fillColor=muted))
        return d

    def _model_pie(parts: list[tuple[str, int]]):
        w = 8.2 * cm
        h = 6.6 * cm
        d = _card_frame(w, h, "Model split", "")
        if not parts:
            d.add(String(8, h / 2, "No model data", fontName="Helvetica", fontSize=8.5, fillColor=muted))
            return d
        p = Pie()
        p.x = 0.6 * cm
        p.y = 0.95 * cm
        p.width = 4.6 * cm
        p.height = 4.6 * cm
        p.data = [int(v) for _, v in parts]
        p.labels = ["" for _ in parts]
        p.simpleLabels = 0
        p.sideLabels = 0
        p.slices.strokeWidth = 0.3
        p.slices.strokeColor = line
        p.slices[0].fillColor = accent
        if len(parts) > 1:
            p.slices[1].fillColor = brand
        if len(parts) > 2:
            p.slices[2].fillColor = amber
        d.add(p)
        legend_x = 5.55 * cm
        legend_y = 4.95 * cm
        palette = [accent, brand, amber]
        for idx, (k, v) in enumerate(parts[:3]):
            y = legend_y - idx * 0.8 * cm
            d.add(Rect(legend_x, y, 0.28 * cm, 0.28 * cm, fillColor=palette[idx], strokeColor=palette[idx], strokeWidth=0.4))
            d.add(String(legend_x + 0.36 * cm, y + 0.02 * cm, f"{k} ({v})", fontName="Helvetica", fontSize=7.0, fillColor=muted))
        return d

    def _thumb_flowable(image_bytes: bytes | None, label: str):
        w = 4.2 * cm
        h = 3.2 * cm
        if image_bytes:
            try:
                img = RLImage(BytesIO(image_bytes))
                img._restrictSize(w, h)
                img.hAlign = "LEFT"
                return img
            except Exception:
                pass
        placeholder = Drawing(w, h)
        placeholder.add(Rect(0, 0, w, h, fillColor=colors.HexColor("#eef2ff"), strokeColor=line, strokeWidth=0.6))
        placeholder.add(String(w / 2, h / 2 + 2, "No Image", fontName="Helvetica-Bold", fontSize=8, fillColor=muted, textAnchor="middle"))
        placeholder.add(String(w / 2, h / 2 - 9, label if len(label) <= 20 else f"{label[:18]}..", fontName="Helvetica", fontSize=7, fillColor=muted, textAnchor="middle"))
        return placeholder

    story: list = []

    name = (getattr(user, "full_name", None) or getattr(user, "username", None) or "User").strip()
    period = f"{_fmt_short(first_ts)} to {_fmt_short(last_ts)}" if rows else "-"
    intro = (
        f"<b>{name}</b>, this report summarizes <b>{included}</b> recent predictions "
        f"(out of <b>{total}</b> total) across period <b>{period}</b>."
    )

    story.append(Paragraph("Executive Snapshot", styles["RptTitle"]))
    story.append(Paragraph(intro, styles["RptBody"]))
    story.append(Spacer(1, 10))

    corrected_rate = (corrected_count / included * 100.0) if included else 0.0
    image_rate = (with_image_count / included * 100.0) if included else 0.0
    high_rate = (high_conf_count / included * 100.0) if included else 0.0

    cards = [
        _metric_card("Included predictions", str(included), f"of {total} total account records", brand),
        _metric_card("Average confidence", f"{avg_conf*100:.1f}%", f"median {med_conf*100:.1f}%", accent),
        _metric_card("Most frequent label", fav_label, f"{label_counts.get(fav_label, 0)} occurrences", violet),
        _metric_card("High confidence share", f"{high_rate:.1f}%", f"{high_conf_count} at >= 95%", brand),
        _metric_card("Corrections", f"{corrected_count}", f"{corrected_rate:.1f}% corrected rate", amber),
        _metric_card("Image coverage", f"{image_rate:.1f}%", f"{with_image_count} records include images", accent),
    ]
    cards_table = Table(
        [cards[0:3], cards[3:6]],
        colWidths=[5.35 * cm, 5.35 * cm, 5.35 * cm],
        hAlign="LEFT",
    )
    cards_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(cards_table)

    model_rows = [["Model", "Count", "Share", "Avg confidence", "High confidence"]]
    for key, count in sorted(model_counts.items(), key=lambda kv: kv[1], reverse=True):
        model_name = "101x101" if key == "101" else ("23x23" if key == "23" else key or "-")
        confs = model_conf.get(key, [])
        avg_m = (sum(confs) / len(confs)) if confs else 0.0
        high_m = sum(1 for c in confs if c >= 0.95)
        share = (count / included * 100.0) if included else 0.0
        model_rows.append([model_name, str(count), f"{share:.1f}%", f"{avg_m*100:.1f}%", str(high_m)])
    if len(model_rows) == 1:
        model_rows.append(["-", "0", "0.0%", "0.0%", "0"])

    mode_rows = [["Mode", "Count", "Share", "Avg confidence", "Notes"]]
    for mode_key in ["single", "fridge"]:
        bucket = single_rows if mode_key == "single" else fridge_rows
        count = len(bucket)
        share = (count / included * 100.0) if included else 0.0
        avg_mode = (sum(r.confidence for r in bucket) / count) if count else 0.0
        notes = "Smart Fridge tiles" if mode_key == "fridge" else "Standard image runs"
        mode_rows.append(["Smart Fridge" if mode_key == "fridge" else "Single", str(count), f"{share:.1f}%", f"{avg_mode*100:.1f}%", notes])

    story.append(_summary_table("Model Breakdown", model_rows, [3.1 * cm, 2.0 * cm, 2.1 * cm, 3.0 * cm, 2.9 * cm]))
    story.append(Spacer(1, 5))
    story.append(_summary_table("Mode Breakdown", mode_rows, [2.7 * cm, 1.8 * cm, 2.0 * cm, 2.7 * cm, 3.9 * cm]))

    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            f"Activity days: <b>{days_active}</b> | Low-confidence results (&lt;70%): <b>{low_conf_count}</b> | "
            f"Compare disagreements: <b>{compare_disagree}</b> out of <b>{compare_count}</b> compared predictions.",
            styles["RptTiny"],
        )
    )

    if rows:
        story.append(PageBreak())
        story.append(Paragraph("Visual Insights", styles["RptSection"]))
        story.append(Paragraph("Simplified charts with clear labels and spacing for faster reading.", styles["RptBody"]))
        story.append(Spacer(1, 8))

        top_labels = label_counts.most_common(6)
        story.append(_top_labels_chart(top_labels))
        story.append(Spacer(1, 8))
        story.append(_confidence_dist_chart())
        story.append(Spacer(1, 8))

        recent_n = min(48, included)
        trend_rows = list(reversed(rows[:recent_n]))
        trend_series = [r.confidence * 100.0 for r in trend_rows]
        story.append(_confidence_trend_chart(trend_series))
        story.append(Spacer(1, 8))

        model_parts = []
        for k, v in model_counts.most_common(3):
            mk = "101x101" if k == "101" else ("23x23" if k == "23" else str(k))
            model_parts.append((mk, int(v)))
        mode_parts = []
        for k, v in mode_counts.most_common(3):
            mode_parts.append(("Smart Fridge" if k == "fridge" else "Single", int(v)))

        pie_grid = Table(
            [[_model_pie(model_parts), _mode_pie(mode_parts)]],
            colWidths=[8.35 * cm, 8.35 * cm],
            hAlign="LEFT",
        )
        pie_grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(pie_grid)

    story.append(PageBreak())
    story.append(Paragraph("Prediction Highlights", styles["RptSection"]))
    story.append(
        Paragraph(
            "Recent predictions with image previews, confidence, correction status, and top alternatives.",
            styles["RptBody"],
        )
    )
    story.append(Spacer(1, 8))

    highlights = rows[:6]
    if not highlights:
        story.append(Paragraph("No predictions found for this account yet.", styles["RptBody"]))
    else:
        for idx, r in enumerate(highlights, start=1):
            mode_name = "Smart Fridge" if r.mode == "fridge" else "Single"
            if r.mode == "fridge" and r.tile_index and r.tile_total:
                mode_name = f"{mode_name} ({r.tile_index}/{r.tile_total})"
            model_name = "101x101" if r.model == "101" else ("23x23" if r.model == "23" else r.model or "-")
            correction_text = (
                f"Corrected from {r.original_label}" if r.is_corrected and r.original_label and r.original_label != r.label else "No correction"
            )
            top_text = ", ".join([f"{lbl} {score*100:.1f}%" for lbl, score in r.top_k[:3]]) or "Top alternatives unavailable"
            info = Paragraph(
                "<b>"
                + f"{idx}. {r.label}"
                + "</b><br/>"
                + f"Confidence: <b>{r.confidence*100:.1f}%</b> | Model: <b>{model_name}</b> | Mode: <b>{mode_name}</b><br/>"
                + f"Time: {_fmt_dt(r.ts)}<br/>"
                + f"Status: {correction_text}<br/>"
                + f"Top alternatives: {top_text}",
                styles["RptTiny"],
            )
            card = Table(
                [[_thumb_flowable(r.image_bytes, r.label), info]],
                colWidths=[4.4 * cm, 11.6 * cm],
                hAlign="LEFT",
            )
            card.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                        ("BOX", (0, 0), (-1, -1), 0.75, line),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 8),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ]
                )
            )
            story.append(KeepTogether([card, Spacer(1, 7)]))

    story.append(Spacer(1, 6))
    story.append(Paragraph("Per-label quality", styles["RptSection"]))
    quality_table_data = [["Label", "Count", "Avg conf", "Corrected", ">=95% conf"]]
    for label, count, avg_l, corr_l, high_l in label_quality_rows[:10]:
        quality_table_data.append([label, str(count), f"{avg_l*100:.1f}%", str(corr_l), str(high_l)])
    if len(quality_table_data) == 1:
        quality_table_data.append(["-", "0", "0.0%", "0", "0"])
    quality_table = Table(quality_table_data, colWidths=[6.2 * cm, 2.0 * cm, 2.5 * cm, 2.3 * cm, 2.4 * cm], repeatRows=1)
    quality_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ink),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.3),
                ("GRID", (0, 0), (-1, -1), 0.35, line),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fbff")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(quality_table)

    story.append(PageBreak())
    story.append(Paragraph("Detailed Prediction Log", styles["RptSection"]))
    story.append(
        Paragraph(
            "Chronological details for included records. Smart Fridge entries show tile position when available.",
            styles["RptBody"],
        )
    )
    story.append(Spacer(1, 8))
    if not rows:
        story.append(Paragraph("No predictions available.", styles["RptBody"]))
    else:
        history_rows = [["Timestamp (UTC)", "Label", "Mode", "Model", "Confidence", "Corrected", "Image"]]
        for r in rows:
            mode_label = "Smart Fridge" if r.mode == "fridge" else "Single"
            if r.mode == "fridge" and r.tile_index and r.tile_total:
                mode_label = f"{mode_label} {r.tile_index}/{r.tile_total}"
            model_label = "101x101" if r.model == "101" else ("23x23" if r.model == "23" else r.model or "-")
            history_rows.append(
                [
                    _fmt_dt(r.ts),
                    r.label,
                    mode_label,
                    model_label,
                    f"{r.confidence*100:.1f}%",
                    "Yes" if r.is_corrected else "-",
                    "Yes" if r.image_bytes else "-",
                ]
            )

        history_tbl = Table(
            history_rows,
            colWidths=[4.05 * cm, 4.1 * cm, 2.9 * cm, 1.9 * cm, 1.8 * cm, 1.6 * cm, 1.2 * cm],
            repeatRows=1,
        )
        history_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), ink),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 7.9),
                    ("GRID", (0, 0), (-1, -1), 0.3, line),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fbff")]),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                    ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ]
            )
        )
        story.append(history_tbl)
        story.append(Spacer(1, 8))
        story.append(
            Paragraph(
                "Note: This report is generated from the most recent records provided to the generator. "
                "Older data may miss some metadata fields (mode, tiles, top alternatives).",
                styles["RptTiny"],
            )
        )

    doc.build(story, onFirstPage=_page_decor, onLaterPages=_page_decor)
    return buffer.getvalue()

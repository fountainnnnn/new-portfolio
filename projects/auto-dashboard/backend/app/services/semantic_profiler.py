"""Rule-based semantic classification for CSV columns.

The profiler should make the cheap deterministic calls before the LLM is asked
to do BI judgment. These rules intentionally distinguish business quantities
from IDs, rates from additive metrics, and period fields from ordinary numbers.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import pandas as pd


@dataclass
class SemanticAnnotation:
    role: str | None = None
    semantic_type: str | None = None
    business_meaning: str | None = None
    default_aggregation: str | None = None
    aliases: list[str] | None = None
    confidence: float = 0.0


ID_TERMS = {
    "id",
    "uuid",
    "guid",
    "code",
    "key",
    "ref",
    "reference",
    "serial",
    "identifier",
}
METRIC_TERMS = {
    "sales",
    "revenue",
    "profit",
    "cost",
    "price",
    "amount",
    "quantity",
    "qty",
    "count",
    "total",
    "students",
    "users",
    "customers",
    "applications",
    "teachers",
    "employees",
    "orders",
    "units",
    "volume",
    "spend",
    "income",
    "expense",
    "salary",
    "visits",
    "clicks",
    "impressions",
    "marks",
}
AVERAGE_METRIC_TERMS = {"score", "rating", "satisfaction", "nps", "index"}
RATE_TERMS = {
    "rate",
    "percent",
    "percentage",
    "ratio",
    "margin",
    "conversion",
    "churn",
    "ctr",
    "cvr",
    "accuracy",
    "precision",
    "recall",
    "f1",
    "average",
    "avg",
    "discount",
}
TIME_TERMS = {
    "date",
    "datetime",
    "timestamp",
    "time",
    "month",
    "year",
    "quarter",
    "week",
    "day",
    "period",
    "fiscal_year",
    "financial_year",
}
DIMENSION_TERMS = {
    "region",
    "country",
    "state",
    "province",
    "city",
    "product",
    "category",
    "subcategory",
    "department",
    "institution",
    "qualification",
    "segment",
    "channel",
    "status",
    "plan",
    "plan_type",
    "type",
    "class",
    "group",
    "brand",
    "supplier",
}
TEXT_TERMS = {"comment", "comments", "description", "message", "note", "notes", "address", "email", "name"}


def _normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(name).strip().lower()).strip("_")


def _name_tokens(name: str) -> list[str]:
    return [token for token in _normalize(name).split("_") if token]


def _contains_compound(normalized: str, term: str) -> bool:
    return "_" in term and term in normalized


def _has_term(tokens: list[str], normalized: str, terms: set[str]) -> bool:
    return any(term in tokens or _contains_compound(normalized, term) for term in terms)


def classify_column(
    name: str,
    series: pd.Series,
    *,
    is_numeric: bool,
    is_datetime: bool,
    unique_count: int,
    row_count: int,
) -> SemanticAnnotation:
    """Annotate a single column from its name + sample data."""

    normalized = _normalize(name)
    tokens = _name_tokens(name)

    if pd.api.types.is_bool_dtype(series) or _looks_boolean(series):
        return SemanticAnnotation(
            role="boolean",
            semantic_type="boolean_flag",
            business_meaning="Boolean flag",
            default_aggregation="sum",
            aliases=["flag"],
            confidence=0.85,
        )

    if is_datetime or _looks_time_field(tokens, normalized, series, is_numeric):
        return SemanticAnnotation(
            role="time",
            semantic_type=_time_semantic_type(tokens, normalized),
            business_meaning="Date / time axis",
            default_aggregation="none",
            aliases=["date", "time", "period"],
            confidence=0.92 if is_datetime else 0.75,
        )

    if is_numeric and _looks_rate_metric(tokens, normalized, series):
        return SemanticAnnotation(
            role="rate_metric",
            semantic_type="rate_metric",
            business_meaning="Rate, percentage, score, or ratio metric",
            default_aggregation="mean",
            aliases=["rate", "ratio", "score"],
            confidence=0.9,
        )

    if is_numeric and _looks_metric(tokens, normalized):
        aggregation = "mean" if _has_term(tokens, normalized, AVERAGE_METRIC_TERMS) else "sum"
        return SemanticAnnotation(
            role="metric",
            semantic_type="business_metric",
            business_meaning="Business quantity metric",
            default_aggregation=aggregation,
            aliases=["metric", "measure"],
            confidence=0.86,
        )

    if _looks_identifier(tokens, normalized, series, is_numeric, unique_count, row_count):
        return SemanticAnnotation(
            role="identifier",
            semantic_type="identifier",
            business_meaning="Identifier or code",
            default_aggregation="unique_count",
            aliases=["id", "code"],
            confidence=0.88,
        )

    if _looks_free_text(name, series, unique_count, row_count):
        return SemanticAnnotation(
            role="text",
            semantic_type="free_text",
            business_meaning="Free-form text",
            default_aggregation="none",
            aliases=["text"],
            confidence=0.76,
        )

    if is_numeric:
        # Numeric uniqueness alone is not enough to call something an ID. If it
        # behaves like a quantity and the name is not ID-like, keep it usable.
        return SemanticAnnotation(
            role="metric",
            semantic_type="numeric_metric",
            business_meaning="Numeric business metric",
            default_aggregation="sum",
            aliases=["metric"],
            confidence=0.56,
        )

    if _has_term(tokens, normalized, DIMENSION_TERMS) or _looks_categorical(series, unique_count, row_count):
        return SemanticAnnotation(
            role="dimension",
            semantic_type="dimension",
            business_meaning="Categorical dimension",
            default_aggregation="none",
            aliases=["category", "segment"],
            confidence=0.64,
        )

    return SemanticAnnotation(
        role="text",
        semantic_type="free_text",
        business_meaning="Free-form text",
        default_aggregation="none",
        aliases=["text"],
        confidence=0.45,
    )


def _looks_boolean(series: pd.Series) -> bool:
    sample = series.dropna()
    if sample.empty:
        return False
    values = {str(v).strip().lower() for v in sample.unique()[:6]}
    boolean_sets = (
        {"0", "1"},
        {"true", "false"},
        {"yes", "no"},
        {"y", "n"},
        {"t", "f"},
    )
    return any(values <= allowed for allowed in boolean_sets)


def _looks_time_field(tokens: list[str], normalized: str, series: pd.Series, is_numeric: bool) -> bool:
    if not _has_term(tokens, normalized, TIME_TERMS):
        return False
    if is_numeric:
        if "year" in tokens or normalized.endswith("_year"):
            return _looks_year_values(series)
        if "month" in tokens:
            return _looks_month_values(series) or _looks_year_month_values(series)
        if "quarter" in tokens:
            return _looks_quarter_values(series)
        return False
    return _looks_dateish(series) or _looks_period_values(series)


def _time_semantic_type(tokens: list[str], normalized: str) -> str:
    if "year" in tokens or normalized.endswith("_year"):
        return "year"
    if "quarter" in tokens:
        return "quarter"
    if "month" in tokens:
        return "month"
    if "week" in tokens:
        return "week"
    return "date"


def _looks_dateish(series: pd.Series) -> bool:
    sample = series.dropna().astype(str).head(30)
    if sample.empty:
        return False
    parsed = pd.to_datetime(sample, errors="coerce")
    if parsed.notna().mean() >= 0.7:
        return True
    pattern = re.compile(r"\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?")
    return bool(pattern.search(" ".join(sample.tolist())))


def _looks_period_values(series: pd.Series) -> bool:
    sample = series.dropna().astype(str).str.lower().head(30)
    if sample.empty:
        return False
    month_names = r"jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
    return bool(sample.str.contains(month_names, regex=True).mean() >= 0.5)


def _looks_year_values(series: pd.Series) -> bool:
    values = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    if values.empty:
        return False
    rounded = values.round()
    integerish = ((values - rounded).abs() < 0.001).mean() >= 0.98
    return bool(integerish and rounded.between(1800, 2200).mean() >= 0.98)


def _looks_month_values(series: pd.Series) -> bool:
    values = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    if values.empty:
        return False
    rounded = values.round()
    integerish = ((values - rounded).abs() < 0.001).mean() >= 0.98
    return bool(integerish and rounded.between(1, 12).mean() >= 0.98)


def _looks_year_month_values(series: pd.Series) -> bool:
    sample = series.dropna().astype(str).head(30)
    return bool(not sample.empty and sample.str.match(r"^\d{4}[-/]\d{1,2}").mean() >= 0.7)


def _looks_quarter_values(series: pd.Series) -> bool:
    sample = series.dropna().astype(str).str.lower().head(30)
    if sample.empty:
        return False
    return bool(sample.str.match(r"^(q[1-4]|[1-4])$").mean() >= 0.7)


def _looks_rate_metric(tokens: list[str], normalized: str, series: pd.Series) -> bool:
    if _has_term(tokens, normalized, RATE_TERMS | AVERAGE_METRIC_TERMS):
        return True
    values = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    if values.empty:
        return False
    return bool(values.between(0, 1).mean() >= 0.95 and any(term in tokens for term in {"rate", "ratio", "pct"}))


def _looks_metric(tokens: list[str], normalized: str) -> bool:
    return _has_term(tokens, normalized, METRIC_TERMS | AVERAGE_METRIC_TERMS)


def _looks_identifier(
    tokens: list[str],
    normalized: str,
    series: pd.Series,
    is_numeric: bool,
    unique_count: int,
    row_count: int,
) -> bool:
    if _has_term(tokens, normalized, ID_TERMS):
        return True
    if tokens and tokens[-1] in {"number", "no"} and not _has_term(tokens, normalized, METRIC_TERMS):
        return True
    if "number" in tokens and "of" not in tokens and not _has_term(tokens, normalized, METRIC_TERMS):
        return True
    if not is_numeric:
        sample = series.dropna().astype(str).head(30)
        if not sample.empty and sample.str.match(r"^[A-Z]{2,}[-_]?\d{3,}$", case=False).mean() >= 0.6:
            return True
    if is_numeric and row_count > 0 and unique_count / row_count >= 0.95:
        values = pd.to_numeric(series.dropna(), errors="coerce").dropna().sort_values()
        if len(values) >= 4:
            diffs = values.diff().dropna()
            sequential = not diffs.empty and (diffs == diffs.iloc[0]).mean() >= 0.95 and abs(float(diffs.iloc[0])) == 1
            return bool(sequential and not _has_term(tokens, normalized, METRIC_TERMS | AVERAGE_METRIC_TERMS))
    return False


def _looks_free_text(name: str, series: pd.Series, unique_count: int, row_count: int) -> bool:
    normalized = _normalize(name)
    tokens = _name_tokens(name)
    if _has_term(tokens, normalized, TEXT_TERMS):
        return True
    sample = series.dropna().astype(str).head(100)
    if sample.empty:
        return False
    avg_length = float(sample.str.len().mean())
    unique_ratio = unique_count / max(row_count, 1)
    return bool(avg_length >= 45 or (avg_length >= 20 and unique_ratio >= 0.7))


def _looks_categorical(series: pd.Series, unique_count: int, row_count: int) -> bool:
    if row_count <= 0:
        return False
    if unique_count <= 1:
        return False
    return unique_count <= max(30, int(row_count * 0.4))

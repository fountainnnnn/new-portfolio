from __future__ import annotations

import io
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import ColumnProfile, DatasetProfile
from app.services.semantic_profiler import classify_column


DATE_NAME_MARKERS = ("date", "time", "month", "year", "day", "created", "updated")
METRIC_NAME_MARKERS = (
    "amount",
    "balance",
    "cost",
    "count",
    "margin",
    "metric",
    "price",
    "profit",
    "quantity",
    "revenue",
    "sales",
    "score",
    "spend",
    "total",
    "value",
    "students",
    "users",
    "customers",
    "applications",
    "teachers",
    "employees",
    "orders",
    "units",
    "volume",
    "clicks",
    "impressions",
    "visits",
)
RATE_NAME_MARKERS = (
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
    "score",
    "rating",
    "index",
    "average",
    "avg",
)


class CsvProfileError(ValueError):
    """Raised when an uploaded CSV cannot be profiled."""


def json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value) or np.isinf(value):
            return None
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value


class DataProfiler:
    def profile_csv(self, file_bytes: bytes, filename: str = "dataset.csv") -> tuple[pd.DataFrame, DatasetProfile]:
        if not filename.lower().endswith(".csv"):
            raise CsvProfileError("Please upload a CSV file.")
        if not file_bytes:
            raise CsvProfileError("The uploaded CSV is empty.")

        dataframe = self._read_csv(file_bytes)
        dataframe = self._clean_column_names(dataframe)

        if dataframe.empty or len(dataframe.columns) == 0:
            raise CsvProfileError("The CSV has no rows or columns to analyze.")

        dataframe = self._detect_and_convert_datetimes(dataframe)
        profile = self._build_profile(dataframe)
        return dataframe, profile

    def _read_csv(self, file_bytes: bytes) -> pd.DataFrame:
        try:
            return pd.read_csv(io.BytesIO(file_bytes), low_memory=False)
        except UnicodeDecodeError:
            try:
                return pd.read_csv(io.BytesIO(file_bytes), low_memory=False, encoding="latin-1")
            except Exception as exc:
                raise CsvProfileError("The CSV encoding could not be read.") from exc
        except pd.errors.EmptyDataError as exc:
            raise CsvProfileError("The uploaded CSV is empty.") from exc
        except pd.errors.ParserError as exc:
            raise CsvProfileError("The CSV could not be parsed. Check for malformed rows or delimiters.") from exc
        except Exception as exc:
            raise CsvProfileError("The CSV could not be read.") from exc

    def _clean_column_names(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        cleaned: list[str] = []
        seen: dict[str, int] = {}
        for index, column in enumerate(dataframe.columns):
            base = str(column).strip() or f"column_{index + 1}"
            count = seen.get(base, 0)
            seen[base] = count + 1
            cleaned.append(base if count == 0 else f"{base}_{count + 1}")

        dataframe = dataframe.copy()
        dataframe.columns = cleaned
        return dataframe

    def _detect_and_convert_datetimes(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        converted = dataframe.copy()
        for column in converted.columns:
            series = converted[column]
            if pd.api.types.is_datetime64_any_dtype(series):
                continue
            if pd.api.types.is_numeric_dtype(series):
                continue

            name_suggests_date = any(marker in column.lower() for marker in DATE_NAME_MARKERS)
            sample = series.dropna().astype(str).head(50)
            sample_suggests_date = sample.str.contains(r"[-/:]", regex=True).mean() >= 0.5 if len(sample) else False
            if not name_suggests_date and not sample_suggests_date:
                continue

            parsed = pd.to_datetime(series, errors="coerce")
            non_missing = int(series.notna().sum())
            if non_missing > 0 and (parsed.notna().sum() / non_missing) >= 0.75:
                converted[column] = parsed
        return converted

    def _build_profile(self, dataframe: pd.DataFrame) -> DatasetProfile:
        row_count = int(len(dataframe))
        column_names = [str(column) for column in dataframe.columns]
        dtypes = {column: str(dataframe[column].dtype) for column in column_names}
        missing_values = {column: int(dataframe[column].isna().sum()) for column in column_names}

        numeric_columns = [
            column for column in column_names if pd.api.types.is_numeric_dtype(dataframe[column])
        ]
        datetime_columns = [
            column for column in column_names if pd.api.types.is_datetime64_any_dtype(dataframe[column])
        ]
        raw_categorical_columns = [
            column for column in column_names if column not in numeric_columns and column not in datetime_columns
        ]

        column_profiles = [
            self._profile_column(dataframe, column, numeric_columns, datetime_columns)
            for column in column_names
        ]
        role_by_column = {column.name: column.role for column in column_profiles}
        metric_candidates = [
            column.name for column in column_profiles if column.role in {"metric", "measure"}
        ]
        rate_metric_candidates = [
            column.name for column in column_profiles if column.role == "rate_metric"
        ]
        dimension_candidates = [
            column.name for column in column_profiles if column.role in {"dimension", "geo"}
        ]
        time_candidates = [
            column.name for column in column_profiles if column.role in {"time", "datetime"}
        ]
        identifier_candidates = [
            column.name for column in column_profiles if column.role in {"identifier", "id"}
        ]
        categorical_columns = dimension_candidates + [
            column.name for column in column_profiles if column.role == "boolean"
        ]

        numeric_summaries = self._numeric_summaries(dataframe, numeric_columns)
        categorical_summaries = self._categorical_summaries(dataframe, raw_categorical_columns)
        data_quality = self._compute_data_quality(
            dataframe,
            numeric_columns=numeric_columns,
            categorical_columns=raw_categorical_columns,
            datetime_columns=datetime_columns,
            column_roles=role_by_column,
            numeric_summaries=numeric_summaries,
            categorical_summaries=categorical_summaries,
        )
        excluded_columns = self._excluded_columns(column_profiles, data_quality)
        possible_row_grain = self._infer_row_grain(time_candidates, dimension_candidates, identifier_candidates)

        profile = DatasetProfile(
            row_count=row_count,
            column_count=len(column_names),
            column_names=column_names,
            columns=column_profiles,
            dtypes=dtypes,
            missing_values=missing_values,
            numeric_columns=numeric_columns,
            categorical_columns=categorical_columns,
            datetime_columns=datetime_columns,
            possible_date_columns=time_candidates,
            possible_metric_columns=[*metric_candidates, *rate_metric_candidates],
            numeric_summaries=numeric_summaries,
            categorical_summaries=categorical_summaries,
            sample_rows=self._sample_rows(dataframe),
            data_quality=data_quality,
            metric_candidates=metric_candidates,
            rate_metric_candidates=rate_metric_candidates,
            dimension_candidates=dimension_candidates,
            time_candidates=time_candidates,
            identifier_candidates=identifier_candidates,
            excluded_columns=excluded_columns,
            top_correlations=data_quality.get("top_correlations", []),
            time_series=data_quality.get("time_series", []),
            possible_row_grain=possible_row_grain,
        )
        try:
            from app.services.bi_planner import generate_relationship_candidates

            profile.possible_relationships = generate_relationship_candidates(profile)
        except Exception:
            profile.possible_relationships = []
        return profile

    def _compute_data_quality(
        self,
        dataframe: pd.DataFrame,
        numeric_columns: list[str],
        categorical_columns: list[str],
        datetime_columns: list[str],
        column_roles: dict[str, str | None],
        numeric_summaries: dict[str, dict[str, Any]],
        categorical_summaries: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """Build hints the AI planner uses to make smarter chart choices.

        Includes coefficient of variation, top-share imbalance, top numeric correlations,
        time-series spans, and constant/near-constant column flags.
        """
        row_count = max(int(len(dataframe)), 1)
        constant: list[str] = []
        near_constant: list[str] = []

        # Enrich numeric summaries with CV, skewness flag, and unique count.
        for column in numeric_columns:
            series = pd.to_numeric(dataframe[column], errors="coerce").dropna()
            unique_count = int(series.nunique())
            summary = numeric_summaries.setdefault(column, {})
            summary["unique_count"] = unique_count
            summary["non_null_ratio"] = round(float(len(series) / row_count), 4)
            mean = float(series.mean()) if len(series) else 0.0
            std = float(series.std()) if len(series) else 0.0
            cv = float(std / abs(mean)) if mean and not np.isnan(mean) and not np.isnan(std) else None
            summary["cv"] = round(cv, 4) if cv is not None and not np.isnan(cv) else None
            try:
                skew_value = float(series.skew()) if len(series) > 2 else 0.0
                if np.isnan(skew_value):
                    skew_value = 0.0
            except Exception:  # noqa: BLE001
                skew_value = 0.0
            summary["skew"] = round(skew_value, 3)
            role = column_roles.get(column)
            if unique_count <= 1:
                constant.append(column)
            elif role != "rate_metric" and ((cv is not None and cv < 0.05) or unique_count <= 2):
                near_constant.append(column)

        # Enrich categorical summaries with top_share + effective cardinality.
        for column in categorical_columns:
            series = dataframe[column].dropna().astype(str)
            unique_count = int(series.nunique())
            summary = categorical_summaries.setdefault(column, {})
            summary["unique_count"] = unique_count
            summary["non_null_ratio"] = round(float(len(series) / row_count), 4)
            counts = series.value_counts()
            top_count = int(counts.iloc[0]) if not counts.empty else 0
            top_share = round(float(top_count / max(len(series), 1)), 4) if len(series) else 0.0
            summary["top_share"] = top_share
            # Effective unique = categories that appear in >= 1% of rows.
            threshold = max(1, int(len(series) * 0.01))
            summary["effective_unique"] = int((counts >= threshold).sum())
            if unique_count <= 1:
                constant.append(column)
            elif top_share >= 0.97:
                near_constant.append(column)

        high_cardinality_dimensions: list[str] = []
        mostly_missing_columns: list[str] = []
        weak_variation_numeric_columns: list[str] = []

        for column in dataframe.columns:
            missing_ratio = float(dataframe[column].isna().mean())
            if missing_ratio >= 0.7:
                mostly_missing_columns.append(str(column))

        for column in categorical_columns:
            role = column_roles.get(column)
            summary = categorical_summaries.get(column, {})
            unique_count = int(summary.get("unique_count") or 0)
            if role == "dimension" and unique_count > min(50, max(15, row_count // 2)):
                high_cardinality_dimensions.append(column)

        for column in numeric_columns:
            summary = numeric_summaries.get(column, {})
            role = column_roles.get(column)
            cv = summary.get("cv")
            if role in {"metric", "measure"} and cv is not None and float(cv) < 0.05:
                weak_variation_numeric_columns.append(column)

        valid_correlation_columns = [
            column for column in numeric_columns if column_roles.get(column) in {"metric", "measure", "rate_metric"}
        ]

        # Top numeric correlations (|r| >= 0.3).
        top_correlations: list[dict[str, Any]] = []
        if len(valid_correlation_columns) >= 2:
            try:
                numeric_frame = dataframe[valid_correlation_columns].apply(pd.to_numeric, errors="coerce")
                corr = numeric_frame.corr(numeric_only=True)
                pairs: list[tuple[str, str, float]] = []
                cols = list(corr.columns)
                for i, col_a in enumerate(cols):
                    for col_b in cols[i + 1 :]:
                        value = corr.at[col_a, col_b]
                        if pd.isna(value):
                            continue
                        if abs(float(value)) >= 0.3:
                            pairs.append((col_a, col_b, float(value)))
                pairs.sort(key=lambda triple: abs(triple[2]), reverse=True)
                top_correlations = [
                    {"a": a, "b": b, "r": round(r, 3)} for a, b, r in pairs[:8]
                ]
            except Exception:  # noqa: BLE001
                top_correlations = []

        # Time-series hints.
        time_series: list[dict[str, Any]] = []
        for column, role in column_roles.items():
            if role not in {"time", "datetime"}:
                continue
            if column in datetime_columns:
                series = pd.to_datetime(dataframe[column], errors="coerce").dropna()
                if series.empty:
                    continue
                unique_periods = int(series.dt.normalize().nunique())
                time_series.append(
                    {
                        "column": column,
                        "min": json_safe(series.min()),
                        "max": json_safe(series.max()),
                        "unique_count": unique_periods,
                        "n_distinct_days": unique_periods,
                        "span_days": int((series.max() - series.min()).days) if len(series) > 1 else 0,
                        "detected_granularity": self._detect_time_granularity(column, series),
                    }
                )
                continue
            series = dataframe[column].dropna()
            if series.empty:
                continue
            time_series.append(
                {
                    "column": column,
                    "min": json_safe(series.min()),
                    "max": json_safe(series.max()),
                    "unique_count": int(series.nunique()),
                    "n_distinct_days": int(series.nunique()),
                    "span_days": 0,
                    "detected_granularity": self._detect_named_granularity(column),
                }
            )

        # ID-like columns need semantic evidence; high uniqueness alone is not enough.
        id_like: list[str] = []
        for column in dataframe.columns:
            role = column_roles.get(str(column))
            if role in {"identifier", "id"}:
                id_like.append(str(column))

        return {
            "constant_columns": sorted(set(constant)),
            "near_constant_columns": sorted(set(near_constant)),
            "id_like_columns": id_like,
            "high_cardinality_dimensions": sorted(set(high_cardinality_dimensions)),
            "mostly_missing_columns": sorted(set(mostly_missing_columns)),
            "weak_variation_numeric_columns": sorted(set(weak_variation_numeric_columns)),
            "top_correlations": top_correlations,
            "time_series": time_series,
        }

    def _profile_column(
        self,
        dataframe: pd.DataFrame,
        column: str,
        numeric_columns: list[str],
        datetime_columns: list[str],
    ) -> ColumnProfile:
        series = dataframe[column]
        is_numeric = column in numeric_columns
        is_datetime = column in datetime_columns
        if is_numeric:
            inferred_type = "numeric"
        elif is_datetime:
            inferred_type = "datetime"
        else:
            inferred_type = "categorical" if series.nunique(dropna=True) <= max(50, len(series) * 0.5) else "text"

        examples = [json_safe(value) for value in series.dropna().head(5).tolist()]
        unique_count = int(series.nunique(dropna=True))
        annotation = classify_column(
            column,
            series,
            is_numeric=is_numeric,
            is_datetime=is_datetime,
            unique_count=unique_count,
            row_count=int(len(series)),
        )
        return ColumnProfile(
            name=column,
            dtype=str(series.dtype),
            inferred_type=inferred_type,
            missing_count=int(series.isna().sum()),
            missing_percent=round(float(series.isna().mean() * 100), 2),
            unique_count=unique_count,
            examples=examples,
            role=annotation.role,
            semantic_type=annotation.semantic_type,
            business_meaning=annotation.business_meaning,
            default_aggregation=annotation.default_aggregation,
            aliases=annotation.aliases or [],
            confidence=annotation.confidence,
        )

    def _numeric_summaries(self, dataframe: pd.DataFrame, numeric_columns: list[str]) -> dict[str, dict[str, Any]]:
        summaries: dict[str, dict[str, Any]] = {}
        for column in numeric_columns:
            description = dataframe[column].describe(percentiles=[0.25, 0.5, 0.75])
            summaries[column] = {
                "count": json_safe(description.get("count")),
                "mean": json_safe(description.get("mean")),
                "std": json_safe(description.get("std")),
                "min": json_safe(description.get("min")),
                "p25": json_safe(description.get("25%")),
                "median": json_safe(description.get("50%")),
                "p75": json_safe(description.get("75%")),
                "max": json_safe(description.get("max")),
            }
        return summaries

    def _categorical_summaries(
        self,
        dataframe: pd.DataFrame,
        categorical_columns: list[str],
    ) -> dict[str, dict[str, Any]]:
        summaries: dict[str, dict[str, Any]] = {}
        for column in categorical_columns:
            counts = dataframe[column].dropna().astype(str).value_counts().head(10)
            summaries[column] = {
                "unique_count": int(dataframe[column].nunique(dropna=True)),
                "top_values": [
                    {"value": json_safe(index), "count": int(count)}
                    for index, count in counts.items()
                ],
            }
        return summaries

    def _sample_rows(self, dataframe: pd.DataFrame) -> list[dict[str, Any]]:
        sample = dataframe.head(5).replace({np.nan: None})
        return [
            {column: json_safe(value) for column, value in row.items()}
            for row in sample.to_dict(orient="records")
        ]

    def _detect_metric_columns(self, dataframe: pd.DataFrame, numeric_columns: list[str]) -> list[str]:
        if not numeric_columns:
            return []

        scored: list[tuple[int, str]] = []
        row_count = max(len(dataframe), 1)
        for column in numeric_columns:
            lower = column.lower()
            if any(marker in lower for marker in DATE_NAME_MARKERS) or self._looks_year_like(dataframe[column]):
                continue
            unique_ratio = dataframe[column].nunique(dropna=True) / row_count
            score = 0
            if any(marker in lower for marker in METRIC_NAME_MARKERS):
                score += 3
            if "id" in lower or unique_ratio > 0.95:
                score -= 2
            if dataframe[column].min(skipna=True) >= 0:
                score += 1
            scored.append((score, column))

        return [column for _, column in sorted(scored, reverse=True)[:6]]

    @staticmethod
    def _looks_year_like(series: pd.Series) -> bool:
        values = pd.to_numeric(series.dropna(), errors="coerce").dropna()
        if values.empty:
            return False
        rounded = values.round()
        integerish = ((values - rounded).abs() < 0.001).mean() >= 0.98
        if not integerish:
            return False
        within_year_range = rounded.between(1800, 2200).mean() >= 0.98
        return bool(within_year_range and rounded.nunique() >= 2)

    def _excluded_columns(self, columns: list[ColumnProfile], data_quality: dict[str, Any]) -> list[str]:
        excluded = {
            column.name
            for column in columns
            if column.role in {"identifier", "id", "text", "excluded"}
        }
        for key in (
            "constant_columns",
            "near_constant_columns",
            "mostly_missing_columns",
            "high_cardinality_dimensions",
            "weak_variation_numeric_columns",
        ):
            excluded.update(str(column) for column in data_quality.get(key, []))
        return sorted(excluded)

    def _infer_row_grain(
        self,
        time_candidates: list[str],
        dimension_candidates: list[str],
        identifier_candidates: list[str],
    ) -> str:
        if time_candidates and dimension_candidates:
            granularity = self._detect_named_granularity(time_candidates[0])
            period = {
                "day": "daily",
                "week": "weekly",
                "month": "monthly",
                "quarter": "quarterly",
                "year": "yearly",
            }.get(granularity, "periodic")
            dimensions = self._join_words([column.replace("_", " ") for column in dimension_candidates[:4]])
            return f"one {period} record per {dimensions}"
        if identifier_candidates:
            primary_id = identifier_candidates[0].replace("_", " ")
            return f"one record per {primary_id}"
        if dimension_candidates:
            dimensions = self._join_words([column.replace("_", " ") for column in dimension_candidates[:4]])
            return f"one record per observed combination of {dimensions}"
        return "one record per observed row in the uploaded dataset"

    @staticmethod
    def _join_words(values: list[str]) -> str:
        if not values:
            return "available dimensions"
        if len(values) == 1:
            return values[0]
        return f"{', '.join(values[:-1])}, and {values[-1]}"

    def _detect_time_granularity(self, column: str, series: pd.Series) -> str:
        named = self._detect_named_granularity(column)
        if named != "unknown":
            return named
        if series.empty:
            return "unknown"
        normalized = series.dt.normalize().sort_values().drop_duplicates()
        if len(normalized) < 2:
            return "unknown"
        deltas = normalized.diff().dropna().dt.days
        median_days = float(deltas.median()) if not deltas.empty else 0
        if median_days <= 1.5:
            return "day"
        if median_days <= 8:
            return "week"
        if median_days <= 32:
            return "month"
        if median_days <= 100:
            return "quarter"
        return "year"

    @staticmethod
    def _detect_named_granularity(column: str) -> str:
        lower = column.lower()
        if "quarter" in lower:
            return "quarter"
        if "month" in lower:
            return "month"
        if "week" in lower:
            return "week"
        if "year" in lower:
            return "year"
        if "date" in lower or "day" in lower or "time" in lower:
            return "day"
        return "unknown"

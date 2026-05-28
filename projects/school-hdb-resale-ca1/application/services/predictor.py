from __future__ import annotations

import base64
import pickle
import warnings
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional

import matplotlib
import numpy as np
import pandas as pd
import shap
import joblib
from flask import current_app
import threading

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402  pylint: disable=wrong-import-position


class ModelPackageError(RuntimeError):
    """Raised when the saved model bundle cannot be loaded."""


class PredictionError(ValueError):
    """Raised when incoming data cannot produce a prediction."""


def parse_remaining_lease(lease_str: Optional[str]) -> float:
    """Convert a 'NN years MM months' string into total months."""
    if lease_str is None or (isinstance(lease_str, float) and np.isnan(lease_str)):
        return float("nan")

    try:
        parts = str(lease_str).lower().split()
        years = 0
        months = 0

        for idx, token in enumerate(parts):
            if token in {"years", "year"}:
                years = int(parts[idx - 1])
            elif token in {"months", "month"}:
                months = int(parts[idx - 1])

        return float(years * 12 + months)
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise PredictionError(f"Unable to parse remaining lease value: {lease_str!r}") from exc


def extract_storey_midpoint(storey_range: Optional[str]) -> float:
    """Return the midpoint value from a 'XX TO YY' storey string."""
    if storey_range is None or (isinstance(storey_range, float) and np.isnan(storey_range)):
        raise PredictionError("Storey range is required.")

    try:
        lower, upper = str(storey_range).split(" TO ")
        return (int(lower) + int(upper)) / 2.0
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise PredictionError(f"Invalid storey range format: {storey_range!r}") from exc


class _ModelUnpickler(pickle.Unpickler):
    """Custom unpickler that maps helper functions back to this module."""

    def find_class(self, module: str, name: str):
        if module == "__main__":
            if name == "parse_remaining_lease":
                return parse_remaining_lease
            if name == "extract_storey_midpoint":
                return extract_storey_midpoint
        return super().find_class(module, name)


@dataclass(frozen=True)
class PredictionMetadata:
    towns: List[str]
    flat_types: List[str]
    flat_models: List[str]
    storey_ranges: List[str]
    lease_commence_min: int
    lease_commence_max: int
    floor_area_min: float
    floor_area_max: float


@dataclass
class PreparedFeatures:
    encoded: pd.DataFrame
    scaled: pd.DataFrame
    friendly_labels: List[str]
    derived: Dict[str, float]
    raw_input: Dict[str, str]


def _resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    project_root = Path(current_app.root_path).parent
    return (project_root / path).resolve()


@lru_cache(maxsize=1)
def _load_model_package(model_path: str) -> Mapping:
    path = _resolve_path(model_path)
    if not path.exists():
        raise ModelPackageError(f"Model file not found at {path}")

    with path.open("rb") as handle:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=UserWarning)
            return _ModelUnpickler(handle).load()


@lru_cache(maxsize=1)
def _load_dataset_metadata(dataset_path: str) -> PredictionMetadata:
    path = _resolve_path(dataset_path)
    if not path.exists():
        raise ModelPackageError(f"Training dataset not found at {path}")

    df = pd.read_csv(
        path,
        usecols=["storey_range", "lease_commence_date", "floor_area_sqm", "town"],
    ).dropna(subset=["storey_range", "lease_commence_date", "floor_area_sqm"])

    def _storey_key(value: str) -> int:
        try:
            return int(str(value).split(" TO ")[0])
        except Exception:  # pragma: no cover - defensive fallback
            return 0

    storey_ranges = sorted(df["storey_range"].unique().tolist(), key=_storey_key)
    lease_years = df["lease_commence_date"].astype(int)
    floor_area = df["floor_area_sqm"].astype(float)

    package = get_model_package()
    label_encoders = package["label_encoders"]

    return PredictionMetadata(
        towns=sorted(label_encoders["town"].classes_.tolist()),
        flat_types=label_encoders["flat_type"].classes_.tolist(),
        flat_models=sorted(label_encoders["flat_model"].classes_.tolist()),
        storey_ranges=storey_ranges,
        lease_commence_min=int(lease_years.min()),
        lease_commence_max=int(lease_years.max()),
        floor_area_min=float(floor_area.min()),
        floor_area_max=float(floor_area.max()),
    )


def get_model_package() -> Mapping:
    model_path = current_app.config.get(
        "MODEL_PACKAGE_PATH", "Model-Development/Models/flat_price_prediction_model.pkl"
    )
    return _load_model_package(model_path)


def get_demand_model_package() -> Mapping:
    model_path = current_app.config.get(
        "DEMAND_MODEL_PACKAGE_PATH", "Model-Development/Models/demand_prediction_model.pkl"
    )
    return _load_model_package(model_path)


def get_prediction_metadata() -> PredictionMetadata:
    dataset_path = current_app.config.get(
        "MODEL_DATASET_PATH", "Model-Development/Data/Flat prices.csv"
    )
    return _load_dataset_metadata(dataset_path)


def _encode_categorical(value, encoder) -> int:
    classes = encoder.classes_.tolist()
    if not classes:
        return 0

    # Force safe string
    if value is None:
        candidate = ""
    else:
        candidate = str(value).strip()

    # Direct match
    if candidate in classes:
        return int(encoder.transform([candidate])[0])

    # Case-insensitive match
    candidate_upper = candidate.upper()
    matched = next((cls for cls in classes if cls.upper() == candidate_upper), None)
    if matched:
        return int(encoder.transform([matched])[0])

    # Map to Unknown if it exists
    if "Unknown" in classes:
        return int(encoder.transform(["Unknown"])[0])

    # Fallback: first known class
    return int(encoder.transform([classes[0]])[0])



def _prepare_input_features(form_data: Mapping[str, str], package: Mapping) -> PreparedFeatures:
    label_encoders = package["label_encoders"]
    scaler = package.get("scaler")
    feature_columns: Iterable[str] = package["feature_columns"]
    preprocessing_functions = package["preprocessing_functions"]

    town = (form_data.get("town") or "").strip()
    flat_type = (form_data.get("flat_type") or "").strip()
    flat_model = (form_data.get("flat_model") or "").strip()
    storey_range = (form_data.get("storey_range") or "").strip()

    try:
        floor_area = float(form_data.get("floor_area_sqm", "0") or 0)
    except ValueError as exc:
        raise PredictionError("Floor area must be a number.") from exc

    try:
        lease_commence = int(form_data.get("lease_commence_date", "0") or 0)
    except ValueError as exc:
        raise PredictionError("Lease commence date must be a year (e.g. 1998).") from exc

    now = pd.Timestamp.now()
    try:
        transaction_year = int(form_data.get("transaction_year") or now.year)
        transaction_month = int(form_data.get("transaction_month") or now.month)
    except ValueError as exc:
        raise PredictionError("Transaction year/month must be numeric.") from exc

    extract_midpoint = preprocessing_functions.get("extract_storey_midpoint", extract_storey_midpoint)
    storey_midpoint = extract_midpoint(storey_range)

    lease_age_years = transaction_year - lease_commence
    if lease_age_years > 99:
        raise PredictionError(
            "Transaction year cannot be more than 99 years after the lease commence year."
        )

    remaining_years = max(0, 99 - lease_age_years)
    remaining_lease_months = remaining_years * 12

    encoded = pd.DataFrame(
        {
            "town": [_encode_categorical(town, label_encoders["town"])],
            "flat_type": [_encode_categorical(flat_type, label_encoders["flat_type"])],
            "floor_area_sqm": [floor_area],
            "flat_model": [_encode_categorical(flat_model, label_encoders["flat_model"])],
            "lease_commence_date": [lease_commence],
            "remaining_lease_months": [remaining_lease_months],
            "storey_midpoint": [storey_midpoint],
            "transaction_year": [transaction_year],
            "transaction_month": [transaction_month],
            "lease_age_years": [lease_age_years],
        }
    )
    # --- add engineered features expected by the model ---
    encoded["lease_remaining_ratio"] = encoded["remaining_lease_months"] / (99 * 12)
    encoded["floor_area_x_lease"] = encoded["floor_area_sqm"] * encoded["lease_remaining_ratio"]
    encoded["storey_x_area"] = encoded["storey_midpoint"] * encoded["floor_area_sqm"]

    # handle month cyclic encoding
    encoded["month_sin"] = np.sin(2 * np.pi * encoded["transaction_month"] / 12)
    encoded["month_cos"] = np.cos(2 * np.pi * encoded["transaction_month"] / 12)
    encoded = encoded[list(feature_columns)]

    if scaler is not None:
        scaled_array = scaler.transform(encoded)
        scaled = pd.DataFrame(scaled_array, columns=list(feature_columns))
    else:
        scaled = encoded.copy()

    friendly_map = {
        "town": f"Town: {town or 'Unknown'}",
        "flat_type": f"Flat type: {flat_type or 'Unknown'}",
        "flat_model": f"Flat model: {flat_model or 'Unknown'}",
        "floor_area_sqm": f"Floor area (sqm): {floor_area:.1f}",
        "lease_commence_date": f"Lease commence year: {lease_commence}",
        "remaining_lease_months": f"Remaining lease (months): {remaining_lease_months}",
        "storey_midpoint": f"Storey midpoint: {storey_midpoint:.1f}",
        "transaction_year": f"Transaction year: {transaction_year}",
        "transaction_month": f"Transaction month: {transaction_month}",
        "lease_age_years": f"Lease age (years): {lease_age_years}",
    }
    friendly_labels = [friendly_map.get(col, col) for col in feature_columns]

    derived = {
        "lease_age_years": lease_age_years,
        "remaining_lease_months": remaining_lease_months,
        "storey_midpoint": storey_midpoint,
    }

    raw_input = {
        "town": town,
        "flat_type": flat_type,
        "flat_model": flat_model,
        "storey_range": storey_range,
        "floor_area_sqm": floor_area,
        "lease_commence_date": lease_commence,
        "transaction_year": transaction_year,
        "transaction_month": transaction_month,
    }

    return PreparedFeatures(
        encoded=encoded,
        scaled=scaled,
        friendly_labels=friendly_labels,
        derived=derived,
        raw_input=raw_input,
    )


def _normalise_town(value: str) -> str:
    return (value or "").strip().upper()


@lru_cache(maxsize=1)
def _load_exit_value_package(model_path: str) -> Mapping:
    path = _resolve_path(model_path)
    if not path.exists():
        raise ModelPackageError(f"Exit value model file not found at {path}")

    package = joblib.load(path)

    national_index = package.get("national_index")
    if isinstance(national_index, pd.Series):
        idx_series = national_index.copy().sort_index()
    elif isinstance(national_index, Mapping):
        idx_series = pd.Series(national_index).sort_index()
    else:
        raise ModelPackageError("Exit value package missing national index information.")
    package["_national_index_series"] = idx_series
    national_lookup = {}
    for key, value in idx_series.items():
        try:
            year_key = int(key)
        except (TypeError, ValueError):
            continue
        national_lookup[year_key] = float(value)
    package["_national_index_lookup"] = national_lookup

    demand_lookup = package.get("demand_lookup") or {}
    normalised_demand = {}
    for key, value in demand_lookup.items():
        try:
            year, town = key
        except (TypeError, ValueError):
            continue
        try:
            year = int(year)
        except (TypeError, ValueError):
            continue
        normalised_demand[(year, _normalise_town(town))] = float(value)
    package["_demand_lookup_norm"] = normalised_demand

    anchor_table = package.get("anchor_means_per_type")
    if isinstance(anchor_table, pd.DataFrame):
        table = anchor_table.copy()
        table["town_key"] = table["town"].astype(str).str.upper()
        table["flat_type_key"] = table["flat_type"].astype(str).str.upper()
        package["_anchor_lookup"] = (
            table.set_index(["town_key", "flat_type_key"])["flat_type_price_anchor"].to_dict()
        )
        package["_flat_type_anchor_fallback"] = (
            table.groupby("flat_type_key")["flat_type_price_anchor"].mean().to_dict()
        )
        package["_global_anchor_mean"] = float(table["flat_type_price_anchor"].mean())
    else:
        package["_anchor_lookup"] = {}
        package["_flat_type_anchor_fallback"] = {}
        package["_global_anchor_mean"] = 0.0

    size_ranges = package.get("size_ranges_per_type")
    if isinstance(size_ranges, pd.DataFrame):
        table = size_ranges.copy()
        table["flat_type_key"] = table["flat_type"].astype(str).str.upper()
        package["_size_range_lookup"] = {
            row["flat_type_key"]: (float(row["min_area"]), float(row["max_area"]))
            for _, row in table.iterrows()
        }
    else:
        package["_size_range_lookup"] = {}

    appreciation_table = package.get("town_appreciation_factor_table")
    if isinstance(appreciation_table, pd.DataFrame):
        table = appreciation_table.copy()
        table["town_key"] = table["town"].astype(str).str.upper()
        package["_town_appreciation_lookup"] = table.set_index("town_key")[
            "town_appreciation_factor"
        ].to_dict()
    else:
        package["_town_appreciation_lookup"] = {}

    historical_df = package.get("historical_df")
    if isinstance(historical_df, pd.DataFrame):
        hist = historical_df.copy()
        if "month_dt" in hist.columns and not pd.api.types.is_datetime64_any_dtype(hist["month_dt"]):
            hist["month_dt"] = pd.to_datetime(hist["month_dt"])
        package["historical_df"] = hist

    return package


def get_exit_value_package() -> Mapping:
    model_path = current_app.config.get(
        "EXIT_VALUE_MODEL_PATH", "Model-Development/Models/exit_value_prediction_model.pkl"
    )
    return _load_exit_value_package(model_path)


def predict_exit_value_outlook(
    form_data: Mapping[str, str],
    purchase_price: float,
    remaining_lease_months: Optional[float] = None,
) -> Dict[str, object]:
    """Predict exit value outlook using the bundled profitability model."""
    if purchase_price is None or purchase_price <= 0:
        raise PredictionError("A positive purchase price is required for exit value forecasting.")

    package = get_exit_value_package()
    multiplier_model = package.get("multiplier_model")
    national_index_lookup = package.get("_national_index_lookup")
    demand_lookup = package.get("_demand_lookup_norm", {})
    anchor_lookup = package.get("_anchor_lookup", {})
    flat_type_anchor_fallback = package.get("_flat_type_anchor_fallback", {})
    global_anchor_mean = float(package.get("_global_anchor_mean", purchase_price))
    size_range_lookup = package.get("_size_range_lookup", {})
    appreciation_lookup = package.get("_town_appreciation_lookup", {})
    historical_df = package.get("historical_df")
    global_sigma = float(package.get("global_sigma", 0.0))

    if multiplier_model is None or not national_index_lookup:
        raise ModelPackageError("Exit value package is missing required model components.")

    def _require(name: str) -> str:
        value = (form_data.get(name) or "").strip()
        if not value:
            raise PredictionError(f"{name.replace('_', ' ').title()} is required for the exit outlook.")
        return value

    town = _require("town")
    flat_type = _require("flat_type")
    flat_model = _require("flat_model")
    storey_range = _require("storey_range")

    try:
        floor_area = float(form_data.get("floor_area_sqm") or 0)
    except ValueError as exc:
        raise PredictionError("Floor area must be numeric for the exit outlook.") from exc
    if floor_area <= 0:
        raise PredictionError("Floor area must be greater than zero for the exit outlook.")

    try:
        lease_commence = int(form_data.get("lease_commence_date") or 0)
    except ValueError as exc:
        raise PredictionError("Lease commence year must be numeric for the exit outlook.") from exc

    now = pd.Timestamp.now()
    try:
        purchase_year = int(form_data.get("transaction_year") or now.year)
        purchase_month = int(form_data.get("transaction_month") or now.month)
    except ValueError as exc:
        raise PredictionError("Transaction year or month is invalid for the exit outlook.") from exc

    default_holding = int(current_app.config.get("EXIT_VALUE_HOLDING_YEARS", 5))
    try:
        holding_years = int(form_data.get("holding_years") or default_holding or 5)
    except ValueError as exc:
        raise PredictionError("Holding period must be numeric for the exit outlook.") from exc
    holding_years = max(1, holding_years)

    purchase_month = min(max(1, purchase_month), 12)
    lease_age_years = purchase_year - lease_commence
    if lease_age_years < 0:
        raise PredictionError("Transaction year cannot be before the lease commence year.")

    purchase_month_dt = pd.Timestamp(year=purchase_year, month=purchase_month, day=1)
    age_at_purchase = lease_age_years
    age_at_resale = lease_age_years + holding_years

    computed_remaining_years = max(0.0, 99 - lease_age_years)
    if remaining_lease_months is not None:
        try:
            derived_years = max(0.0, float(remaining_lease_months) / 12.0)
        except (TypeError, ValueError):
            derived_years = computed_remaining_years
        remaining_lease_now = derived_years if derived_years > 0 else computed_remaining_years
    else:
        remaining_lease_now = computed_remaining_years
    remaining_lease_fut = max(0.0, 99 - age_at_resale)

    def _market_index(year: int) -> float:
        if not national_index_lookup:
            raise ModelPackageError("National index lookup is empty.")
        years = sorted(national_index_lookup.keys())
        if year in national_index_lookup:
            return national_index_lookup[year]
        if year < years[0]:
            return national_index_lookup[years[0]]
        if year > years[-1]:
            if len(years) == 1:
                return national_index_lookup[years[-1]]
            growth_base = national_index_lookup[years[-1]]
            prev = national_index_lookup[years[-2]]
            growth_rate = growth_base / (prev if prev else 1.0)
            return growth_base * (growth_rate ** (year - years[-1]))
        lower = max([candidate for candidate in years if candidate <= year])
        upper = min([candidate for candidate in years if candidate >= year])
        if lower == upper:
            return national_index_lookup[lower]
        ratio = (year - lower) / (upper - lower)
        lower_val = national_index_lookup[lower]
        upper_val = national_index_lookup[upper]
        return lower_val * (1 - ratio) + upper_val * ratio

    town_key = _normalise_town(town)
    flat_type_key = (flat_type or "").strip().upper()
    demand_values = list(demand_lookup.values())
    demand_default = float(np.median(demand_values)) if demand_values else 0.0

    def _demand_index(year: int) -> float:
        lookup_key = (year, town_key)
        if lookup_key in demand_lookup:
            return demand_lookup[lookup_key]
        town_years = sorted([y for (y, t) in demand_lookup.keys() if t == town_key])
        if not town_years:
            return demand_default
        closest_year = min(town_years, key=lambda candidate: abs(candidate - year))
        return demand_lookup.get((closest_year, town_key), demand_default)

    market_index_purchase = _market_index(purchase_year)
    market_index_future = _market_index(purchase_year + holding_years)
    market_growth_factor = market_index_future / (market_index_purchase + 1e-9)

    demand_now = _demand_index(purchase_year)
    demand_future = _demand_index(purchase_year + holding_years)

    anchor_value = anchor_lookup.get((town_key, flat_type_key))
    if anchor_value is None:
        anchor_value = flat_type_anchor_fallback.get(flat_type_key)
    if anchor_value is None and isinstance(historical_df, pd.DataFrame):
        town_mask = historical_df["town"].astype(str).str.upper() == town_key
        type_mask = historical_df["flat_type"].astype(str).str.upper() == flat_type_key
        subset = historical_df[town_mask & type_mask]
        if not subset.empty:
            anchor_value = float(subset["resale_price"].mean())
        else:
            flat_subset = historical_df[type_mask]
            if not flat_subset.empty:
                anchor_value = float(flat_subset["resale_price"].mean())
    if anchor_value is None:
        anchor_value = global_anchor_mean or purchase_price

    size_min, size_max = size_range_lookup.get(flat_type_key, (None, None))
    if size_min is not None and size_max is not None:
        is_size_valid = int(size_min <= floor_area <= size_max)
    elif isinstance(historical_df, pd.DataFrame):
        flat_subset = historical_df[historical_df["flat_type"].astype(str).str.upper() == flat_type_key]
        if not flat_subset.empty:
            min_area = float(flat_subset["floor_area_sqm"].min())
            max_area = float(flat_subset["floor_area_sqm"].max())
            is_size_valid = int(min_area <= floor_area <= max_area)
        else:
            is_size_valid = 1
    else:
        is_size_valid = 1

    appreciation_factor = appreciation_lookup.get(town_key)
    if appreciation_factor is None and isinstance(historical_df, pd.DataFrame):
        hist = historical_df.copy()
        hist["year"] = hist["month_dt"].dt.year
        town_hist = hist[hist["town"].astype(str).str.upper() == town_key]
        if not town_hist.empty:
            median_2017 = town_hist[town_hist["year"] == 2017]["resale_price"].median()
            median_2024 = town_hist[town_hist["year"] == 2024]["resale_price"].median()
            if pd.notna(median_2017) and pd.notna(median_2024) and median_2017 > 0:
                appreciation_factor = float(median_2024 / median_2017)
    if appreciation_factor is None:
        appreciation_factor = 1.0

    month_sin = float(np.sin(2 * np.pi * purchase_month / 12))
    month_cos = float(np.cos(2 * np.pi * purchase_month / 12))

    feature_row = pd.DataFrame(
        [
            {
                "town": town,
                "flat_type": flat_type,
                "storey_range": storey_range,
                "flat_model": flat_model,
                "floor_area_sqm": floor_area,
                "lease_commence_date": lease_commence,
                "remaining_lease": remaining_lease_now,
                "age_at_purchase": age_at_purchase,
                "age_at_resale": age_at_resale,
                "years_ahead": holding_years,
                "remaining_lease_now": remaining_lease_now,
                "remaining_lease_fut": remaining_lease_fut,
                "market_index_purchase": market_index_purchase,
                "market_index_future": market_index_future,
                "market_growth_factor": market_growth_factor,
                "demand_now": demand_now,
                "demand_future": demand_future,
                "purchase_month_sin": month_sin,
                "purchase_month_cos": month_cos,
                "flat_type_price_anchor": anchor_value,
                "is_size_valid": is_size_valid,
                "town_appreciation_factor": appreciation_factor,
            }
        ]
    )

    feature_columns = package.get("feature_columns")
    if feature_columns:
        feature_row = feature_row.reindex(columns=list(feature_columns), fill_value=0)

    future_multiplier = float(multiplier_model.predict(feature_row)[0])
    exit_price = purchase_price * future_multiplier
    profit = exit_price - purchase_price
    pct_gain = (profit / purchase_price) * 100 if purchase_price else 0.0

    lower_band = exit_price - global_sigma
    upper_band = exit_price + global_sigma

    return {
        "exit_price": float(exit_price),
        "profit": float(profit),
        "pct_gain": float(pct_gain),
        "lower_band": float(lower_band),
        "upper_band": float(upper_band),
        "purchase_price": float(purchase_price),
        "purchase_month": purchase_month_dt,
        "demand_index": float(demand_now),
        "holding_years": holding_years,
        "future_year": purchase_year + holding_years,
        "future_price_multiplier": future_multiplier,
    }


def _prepare_demand_features(form_data: Mapping[str, str], package: Mapping) -> pd.DataFrame:
    label_encoders = package["label_encoders"]
    scaler = package.get("scaler")
    feature_columns: Iterable[str] = package["feature_columns"]
    preprocessing_functions = package.get("preprocessing_functions", {})

    town = (form_data.get("town") or "").strip()
    flat_type = (form_data.get("flat_type") or "").strip()
    flat_model = (form_data.get("flat_model") or "").strip()
    storey_range = (form_data.get("storey_range") or "").strip()

    try:
        floor_area = float(form_data.get("floor_area_sqm", "0") or 0)
    except ValueError as exc:
        raise PredictionError("Floor area must be a number.") from exc

    try:
        lease_commence = int(form_data.get("lease_commence_date", "0") or 0)
    except ValueError as exc:
        raise PredictionError("Lease commence date must be a year (e.g. 1998).") from exc

    now = pd.Timestamp.now()
    try:
        transaction_year = int(form_data.get("transaction_year") or now.year)
        transaction_month = int(form_data.get("transaction_month") or now.month)
    except ValueError as exc:
        raise PredictionError("Transaction year/month must be numeric.") from exc

    extract_midpoint = preprocessing_functions.get("extract_storey_midpoint", extract_storey_midpoint)
    storey_midpoint = extract_midpoint(storey_range)

    lease_age_years = transaction_year - lease_commence
    if lease_age_years > 99:
        raise PredictionError(
            "Transaction year cannot be more than 99 years after the lease commence year."
        )

    remaining_years = max(0, 99 - lease_age_years)
    remaining_lease_months = remaining_years * 12
    lease_remaining_years = remaining_lease_months / 12 if remaining_lease_months else 0.0
    lease_remaining_ratio = remaining_lease_months / float(99 * 12) if remaining_lease_months else 0.0

    # Normalise text features to match training preprocessing
    town_normalised = town.upper()
    flat_model_replacements = {
        "Improved-Maisonette": "Maisonette",
        "Model A-Maisonette": "Maisonette",
        "Model A2": "Model A",
    }
    flat_model_normalised = flat_model_replacements.get(flat_model, flat_model)

    month_sin = np.sin(2 * np.pi * transaction_month / 12)
    month_cos = np.cos(2 * np.pi * transaction_month / 12)
    floor_area_x_lease = floor_area * lease_remaining_ratio
    storey_x_area = storey_midpoint * floor_area
    price_per_sqm = 0.0  # price not known at prediction time; keep schema consistent
    price_efficiency = 0.0

    encoded = pd.DataFrame(
        {
            "town": [town_normalised],
            "flat_type": [flat_type],
            "floor_area_sqm": [floor_area],
            "flat_model": [flat_model_normalised],
            "lease_commence_date": [lease_commence],
            "remaining_lease_months": [remaining_lease_months],
            "lease_remaining_years": [lease_remaining_years],
            "storey_midpoint": [storey_midpoint],
            "transaction_year": [transaction_year],
            "transaction_month": [transaction_month],
            "lease_age_years": [lease_age_years],
            "lease_remaining_ratio": [lease_remaining_ratio],
            "floor_area_x_lease": [floor_area_x_lease],
            "storey_x_area": [storey_x_area],
            "month_sin": [month_sin],
            "month_cos": [month_cos],
            "price_per_sqm": [price_per_sqm],
            "price_efficiency": [price_efficiency],
        }
    )

    # Feature binning mirrors the training notebook
    encoded["floor_area_bin"] = pd.cut(
        encoded["floor_area_sqm"],
        bins=[0, 60, 80, 100, 120, 200],
        labels=["XS", "S", "M", "L", "XL"],
    )
    encoded["storey_bin"] = pd.cut(
        encoded["storey_midpoint"],
        bins=[0, 5, 10, 15, 25, 50],
        labels=["Low", "Mid-Low", "Mid", "High", "Very High"],
    )

    encoded = encoded.fillna(
        {
            "storey_midpoint": 0.0,
            "lease_remaining_years": 0.0,
            "lease_remaining_ratio": 0.0,
            "floor_area_x_lease": 0.0,
            "storey_x_area": 0.0,
            "month_sin": 0.0,
            "month_cos": 0.0,
        }
    )

    for col in ("floor_area_bin", "storey_bin"):
        if col in encoded.columns:
            encoded[col] = (
                encoded[col]
                .cat.add_categories(["Unknown"])
                .fillna("Unknown")
                .astype(str)
            )

    # Encode categorical fields using the stored label encoders
    for name, encoder in label_encoders.items():
        if name in encoded.columns:
            encoded[name] = encoded[name].apply(lambda value, enc=encoder: _encode_categorical(str(value), enc))

    # Ensure the dataframe matches the training feature order
    encoded = encoded.reindex(columns=list(feature_columns), fill_value=0)

    # --- SCALE FEATURES TO MATCH TRAINING ---
    scaler = package.get("scaler")
    if scaler is not None:
        scaled_array = scaler.transform(encoded)
        encoded = pd.DataFrame(scaled_array, columns=list(feature_columns))

    return encoded


@lru_cache(maxsize=1)
def _load_background_features(model_path: str, dataset_path: str) -> pd.DataFrame:
    package = _load_model_package(model_path)
    label_encoders = package["label_encoders"]
    feature_columns: Iterable[str] = package["feature_columns"]
    preprocessing_functions = package["preprocessing_functions"]

    path = _resolve_path(dataset_path)
    if not path.exists():
        raise ModelPackageError(f"Training dataset not found at {path}")

    usecols = [
        "town",
        "flat_type",
        "flat_model",
        "floor_area_sqm",
        "lease_commence_date",
        "storey_range",
        "month",
        "remaining_lease",
    ]

    parse_fn = preprocessing_functions.get("parse_remaining_lease", parse_remaining_lease)
    extract_midpoint = preprocessing_functions.get("extract_storey_midpoint", extract_storey_midpoint)

    def _prepare_chunk(chunk: pd.DataFrame) -> pd.DataFrame:
        chunk = chunk.dropna(
            subset=[
                "town",
                "flat_type",
                "flat_model",
                "floor_area_sqm",
                "lease_commence_date",
                "storey_range",
                "month",
            ]
        )
        if chunk.empty:
            return chunk
        chunk = chunk.copy()
        chunk["storey_midpoint"] = chunk["storey_range"].apply(extract_midpoint)
        chunk["remaining_lease_months"] = chunk["remaining_lease"].apply(parse_fn)
        chunk["month_dt"] = pd.to_datetime(chunk["month"], format="%Y-%m", errors="coerce")
        chunk = chunk.dropna(subset=["month_dt", "storey_midpoint", "remaining_lease_months"])
        if chunk.empty:
            return chunk
        chunk["transaction_year"] = chunk["month_dt"].dt.year.astype(int)
        chunk["transaction_month"] = chunk["month_dt"].dt.month.astype(int)
        chunk["lease_commence_date"] = chunk["lease_commence_date"].astype(int)
        chunk["floor_area_sqm"] = chunk["floor_area_sqm"].astype(float)
        chunk["lease_age_years"] = chunk["transaction_year"] - chunk["lease_commence_date"]
        return chunk[
            [
                "town",
                "flat_type",
                "flat_model",
                "floor_area_sqm",
                "lease_commence_date",
                "storey_midpoint",
                "remaining_lease_months",
                "transaction_year",
                "transaction_month",
                "lease_age_years",
            ]
        ]

    total_rows = 0
    for chunk in pd.read_csv(path, usecols=usecols, chunksize=20_000):
        cleaned = _prepare_chunk(chunk)
        total_rows += len(cleaned)

    if total_rows == 0:
        return pd.DataFrame(columns=list(feature_columns))

    if total_rows > 600:
        sampled_positions = (
            pd.RangeIndex(total_rows)
            .to_series()
            .sample(600, random_state=42)
            .tolist()
        )
    else:
        sampled_positions = list(range(total_rows))

    selected_rows = [None] * len(sampled_positions)
    position_lookup = {pos: idx for idx, pos in enumerate(sampled_positions)}

    current_index = 0
    for chunk in pd.read_csv(path, usecols=usecols, chunksize=20_000):
        cleaned = _prepare_chunk(chunk)
        if cleaned.empty:
            continue
        for row in cleaned.itertuples(index=False):
            slot = position_lookup.get(current_index)
            if slot is not None:
                selected_rows[slot] = {
                    "town": _encode_categorical(row.town, label_encoders["town"]),
                    "flat_type": _encode_categorical(row.flat_type, label_encoders["flat_type"]),
                    "floor_area_sqm": float(row.floor_area_sqm),
                    "flat_model": _encode_categorical(row.flat_model, label_encoders["flat_model"]),
                    "lease_commence_date": int(row.lease_commence_date),
                    "remaining_lease_months": float(row.remaining_lease_months),
                    "storey_midpoint": float(row.storey_midpoint),
                    "transaction_year": int(row.transaction_year),
                    "transaction_month": int(row.transaction_month),
                    "lease_age_years": int(row.lease_age_years),
                }
            current_index += 1
        if all(row is not None for row in selected_rows):
            break

    encoded = pd.DataFrame(selected_rows)

    # --- add engineered features expected by the model ---
    encoded["lease_remaining_ratio"] = encoded["remaining_lease_months"] / (99 * 12)
    encoded["floor_area_x_lease"] = encoded["floor_area_sqm"] * encoded["lease_remaining_ratio"]
    encoded["storey_x_area"] = encoded["storey_midpoint"] * encoded["floor_area_sqm"]
    encoded["month_sin"] = np.sin(2 * np.pi * encoded["transaction_month"] / 12)
    encoded["month_cos"] = np.cos(2 * np.pi * encoded["transaction_month"] / 12)


    encoded = encoded[list(feature_columns)].dropna()

    if len(encoded) > 50:
        encoded = encoded.sample(50, random_state=42)


    scaler = package.get("scaler")
    if scaler is not None:
        scaled_array = scaler.transform(encoded)
        encoded = pd.DataFrame(scaled_array, columns=list(feature_columns))

    return encoded.reset_index(drop=True)


def _get_background_features() -> pd.DataFrame:
    model_path = current_app.config.get(
        "MODEL_PACKAGE_PATH", "Model-Development/Models/flat_price_prediction_model.pkl"
    )
    dataset_path = current_app.config.get(
        "MODEL_DATASET_PATH", "Model-Development/Data/Flat prices.csv"
    )
    return _load_background_features(model_path, dataset_path)


def predict_price(form_data: Mapping[str, str]) -> Dict[str, object]:
    package = get_model_package()
    prepared = _prepare_input_features(form_data, package)
    model = package["model"]

    prediction = float(model.predict(prepared.scaled.values)[0])

    return {
        "predicted_price": prediction,
        "lease_age_years": prepared.derived["lease_age_years"],
        "remaining_lease_months": prepared.derived["remaining_lease_months"],
        "storey_midpoint": prepared.derived["storey_midpoint"],
        "prepared_features": prepared,
    }


def _demand_label_from_probability(probability: float) -> str:
    if probability >= 0.8:
        return "High"
    elif probability >= 0.55:
        return "Medium"
    else:
        return "Low"


def predict_demand(form_data: Mapping[str, str]) -> Dict[str, object]:
    package = get_demand_model_package()
    model = package["model"]
    feature_order = package.get("feature_columns")

    features = _prepare_demand_features(form_data, package)
    if feature_order is not None:
        features = features.reindex(columns=feature_order, fill_value=0)

    if current_app:
        current_app.logger.debug(
            "Demand predictor input rows=%s cols=%s sample=%s",
            len(features),
            getattr(features, "columns", []),
            getattr(features, "head", lambda n: features)(1).to_dict(orient="records") if hasattr(features, "to_dict") else features[:1].tolist(),
        )

    probability = float(model.predict_proba(features)[0, 1])
    if current_app:
        current_app.logger.debug("Demand predictor probability=%s", probability)

    label = _demand_label_from_probability(probability)
    town = (form_data.get("town") or "").strip()
    flat_type = (form_data.get("flat_type") or "").strip()

    if label == "High":
        message = (
            f"Listings like this have historically attracted strong buyer interest in {town or 'the selected town'}. "
            "Consider highlighting unique selling points to maximise offers."
        )
    elif label == "Medium":
        message = (
            f"Demand is moderate. Pricing strategy and presentation could sway interest for this {flat_type or 'flat type'} "
            f"in {town or 'the selected town'}."
        )
    else:
        message = (
            "Historical demand signals are lower for similar homes. You may want to review pricing or emphasise "
            "recent upgrades to improve appeal."
        )

    return {
        "probability": probability,
        "percentage": f"{probability * 100:.1f}%",
        "label": label,
        "message": message,
    }



def generate_shap_image(prepared: PreparedFeatures) -> Optional[str]:
    background = _get_background_features()
    if background.empty:
        return None

    package = get_model_package()
    model = package["model"]
    model_name = str(package.get("model_name", "")).lower()

    friendly_labels = prepared.friendly_labels
    rename_map = dict(zip(prepared.scaled.columns, friendly_labels))
    sample = prepared.scaled.rename(columns=rename_map, copy=False)
    background = background.rename(columns=rename_map, copy=False)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        if any(keyword in model_name for keyword in ("forest", "tree", "boost", "xgb", "gbm")):
            explainer = shap.TreeExplainer(model, background, feature_perturbation="interventional")
            shap_values = explainer.shap_values(sample)
            if isinstance(shap_values, list):
                shap_row = np.array(shap_values[0])[0]
            else:
                shap_row = np.array(shap_values)[0]
        else:
            explainer = shap.Explainer(model, background)
            shap_result = explainer(sample)
            shap_row = np.array(getattr(shap_result, "values", shap_result))[0]

    values = np.array(shap_row, dtype=float)
    labels = np.array(friendly_labels)

    positive_mask = values > 0
    negative_mask = values <= 0

    fig, axes = plt.subplots(2, 1, figsize=(14, 9), height_ratios=[1, 1])
    fig.subplots_adjust(hspace=0.5, top=0.88)

    if positive_mask.any():
        axes[0].barh(labels[positive_mask], values[positive_mask], color="#f77b72")
        axes[0].invert_yaxis()
        axes[0].grid(axis="x", linestyle="--", alpha=0.4)
    else:
        axes[0].text(0.5, 0.5, "No positive contributions", ha="center", va="center", fontsize=11)
        axes[0].set_axis_off()

    if negative_mask.any():
        axes[1].barh(labels[negative_mask], values[negative_mask], color="#72b0f7")
        axes[1].invert_yaxis()
        axes[1].grid(axis="x", linestyle="--", alpha=0.4)
    else:
        axes[1].text(0.5, 0.5, "No negative contributions", ha="center", va="center", fontsize=11)
        axes[1].set_axis_off()

    axes[0].set_title("Features Increasing Predicted Price", fontsize=13, weight="bold", pad=8)
    axes[1].set_title("Features Decreasing Predicted Price", fontsize=13, weight="bold", pad=8)
    fig.text(0.5, 0.04, "Feature contribution (SHAP value)", ha="center", fontsize=12)

    town = prepared.raw_input.get("town") or "Selected town"
    fig.suptitle(f"Feature Impact for Predicted Price in {town}", fontsize=16, fontweight="bold", y=0.97)

    buffer = BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def generate_town_price_chart(flat_type: str, flat_model: str, town: str) -> Optional[str]:
    """Return a base64 bar chart comparing average prices for the selected flat type/model across towns."""
    from application.services.price_catalog import average_prices_by_town

    averages = average_prices_by_town(flat_type, flat_model)
    if not averages:
        averages = average_prices_by_town(flat_type, None)
    else:
        type_level = average_prices_by_town(flat_type, None)
        if type_level:
            # Enrich sparse model data with broader flat-type averages
            for town, price in type_level.items():
                averages.setdefault(town, price)
    if not averages:
        return None

    selected_town = (town or "").strip()
    towns_sorted = sorted(averages.items(), key=lambda item: item[1], reverse=True)
    max_bars = 12
    displayed = towns_sorted[:max_bars]

    if selected_town and selected_town not in dict(displayed) and selected_town in averages:
        displayed = displayed[:-1] + [(selected_town, averages[selected_town])]

    labels = [label for label, _ in displayed]
    values = [value for _, value in displayed]
    colors = ["#f97316" if label == selected_town else "#93c5fd" for label in labels]

    fig, ax = plt.subplots(figsize=(12, 5))
    bars = ax.bar(labels, values, color=colors, edgecolor="#1f2937", linewidth=0.6)
    ax.set_ylabel("Average resale price (S$)", fontweight="bold")
    ax.set_title(
        f"Avg. resale price by town for {flat_type or 'selected flat type'} ({flat_model or 'model'})",
        fontweight="bold",
        pad=14,
    )
    ax.tick_params(axis="x", rotation=35)
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right")
    ax.grid(axis="y", linestyle="--", alpha=0.3)

    if selected_town and selected_town in averages:
        selected_value = averages[selected_town]
        ax.axhline(
            selected_value,
            color="#f97316",
            linestyle="--",
            linewidth=1,
            alpha=0.7,
            label=f"{selected_town} average",
        )
        ax.legend(loc="upper right", frameon=False)

    # Keep the chart clean by omitting text labels above each bar. Tooltips are not
    # available in static images, so the legend and axis serve as the reference.

    fig.tight_layout()
    buffer = BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def warm_predictor_caches(async_mode: bool = True) -> None:
    """Prime model, metadata, and SHAP background caches to reduce first-request latency."""

    def _load(app_obj):
        with app_obj.app_context():
            try:
                get_model_package()
                get_prediction_metadata()
                _get_background_features()
                try:
                    background = _get_background_features()
                    package = get_model_package()
                    model = package["model"]
                    model_name = str(package.get("model_name", "")).lower()

                    # Pre-initialize SHAP explainer once
                    import shap
                    # if any(keyword in model_name for keyword in ("forest", "tree", "boost", "xgb", "gbm")):
                    #     shap.TreeExplainer(model, background.sample(min(len(background), 200)), feature_perturbation="interventional")
                    # else:
                    #     shap.Explainer(model, background.sample(min(len(background), 200)))
                except Exception as e:
                    app_obj.logger.warning("SHAP warm-up failed: %s", e)

            except Exception as exc:  # pragma: no cover - defensive safety
                app_obj.logger.warning("Predictor warm-up failed: %s", exc)

    app_obj = current_app._get_current_object()
    if async_mode:
        threading.Thread(target=_load, args=(app_obj,), daemon=True).start()
    else:
        _load(app_obj)

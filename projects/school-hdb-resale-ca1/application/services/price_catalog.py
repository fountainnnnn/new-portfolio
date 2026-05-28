from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Tuple


DATA_RELATIVE_PATH = Path("Model-Development") / "Data" / "Flat prices.csv"
_FLAT_MODEL_NORMALISATION = {
    "Improved-Maisonette": "Maisonette",
    "Model A-Maisonette": "Maisonette",
    "Model A2": "Model A",
}
_FLAT_MODEL_NORMALISATION = {
    "Improved-Maisonette": "Maisonette",
    "Model A-Maisonette": "Maisonette",
    "Model A2": "Model A",
}


def _dataset_path() -> Path:
    root = Path(__file__).resolve().parents[2]
    data_path = root / DATA_RELATIVE_PATH
    if not data_path.exists():
        raise FileNotFoundError(f"Average price dataset not found at {data_path}")
    return data_path


def _normalise_flat_model(value: str) -> str:
    return (value or "").strip()


def _average_from_metrics(metrics: Dict[str, float]) -> float | None:
    if not metrics:
        return None
    total_area = metrics.get("total_area", 0.0)
    count = int(metrics.get("count", 0))
    first_area = metrics.get("first_area", 0.0)

    if count > 0 and total_area > 0:
        return total_area / count
    if first_area > 0:
        return first_area
    return None


@lru_cache(maxsize=1)
def _load_summary() -> Dict[str, Dict[str, Dict[str, Dict[str, float]]]]:
    """Return aggregated averages (price and floor area) per flat type, model, and town."""
    sums: Dict[Tuple[str, str, str], Tuple[float, float, int]] = {}
    first_area: Dict[Tuple[str, str, str], float] = {}
    with _dataset_path().open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            town = (row.get("town") or "").strip()
            flat_type = (row.get("flat_type") or "").strip()
            flat_model = _normalise_flat_model((row.get("flat_model") or "").strip())
            price_str = (row.get("resale_price") or "").replace(",", "").strip()
            area_str = (row.get("floor_area_sqm") or "").strip()
            if not town or not flat_type or not flat_model or not price_str:
                continue
            try:
                price = float(price_str)
                area = float(area_str) if area_str else 0.0
            except ValueError:
                continue
            key = (flat_type, flat_model, town)
            total_price, total_area, count = sums.get(key, (0.0, 0.0, 0))
            sums[key] = (total_price + price, total_area + area, count + 1)
            if key not in first_area:
                first_area[key] = area

    summary: Dict[str, Dict[str, Dict[str, Dict[str, float]]]] = {}
    for (flat_type, flat_model, town), (total_price, total_area, count) in sums.items():
        if count == 0:
            continue
        summary.setdefault(flat_type, {}).setdefault(flat_model, {})[town] = {
            "total_price": total_price,
            "total_area": total_area,
            "count": count,
            "first_area": first_area.get((flat_type, flat_model, town), 0.0),
        }
    return summary


@lru_cache(maxsize=1)
def load_average_prices() -> Dict[str, Dict[str, float]]:
    """Return average resale prices per town per flat type."""
    averages: Dict[str, Dict[str, float]] = {}
    for flat_type, models in _load_summary().items():
        town_totals: Dict[str, Tuple[float, int]] = {}
        for model_data in models.values():
            for town, metrics in model_data.items():
                total_price = metrics["total_price"]
                count = int(metrics["count"])
                if count <= 0:
                    continue
                existing_total, existing_count = town_totals.get(town, (0.0, 0))
                town_totals[town] = (existing_total + total_price, existing_count + count)
        averages[flat_type] = {
            town: total / count for town, (total, count) in town_totals.items() if count > 0
        }
    return averages


def available_flat_types() -> List[str]:
    return sorted(load_average_prices().keys())


def available_towns(flat_type: str) -> List[str]:
    return sorted(load_average_prices().get(flat_type, {}).keys())


def suggest_by_budget(flat_type: str, budget: float, limit: int = 10) -> List[Dict[str, float]]:
    if budget <= 0:
        return []
    averages = load_average_prices().get(flat_type, {})
    matches: List[Tuple[str, float]] = [
        (town, price) for town, price in averages.items() if price <= budget
    ]
    if not matches:
        return []
    matches.sort(key=lambda item: item[1])
    limited = matches[:limit]
    return [
        {
            "town": town,
            "average_price": price,
            "buffer": budget - price,
        }
        for town, price in limited
    ]


def average_prices_by_town(flat_type: str, flat_model: str | None = None) -> Dict[str, float]:
    """Return weighted-average resale prices per town for the provided flat selection."""
    summary = _load_summary()
    models = summary.get(flat_type, {})
    if not models:
        return {}

    def _averages_for(model_metrics: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        averages: Dict[str, float] = {}
        for town, metrics in model_metrics.items():
            count = int(metrics.get("count", 0))
            total = metrics.get("total_price", 0.0)
            if count > 0 and total > 0:
                averages[town] = total / count
        return averages

    if flat_model and flat_model in models:
        specific = _averages_for(models.get(flat_model, {}))
        if specific:
            return specific

    combined: Dict[str, Tuple[float, int]] = {}
    for model_metrics in models.values():
        for town, metrics in model_metrics.items():
            count = int(metrics.get("count", 0))
            total = metrics.get("total_price", 0.0)
            if count <= 0 or total <= 0:
                continue
            aggregate_total, aggregate_count = combined.get(town, (0.0, 0))
            combined[town] = (aggregate_total + total, aggregate_count + count)

    return {
        town: total / count
        for town, (total, count) in combined.items()
        if count > 0 and total > 0
    }


@lru_cache(maxsize=1)
def floor_area_lookup() -> Dict[str, Dict[str, float]]:
    """Return average floor area per flat type, model, and town."""
    lookup: Dict[str, Dict[str, Dict[str, float]]] = {}
    summary = _load_summary()
    for flat_type, models in summary.items():
        aggregated: Dict[str, Dict[str, float]] = {}
        model_entry: Dict[str, Dict[str, float]] = {}
        type_totals = {"total_area": 0.0, "count": 0, "first_area": 0.0}
        has_type_first = False
        for flat_model, towns in models.items():
            per_model: Dict[str, float] = {}
            for town, metrics in towns.items():
                avg_area = _average_from_metrics(metrics)
                if avg_area is None:
                    continue
                per_model[town] = avg_area
                agg_metrics = aggregated.get(town)
                if agg_metrics:
                    agg_metrics["total_area"] = agg_metrics.get("total_area", 0.0) + metrics.get(
                        "total_area", 0.0
                    )
                    agg_metrics["count"] = agg_metrics.get("count", 0) + int(metrics.get("count", 0))
                    if agg_metrics.get("first_area", 0.0) <= 0 and metrics.get("first_area", 0.0) > 0:
                        agg_metrics["first_area"] = metrics.get("first_area", 0.0)
                else:
                    aggregated[town] = {
                        "total_area": metrics.get("total_area", 0.0),
                        "count": int(metrics.get("count", 0)),
                        "first_area": metrics.get("first_area", 0.0),
                    }
                type_totals["total_area"] += metrics.get("total_area", 0.0)
                type_totals["count"] += int(metrics.get("count", 0))
                if not has_type_first and metrics.get("first_area", 0.0) > 0:
                    type_totals["first_area"] = metrics.get("first_area", 0.0)
                    has_type_first = True
            if per_model:
                model_entry[flat_model] = per_model
        any_map = {
            town: average
            for town, average in (
                (town, _average_from_metrics(metrics)) for town, metrics in aggregated.items()
            )
            if average is not None
        }
        if any_map:
            model_entry["__ANY__"] = any_map
        type_average = _average_from_metrics(type_totals)
        if type_average is not None:
            model_entry["__FLAT_TYPE_AVG__"] = type_average
        lookup[flat_type] = model_entry
    return lookup


def average_floor_area(flat_type: str, flat_model: str, town: str) -> float | None:
    summary = _load_summary()
    models = summary.get(flat_type, {})
    metrics = models.get(flat_model, {}).get(town)
    avg = _average_from_metrics(metrics or {})
    if avg is not None:
        return avg

    # Fall back to any model within the same flat type for the town
    for model_metrics in models.values():
        entry = model_metrics.get(town)
        avg = _average_from_metrics(entry or {})
        if avg is not None:
            return avg

    total_area = 0.0
    total_count = 0
    fallback_first = 0.0
    for model_metrics in models.values():
        for metrics in model_metrics.values():
            total_area += metrics.get("total_area", 0.0)
            total_count += int(metrics.get("count", 0))
            if fallback_first <= 0 and metrics.get("first_area", 0.0) > 0:
                fallback_first = metrics.get("first_area", 0.0)

    if total_count > 0 and total_area > 0:
        return total_area / total_count
    if fallback_first > 0:
        return fallback_first

    return None

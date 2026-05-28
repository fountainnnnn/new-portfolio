from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List

from flask import abort, jsonify, redirect, render_template, request, session, url_for
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from application import app, csrf, db
from application.forms import BudgetForm, PredictionForm, ProfileForm
from application.models import PredictionHistory, User
from application.services.chatbot import ChatbotError, generate_chat_response
from application.services.model_insights import generate_prediction_insights
from application.services.predictor import (
    ModelPackageError,
    PredictionError,
    generate_shap_image,
    generate_town_price_chart,
    get_prediction_metadata,
    predict_demand,
    predict_exit_value_outlook,
    predict_price,
)
from application.services.price_catalog import (
    available_flat_types,
    average_floor_area,
    floor_area_lookup,
    suggest_by_budget,
)

DEFAULT_PREDICTION_FLAT_TYPE = "2 ROOM"
_PREDICTION_SCHEMA_CHECKED = False
SINGAPORE_TZ = ZoneInfo("Asia/Singapore")


def _format_singapore_time(value: datetime | None, fmt: str = "%d %b %Y, %H:%M") -> str:
    """Render timestamps in Singapore time, assuming UTC when naive."""
    if not value:
        return "—"

    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)

    return value.astimezone(SINGAPORE_TZ).strftime(fmt)


@csrf.exempt
@app.route("/api/predict/price", methods=["POST"])
def api_predict_price():
    payload = _prediction_payload_from_request()
    try:
        result = predict_price(payload)
    except PredictionError as exc:
        return _json_error(str(exc), 400, "prediction_error")
    except ModelPackageError as exc:
        return _json_error(str(exc), 503, "model_package_error")
    except Exception as exc:  # pragma: no cover - safety
        app.logger.exception("Price prediction failed: %s", exc)
        return _json_error("Unexpected error while predicting price.", 500, "unexpected_error")

    prepared = result.get("prepared_features")
    response = {
        "predicted_price": result.get("predicted_price"),
        "lease_age_years": result.get("lease_age_years"),
        "remaining_lease_months": result.get("remaining_lease_months"),
        "storey_midpoint": result.get("storey_midpoint"),
    }
    if prepared:
        response["inputs"] = prepared.raw_input
        response["derived"] = prepared.derived
    return _json_success(response)


@csrf.exempt
@app.route("/api/predict/demand", methods=["POST"])
def api_predict_demand():
    payload = _prediction_payload_from_request()
    try:
        result = predict_demand(payload)
    except PredictionError as exc:
        return _json_error(str(exc), 400, "prediction_error")
    except ModelPackageError as exc:
        return _json_error(str(exc), 503, "model_package_error")
    except Exception as exc:  # pragma: no cover - safety
        app.logger.exception("Demand prediction failed: %s", exc)
        return _json_error("Unexpected error while predicting demand.", 500, "unexpected_error")
    return _json_success(result)


@csrf.exempt
@app.route("/api/predict/exit-value", methods=["POST"])
def api_predict_exit_value():
    payload = _prediction_payload_from_request()
    purchase_price = _safe_float(payload.get("purchase_price"), default=-1)
    if purchase_price <= 0:
        return _json_error("purchase_price must be greater than zero.", 400, "validation_error")

    remaining_months_raw = payload.get("remaining_lease_months")
    remaining_months = None
    if remaining_months_raw not in (None, ""):
        try:
            remaining_months = float(remaining_months_raw)
        except (TypeError, ValueError):
            return _json_error("remaining_lease_months must be numeric.", 400, "validation_error")

    try:
        result = predict_exit_value_outlook(payload, purchase_price, remaining_months)
    except PredictionError as exc:
        return _json_error(str(exc), 400, "prediction_error")
    except ModelPackageError as exc:
        return _json_error(str(exc), 503, "model_package_error")
    except Exception as exc:  # pragma: no cover - safety
        app.logger.exception("Exit outlook failed: %s", exc)
        return _json_error("Unexpected error while forecasting exit value.", 500, "unexpected_error")

    response = {
        "exit_price": result.get("exit_price"),
        "profit": result.get("profit"),
        "pct_gain": result.get("pct_gain"),
        "lower_band": result.get("lower_band"),
        "upper_band": result.get("upper_band"),
        "purchase_price": result.get("purchase_price"),
        "purchase_month": _serialize_purchase_month(result.get("purchase_month")),
        "demand_index": result.get("demand_index"),
        "holding_years": result.get("holding_years"),
        "future_year": result.get("future_year"),
        "future_price_multiplier": result.get("future_price_multiplier"),
    }
    return _json_success(response)


@app.route("/api/predict/metadata", methods=["GET"])
def api_prediction_metadata():
    try:
        metadata = get_prediction_metadata()
    except ModelPackageError as exc:
        return _json_error(str(exc), 503, "model_package_error")
    except Exception as exc:  # pragma: no cover - safety
        app.logger.exception("Metadata fetch failed: %s", exc)
        return _json_error("Unexpected error while fetching metadata.", 500, "unexpected_error")

    payload = asdict(metadata) if metadata else {}
    return _json_success(payload)


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _current_user() -> User | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    user = db.session.get(User, user_id)
    if user is None:
        session.pop("user_id", None)
        session.pop("user_name", None)
    return user


def _auth_context(
    *,
    login_errors=None,
    signup_errors=None,
    login_defaults=None,
    signup_defaults=None,
):
    return render_template(
        "login.html",
        active_page="auth",
        login_errors=login_errors,
        signup_errors=signup_errors,
        login_defaults=login_defaults or {"username": ""},
        signup_defaults=signup_defaults
        or {"full_name": "", "email": "", "username": ""},
        password_reset_url=None,
        signup_action=url_for("signup"),
        login_action=url_for("login"),
    )


def _prediction_payload_from_request() -> Dict[str, str]:
    """Return a dict of flattened request data suitable for predictors."""
    if request.is_json:
        raw = request.get_json(silent=True) or {}
    else:
        raw = request.form.to_dict(flat=True) if request.form else {}

    payload: Dict[str, str] = {}
    for key, value in raw.items():
        if value is None:
            continue
        payload[key] = value if isinstance(value, str) else str(value)
    return payload


def _json_error(message: str, status_code: int, error_type: str = "validation_error"):
    return (
        jsonify({"status": "error", "error": {"type": error_type, "message": message}}),
        status_code,
    )


def _json_success(data: Dict[str, object], status_code: int = 200):
    return jsonify({"status": "ok", "data": data}), status_code


def _serialize_purchase_month(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    converter = getattr(value, "isoformat", None)
    if callable(converter):
        return converter()
    return str(value)


@app.context_processor
def inject_chatbot_flags():
    """Expose chatbot availability to templates."""
    enabled = bool(app.config.get("OPENAI_API_KEY"))
    return {
        "chatbot_enabled": enabled,
        "chatbot_title": app.config.get("CHATBOT_TITLE", "HDB Resale Assistant"),
    }


def _ensure_prediction_history_schema() -> None:
    """Ensure latest columns exist when migrations aren't run."""
    global _PREDICTION_SCHEMA_CHECKED
    if _PREDICTION_SCHEMA_CHECKED:
        return
    inspector = db.inspect(db.engine)
    columns = {col["name"] for col in inspector.get_columns("prediction_history")}
    if "model_insights" not in columns:
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE prediction_history ADD COLUMN model_insights TEXT"))
    _PREDICTION_SCHEMA_CHECKED = True


def _save_prediction_history(
    form_values: Dict[str, str],
    predicted_price: float,
    *,
    model_insights: str | None = None,
) -> PredictionHistory | None:
    """Persist a prediction for the current user if available."""
    user = _current_user()
    _ensure_prediction_history_schema()

    payload_keys = [
        "town",
        "flat_type",
        "flat_model",
        "storey_range",
        "floor_area_sqm",
        "lease_commence_date",
        "transaction_year",
        "transaction_month",
    ]
    payload = {key: form_values.get(key) for key in payload_keys}

    town = payload.get("town") or ""
    flat_type = payload.get("flat_type") or ""
    flat_model = payload.get("flat_model") or ""
    storey_range = payload.get("storey_range") or ""
    floor_area = _safe_float(payload.get("floor_area_sqm"))
    lease_commence_year = _safe_int(payload.get("lease_commence_date"))
    transaction_year = _safe_int(payload.get("transaction_year"))
    transaction_month = _safe_int(payload.get("transaction_month"))

    payload.update(
        {
            "floor_area_sqm": floor_area,
            "lease_commence_date": lease_commence_year,
            "transaction_year": transaction_year,
            "transaction_month": transaction_month,
        }
    )

    history_entry = PredictionHistory(
        user_id=user.id if user else None,
        town=town,
        flat_type=flat_type,
        flat_model=flat_model,
        storey_range=storey_range,
        floor_area_sqm=floor_area,
        lease_commence_year=lease_commence_year,
        transaction_year=transaction_year,
        transaction_month=transaction_month,
        predicted_price=predicted_price,
        feature_payload=payload,
        model_insights=model_insights,
    )
    db.session.add(history_entry)
    try:
        db.session.commit()
        db.session.refresh(history_entry)
        return history_entry
    except SQLAlchemyError:
        db.session.rollback()
        return None


def _build_prediction_output(form_values: Dict[str, str]) -> Dict[str, object]:
    """Run the prediction pipeline and return view-friendly structures."""
    prediction_result: Dict[str, object] | None = None
    comparison_bars: List[Dict[str, object]] = []
    shap_image = None
    town_price_chart = None
    errors: List[str] = []
    predicted_price: float | None = None
    remaining_lease_months: float | None = None

    try:
        result = predict_price(form_values)
        predicted_price = result["predicted_price"]
        remaining_lease_months = result["remaining_lease_months"]
        area_sqm = _safe_float(form_values.get("floor_area_sqm"))
        price_per_sqm_value = predicted_price / area_sqm if area_sqm else None
        price_per_sqm_display = (
            f"S${price_per_sqm_value:,.0f} / sqm" if price_per_sqm_value is not None else None
        )
        prediction_result = {
            "price": f"S${predicted_price:,.0f}",
            "price_per_sqm": price_per_sqm_display,
            "price_per_sqm_raw": price_per_sqm_value,
            "details": [
                f"Lease age at transaction: {result['lease_age_years']} years",
                f"Remaining lease: {remaining_lease_months:,} months ({int((remaining_lease_months or 0) // 12)} years)",
                f"Average storey height: {result['storey_midpoint']:.1f}",
            ],
        }
        scenarios = [
            ("Baseline forecast", predicted_price),
            ("Optimistic (+5%)", predicted_price * 1.05),
            ("Conservative (-5%)", predicted_price * 0.95),
        ]
        max_value = max(value for _, value in scenarios) or 1
        comparison_bars = [
            {"label": label, "value": f"S${value:,.0f}", "percent": int((value / max_value) * 100)}
            for label, value in scenarios
        ]
        prepared = result.pop("prepared_features", None)
    except (PredictionError, ModelPackageError) as exc:
        errors.append(str(exc))
        prepared = None

    if prediction_result:
        if prepared:
            try:
                shap_image = generate_shap_image(prepared)
            except Exception as exc:  # pragma: no cover
                errors.append(f"Unable to render SHAP chart: {exc}")

        try:
            town_price_chart = generate_town_price_chart(
                form_values.get("flat_type", ""),
                form_values.get("flat_model", ""),
                form_values.get("town", ""),
            )
        except Exception as exc:  # pragma: no cover
            errors.append(f"Unable to render town comparison chart: {exc}")

        try:
            demand_prediction = predict_demand(form_values)
        except (PredictionError, ModelPackageError) as exc:
            demand_prediction = None
            errors.append(f"Demand prediction unavailable: {exc}")
        else:
            prediction_result["demand"] = demand_prediction

        try:
            exit_outlook = predict_exit_value_outlook(
                form_values,
                predicted_price,
                remaining_lease_months=remaining_lease_months or 0,
            )
        except (PredictionError, ModelPackageError) as exc:
            errors.append(f"Exit outlook unavailable: {exc}")
        else:
            purchase_month_label = exit_outlook["purchase_month"].strftime("%b %Y")
            range_display = (
                f"S${exit_outlook['lower_band']:,.0f} to S${exit_outlook['upper_band']:,.0f}"
            )
            prediction_result["exit_outlook"] = {
                **exit_outlook,
                "exit_price_display": f"S${exit_outlook['exit_price']:,.0f}",
                "profit_display": f"S${exit_outlook['profit']:,.0f}",
                "pct_gain_display": f"{exit_outlook['pct_gain']:+.1f}%",
                "purchase_price_display": f"S${exit_outlook['purchase_price']:,.0f}",
                "purchase_month_label": purchase_month_label,
                "exit_range_display": range_display,
                "demand_index_display": f"{exit_outlook['demand_index']:,.0f}",
                "gain_window_label": (
                    f"{abs(exit_outlook['pct_gain']):.1f}% "
                    f"{'gain' if exit_outlook['pct_gain'] >= 0 else 'downside'} window"
                ),
                "summary": (
                    "Model expects appreciation versus the assumed entry price."
                    if exit_outlook["profit"] >= 0
                    else "Model flags potential downside versus the assumed entry price."
                ),
                "status": "profit" if exit_outlook["profit"] >= 0 else "loss",
            }

    return {
        "prediction_result": prediction_result,
        "comparison_bars": comparison_bars,
        "shap_image": shap_image,
        "town_price_chart": town_price_chart,
        "errors": errors,
        "predicted_price": predicted_price,
    }


@app.context_processor
def inject_global_template_data():
    """Provide shared values for templates such as footer links and navigation."""
    user = _current_user()
    nav_links = [
        {
            "key": "home",
            "label": "Property Predictor",
            "endpoint": "index",
            "brand": True,
        },
        {
            "key": "predict",
            "label": "Predictor",
            "endpoint": "predict",
        },
    ]
    if user:
        nav_links.append(
            {
                "key": "profile",
                "label": "Profile",
                "endpoint": "profile",
            }
        )
    else:
        nav_links.append(
            {
                "key": "auth",
                "label": "Login/Signup",
                "endpoint": "login",
            }
        )

    return {
        "current_year": datetime.now(UTC).year,
        "footer_links": {
            "privacy": "#",
            "terms": "#",
            "contact": "#",
        },
        "current_user": user,
        "nav_links": nav_links,
    }


@app.route("/")
def index():
    landing_features = [
        {
            "title": "Guided Predictions",
            "description": "Step through key HDB attributes to produce accurate resale value forecasts.",
        },
        {
            "title": "Scenario Planning",
            "description": "Compare different flat configurations side by side before committing to a decision.",
        },
        {
            "title": "Secure History",
            "description": "Save, revisit, and manage past predictions for your clients or personal records.",
        },
    ]
    return render_template(
        "index.html",
        active_page="home",
        landing_features=landing_features,
        hero_image_url=None,
    )



@app.route("/predict", methods=["GET", "POST"])
def predict():
    metadata = get_prediction_metadata()

    def _build_select_options(options: List[str], selected: str):
        return [{"label": option, "value": option, "selected": option == selected} for option in options]

    def _wtforms_choices(options: List[str]):
        return [(option, option) for option in options]

    posted_form_mode = request.form.get("form_mode") if request.method == "POST" else None
    form_mode = posted_form_mode if posted_form_mode in {"predict", "budget"} else "predict"

    prediction_form = PredictionForm(
        formdata=request.form if request.method == "POST" and form_mode == "predict" else None
    )
    budget_form = BudgetForm(formdata=request.form if request.method == "POST" and form_mode == "budget" else None)
    prediction_form.form_mode.data = "predict"
    budget_form.form_mode.data = "budget"
    prediction_form.use_average_floor_area.data = prediction_form.use_average_floor_area.data or ""

    prediction_result: Dict | None = None
    model_insights: str | None = None
    model_insights_error: str | None = None
    comparison_bars: List[Dict] = []
    shap_image: str | None = None
    town_price_chart: str | None = None
    budget_suggestions: List[Dict] | None = None
    form_errors: List[str] = []
    budget_errors: List[str] = []
    budget_flat_types = available_flat_types()
    floor_area_map = floor_area_lookup()
    applied_average_floor_area = False
    prediction_form.town.choices = _wtforms_choices(metadata.towns)
    prediction_form.flat_type.choices = _wtforms_choices(metadata.flat_types)
    prediction_form.flat_model.choices = _wtforms_choices(metadata.flat_models)
    prediction_form.storey_range.choices = _wtforms_choices(metadata.storey_ranges)
    budget_form.budget_flat_type.choices = _wtforms_choices(budget_flat_types)

    should_seed_prediction_defaults = request.method != "POST" or form_mode == "budget"
    if should_seed_prediction_defaults:
        if metadata.towns and not prediction_form.town.data:
            prediction_form.town.data = metadata.towns[0]
        if metadata.flat_types and not prediction_form.flat_type.data:
            preferred_flat_type = next(
                (
                    flat_type
                    for flat_type in metadata.flat_types
                    if flat_type.strip().lower() == DEFAULT_PREDICTION_FLAT_TYPE.lower()
                ),
                metadata.flat_types[0],
            )
            prediction_form.flat_type.data = preferred_flat_type
        if metadata.flat_models and not prediction_form.flat_model.data:
            prediction_form.flat_model.data = metadata.flat_models[0]
        if metadata.storey_ranges and not prediction_form.storey_range.data:
            prediction_form.storey_range.data = metadata.storey_ranges[0]
        if not prediction_form.lease_commence_date.data:
            prediction_form.lease_commence_date.data = metadata.lease_commence_max
        if not prediction_form.transaction_year.data:
            prediction_form.transaction_year.data = datetime.now(UTC).year
        if not prediction_form.transaction_month.data:
            prediction_form.transaction_month.data = datetime.now(UTC).month

    should_seed_budget_defaults = request.method != "POST" or form_mode != "budget"
    if should_seed_budget_defaults and not budget_form.budget_flat_type.data and budget_flat_types:
        budget_form.budget_flat_type.data = budget_flat_types[0]

    def _prediction_form_values() -> Dict[str, str]:
        return {
            "town": prediction_form.town.data or "",
            "flat_type": prediction_form.flat_type.data or "",
            "flat_model": prediction_form.flat_model.data or "",
            "storey_range": prediction_form.storey_range.data or "",
            "floor_area_sqm": (
                f"{float(prediction_form.floor_area_sqm.data):.1f}"
                if prediction_form.floor_area_sqm.data is not None
                else ""
            ),
            "lease_commence_date": str(prediction_form.lease_commence_date.data or ""),
            "transaction_year": str(prediction_form.transaction_year.data or ""),
            "transaction_month": str(prediction_form.transaction_month.data or ""),
        }

    def _budget_form_values() -> Dict[str, str]:
        if budget_form.budget.raw_data:
            budget_value = budget_form.budget.raw_data[0]
        elif budget_form.budget.data is not None:
            budget_value = f"{budget_form.budget.data}"
        else:
            budget_value = ""

        flat_type_value = budget_form.budget_flat_type.data
        if not flat_type_value and budget_flat_types:
            flat_type_value = budget_flat_types[0]

        return {
            "budget": budget_value,
            "flat_type": flat_type_value or "",
        }

    active_tab = "predict"
    budget_form_values = _budget_form_values()
    form_values = _prediction_form_values()
    current_avg_floor_area = average_floor_area(
        form_values.get("flat_type", ""),
        form_values.get("flat_model", ""),
        form_values.get("town", ""),
    )
    use_average_floor_area_flag = prediction_form.use_average_floor_area.data == "1"

    if request.method == "POST":
        if form_mode == "budget":
            active_tab = "budget"
            budget_form_values = _budget_form_values()
            if budget_form.validate_on_submit():
                budget_amount = float(budget_form.budget.data or 0)
                chosen_type = budget_form.budget_flat_type.data or budget_form_values["flat_type"]
                if budget_amount <= 0:
                    budget_form.budget.errors.append("Budget must be a positive number.")
                else:
                    budget_suggestions = suggest_by_budget(chosen_type, budget_amount, limit=10)
                    if not budget_suggestions:
                        budget_errors.append(
                            "No towns found within the specified budget for the selected flat type."
                        )
        else:
            use_average_floor_area_flag = prediction_form.use_average_floor_area.data == "1"
            prediction_form.use_average_floor_area.data = "1" if use_average_floor_area_flag else ""
            if prediction_form.validate_on_submit():
                selected_flat_type = prediction_form.flat_type.data or ""
                selected_town = prediction_form.town.data or ""
                selected_model = prediction_form.flat_model.data or ""
                average_area_value = average_floor_area(selected_flat_type, selected_model, selected_town)
                area_value = prediction_form.floor_area_sqm.data

                if use_average_floor_area_flag or area_value is None:
                    if average_area_value:
                        prediction_form.floor_area_sqm.data = average_area_value
                        applied_average_floor_area = True
                    else:
                        prediction_form.floor_area_sqm.errors.append(
                            "Average floor area is unavailable for the selected town and flat type. "
                            "Please provide a custom value."
                        )
                elif area_value is not None and float(area_value) <= 0:
                    prediction_form.floor_area_sqm.errors.append(
                        "Floor area must be a positive number. Alternatively, choose the average option."
                    )

                if not prediction_form.errors:
                    form_values = _prediction_form_values()
                    pipeline = _build_prediction_output(form_values)
                    prediction_result = pipeline["prediction_result"]
                    comparison_bars = pipeline["comparison_bars"]
                    shap_image = pipeline["shap_image"]
                    town_price_chart = pipeline["town_price_chart"]
                    form_errors.extend(pipeline["errors"])
                    history_entry = None

                    if prediction_result and pipeline["predicted_price"] is not None:
                        history_entry = _save_prediction_history(form_values, pipeline["predicted_price"])
                        if history_entry is None:
                            form_errors.append("Prediction generated but could not be saved to history.")

                    if prediction_result:
                        form_values_for_insights = _prediction_form_values()
                        try:
                            model_insights = generate_prediction_insights(
                                prediction_result=prediction_result,
                                form_values=form_values_for_insights,
                                comparison_bars=comparison_bars,
                            )
                        except ChatbotError as exc:
                            model_insights_error = str(exc)
                        else:
                            if history_entry and model_insights:
                                history_entry.model_insights = model_insights
                                try:
                                    db.session.commit()
                                except SQLAlchemyError:
                                    db.session.rollback()
                                    form_errors.append("Prediction saved but insights could not be stored.")

    if applied_average_floor_area:
        use_average_floor_area_flag = True

    form_values = _prediction_form_values()
    form_values["use_average_floor_area"] = "1" if use_average_floor_area_flag else ""
    prediction_form.use_average_floor_area.data = form_values["use_average_floor_area"]
    current_avg_floor_area = average_floor_area(
        form_values.get("flat_type", ""),
        form_values.get("flat_model", ""),
        form_values.get("town", ""),
    )

    prediction_fields = [
        {
            "id": "town",
            "label": "Town",
            "name": "town",
            "type": "select",
            "options": _build_select_options(metadata.towns, form_values.get("town", "")),
            "errors": prediction_form.town.errors,
        },
        {
            "id": "flat_type",
            "label": "Flat type",
            "name": "flat_type",
            "type": "select",
            "options": _build_select_options(metadata.flat_types, form_values.get("flat_type", "")),
            "errors": prediction_form.flat_type.errors,
        },
        {
            "id": "flat_model",
            "label": "Flat model",
            "name": "flat_model",
            "type": "select",
            "options": _build_select_options(metadata.flat_models, form_values.get("flat_model", "")),
            "errors": prediction_form.flat_model.errors,
        },
        {
            "id": "storey_range",
            "label": "Storey range",
            "name": "storey_range",
            "type": "select",
            "options": _build_select_options(metadata.storey_ranges, form_values.get("storey_range", "")),
            "help_text": "Select the band that matches the resale listing.",
            "errors": prediction_form.storey_range.errors,
        },
        {
            "id": "floor_area_sqm",
            "label": "Floor area (sqm)",
            "name": "floor_area_sqm",
            "type": "number",
            "placeholder": f"{metadata.floor_area_min:.0f}",
            "value": form_values.get("floor_area_sqm", ""),
            "min": f"{metadata.floor_area_min:.1f}",
            "max": f"{metadata.floor_area_max:.1f}",
            "step": "0.1",
            "help_text": (
                f"Average for selected town/type: {current_avg_floor_area:.1f} sqm"
                if current_avg_floor_area
                else "Enter your estimate or use the average size for this combination."
            ),
            "errors": prediction_form.floor_area_sqm.errors,
        },
        {
            "id": "lease_commence_date",
            "label": "Lease commence year",
            "name": "lease_commence_date",
            "type": "number",
            "placeholder": str(metadata.lease_commence_min),
            "value": form_values.get("lease_commence_date", ""),
            "min": str(metadata.lease_commence_min),
            "max": str(metadata.lease_commence_max),
            "errors": prediction_form.lease_commence_date.errors,
        },
        {
            "id": "transaction_year",
            "label": "Transaction year",
            "name": "transaction_year",
            "type": "number",
            "value": form_values.get("transaction_year", ""),
            "errors": prediction_form.transaction_year.errors,
        },
        {
            "id": "transaction_month",
            "label": "Transaction month",
            "name": "transaction_month",
            "type": "number",
            "value": form_values.get("transaction_month", ""),
            "min": "1",
            "max": "12",
            "errors": prediction_form.transaction_month.errors,
        },
    ]

    return render_template(
        "predict.html",
        active_page="predict",
        prediction_fields=prediction_fields,
        prediction_result=prediction_result,
        comparison_bars=comparison_bars,
        form_errors=form_errors,
        form_action=url_for("predict"),
        metadata=metadata,
        form_values=form_values,
        shap_image=shap_image,
        town_price_chart=town_price_chart,
        model_insights=model_insights,
        model_insights_error=model_insights_error,
        budget_errors=budget_errors,
        budget_flat_types=budget_flat_types,
        budget_form_values=budget_form_values,
        budget_suggestions=budget_suggestions,
        active_tab=active_tab,
        floor_area_lookup=floor_area_map,
        current_avg_floor_area=current_avg_floor_area,
        use_average_floor_area=use_average_floor_area_flag,
        prediction_form=prediction_form,
        budget_form=budget_form,
    )



@app.route("/profile", methods=["GET", "POST"])
def profile():
    user = _current_user()
    if not user:
        return redirect(url_for("login"))

    initial_defaults = {
        "full_name": user.full_name or "",
        "email": user.email or "",
        "username": user.username or "",
    }
    profile_form = ProfileForm(data=initial_defaults)
    profile_form.email.data = (profile_form.email.data or "").lower()

    profile_errors: List[str] = []
    profile_success = False

    if request.method == "POST" and request.form.get("form_type") == "update_profile":
        profile_form = ProfileForm()

        if profile_form.validate_on_submit():
            original_full_name = user.full_name or ""
            full_name = (profile_form.full_name.data or "").strip()
            email = (profile_form.email.data or "").strip().lower()
            username = (profile_form.username.data or "").strip()
            new_password = profile_form.new_password.data or ""
            confirm_password = profile_form.confirm_password.data or ""
            password_verified_flag = (profile_form.password_verified.data or "").strip()

            session_verified = session.get("profile_password_verified")
            verified_timestamp = session.get("profile_password_last_verified")
            password_verified = False
            if password_verified_flag == "1" and session_verified:
                if verified_timestamp:
                    try:
                        verified_at = datetime.fromisoformat(verified_timestamp)
                    except ValueError:
                        verified_at = None
                    else:
                        if datetime.now(UTC) - verified_at <= timedelta(minutes=5):
                            password_verified = True

            if username and username != user.username:
                existing_username = User.query.filter_by(username=username).first()
                if existing_username and existing_username.id != user.id:
                    profile_errors.append("Username is already taken.")

            if email and email != user.email:
                existing_email = User.query.filter_by(email=email).first()
                if existing_email and existing_email.id != user.id:
                    profile_errors.append("Email is already registered.")

            changes_requested = (
                full_name != original_full_name
                or email != user.email
                or username != user.username
                or bool(new_password)
                or bool(confirm_password)
            )

            if changes_requested and not password_verified:
                profile_errors.append("Please verify your password before updating your profile.")

            if new_password or confirm_password:
                if len(new_password) < 8:
                    profile_errors.append("New password must be at least 8 characters long.")
                if new_password != confirm_password:
                    profile_errors.append("New password and confirmation do not match.")

            if not profile_errors:
                user.full_name = full_name or None
                user.email = email
                user.username = username

                if new_password:
                    user.set_password(new_password)

                try:
                    db.session.commit()
                except IntegrityError:
                    db.session.rollback()
                    profile_errors.append("Unable to update profile: duplicate username or email.")
                except SQLAlchemyError:
                    db.session.rollback()
                    profile_errors.append("Unable to update profile right now. Please try again.")
                else:
                    profile_success = True
                    profile_form = ProfileForm(
                        data={
                            "full_name": user.full_name or "",
                            "email": user.email or "",
                            "username": user.username or "",
                        }
                    )
                    profile_form.email.data = (profile_form.email.data or "").lower()
                    session["user_name"] = user.full_name or user.username
                    session.pop("profile_password_verified", None)
                    session.pop("profile_password_last_verified", None)
        else:
            profile_errors.extend(profile_form.errors.get("email", []))
            profile_errors.extend(profile_form.errors.get("username", []))

    predictions = (
        user.predictions.order_by(PredictionHistory.created_at.desc()).all()
        if hasattr(user.predictions, "order_by")
        else user.predictions
    )
    prediction_history = []
    for record in predictions:
        created_display = _format_singapore_time(getattr(record, "created_at", None))
        prediction_history.append(
            {
                "id": record.id,
                "fields": [
                    created_display,
                    record.town,
                    record.flat_type,
                    record.flat_model,
                    record.storey_range,
                    f"{record.floor_area_sqm:.1f}",
                    record.lease_commence_year,
                    record.transaction_year,
                    f"{record.transaction_month:02d}",
                    f"S${record.predicted_price:,.0f}",
                ],
                "actions": (
                    {
                        "delete_url": url_for(
                            "delete_prediction",
                            prediction_id=record.id,
                        ),
                    }
                    if record.id is not None
                    else None
                ),
            }
        )

    headings = [
        "Predicted On",
        "Town",
        "Flat Type",
        "Flat Model",
        "Storey Range",
        "Floor Area (sqm)",
        "Lease Commence Year",
        "Transaction Year",
        "Transaction Month",
        "Predicted Price",
        "Actions",
    ]
    return render_template(
        "profile.html",
        active_page="profile",
        prediction_history=prediction_history,
        history_headings=headings,
        user=user,
        profile_errors=profile_errors or None,
        profile_success_message="Profile updated successfully." if profile_success else None,
        profile_form=profile_form,
    )


@app.route("/profile/verify-password", methods=["POST"])
def verify_profile_password():
    user = _current_user()
    if not user:
        return jsonify({"ok": False, "message": "Please log in again."}), 401

    password = (request.form.get("password") or "").strip()
    if not password:
        return jsonify({"ok": False, "message": "Please enter your password."}), 400

    if not user.check_password(password):
        return jsonify({"ok": False, "message": "Password is incorrect."}), 400

    session["profile_password_verified"] = True
    session["profile_password_last_verified"] = datetime.now(UTC).isoformat()
    return jsonify({"ok": True, "message": "Password verified. You may edit your details now."})


@app.route("/prediction/<int:prediction_id>/detail")
def prediction_detail(prediction_id: int):
    """Return saved prediction output for modal display."""
    user = _current_user()
    if not user:
        abort(401)

    record = PredictionHistory.query.get_or_404(prediction_id)
    if record.user_id != user.id:
        abort(403)

    payload = record.feature_payload or {}
    form_values = {}
    for key, value in payload.items():
        if value is None:
            form_values[key] = ""
        elif key == "floor_area_sqm":
            form_values[key] = f"{float(value):.1f}"
        else:
            form_values[key] = str(value)

    pipeline = _build_prediction_output(form_values)
    prediction_result = pipeline["prediction_result"]
    comparison_bars = pipeline["comparison_bars"]
    shap_image = pipeline["shap_image"]
    town_price_chart = pipeline["town_price_chart"]
    errors = pipeline["errors"]

    html = render_template(
        "includes/prediction_detail_modal.html",
        prediction_result=prediction_result,
        comparison_bars=comparison_bars,
        shap_image=shap_image,
        town_price_chart=town_price_chart,
        model_insights=record.model_insights,
        model_insights_error=None if record.model_insights else "Insights were not captured for this prediction.",
        errors=errors,
        history_record=record,
    )
    title_suffix = _format_singapore_time(record.created_at)
    title = f"Prediction • {record.town}" if title_suffix == "—" else f"Prediction • {record.town} • {title_suffix}"
    return jsonify({"html": html, "title": title})


@app.route("/history")
def history():
    """Backward-compatible route that redirects to the profile view."""
    return redirect(url_for("profile"))


@app.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    session.pop("user_name", None)
    return redirect(url_for("login"))



@app.route("/login", methods=["GET", "POST"])
def login():
    login_errors: List[str] = []
    login_defaults = {"username": request.form.get("username", "").strip()}

    if request.method == "POST":
        username = login_defaults["username"]
        password = request.form.get("password", "")
        user = User.query.filter_by(username=username).first()
        if not user or not user.check_password(password):
            login_errors.append("Invalid username or password.")
        else:
            session["user_id"] = user.id
            session["user_name"] = user.full_name or user.username
            return redirect(url_for("profile"))

    return _auth_context(
        login_errors=login_errors or None,
        login_defaults=login_defaults,
    )



@app.route("/signup", methods=["POST"])
def signup():
    signup_errors: List[str] = []
    full_name = request.form.get("full_name", "").strip()
    email = (request.form.get("email", "") or "").strip().lower()
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    confirm_password = request.form.get("confirm_password", "")

    signup_defaults = {
        "full_name": full_name,
        "email": email,
        "username": username,
    }

    if not username:
        signup_errors.append("Username is required.")
    if not email:
        signup_errors.append("Email is required.")
    if not password:
        signup_errors.append("Password is required.")
    if password and len(password) < 8:
        signup_errors.append("Password must be at least 8 characters long.")
    if password != confirm_password:
        signup_errors.append("Passwords do not match.")

    if signup_errors:
        return _auth_context(
            signup_errors=signup_errors,
            signup_defaults=signup_defaults,
        )

    user = User(
        username=username,
        email=email,
        full_name=full_name or None,
    )
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        signup_errors.append("Username or email already exists.")
        return _auth_context(
            signup_errors=signup_errors,
            signup_defaults=signup_defaults,
        )
    except SQLAlchemyError:
        db.session.rollback()
        signup_errors.append("Unable to create account right now. Please try again.")
        return _auth_context(
            signup_errors=signup_errors,
            signup_defaults=signup_defaults,
        )

    session["user_id"] = user.id
    session["user_name"] = user.full_name or user.username
    return redirect(url_for("profile"))


@app.route("/profile/<int:prediction_id>/delete", methods=["POST"])
def delete_prediction(prediction_id: int):
    user = _current_user()
    is_async = request.headers.get("X-Requested-With") == "XMLHttpRequest"
    if not user:
        if is_async:
            return jsonify({"ok": False, "message": "Please log in again."}), 401
        return redirect(url_for("login"))

    record = PredictionHistory.query.filter_by(id=prediction_id, user_id=user.id).first()
    if record is None:
        if is_async:
            return jsonify({"ok": False, "message": "Prediction not found."}), 404
        abort(404)

    db.session.delete(record)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        if is_async:
            return jsonify({"ok": False, "message": "Unable to delete prediction right now."}), 500
        abort(500)

    if is_async:
        return jsonify({"ok": True, "deleted_id": prediction_id})
    return redirect(url_for("profile", _anchor="prediction-history"))


@app.route("/history/<int:prediction_id>/delete", methods=["POST"])
def legacy_delete_prediction(prediction_id: int):
    """Backward-compatible delete endpoint for legacy links."""
    return delete_prediction(prediction_id)


@app.route("/profile/delete-selected", methods=["POST"])
def delete_selected_predictions():
    user = _current_user()
    if not user:
        return redirect(url_for("login"))

    raw_ids = request.form.getlist("prediction_ids")
    prediction_ids = []
    for raw_id in raw_ids:
        parsed = _safe_int(raw_id)
        if parsed:
            prediction_ids.append(parsed)

    if not prediction_ids:
        return redirect(url_for("profile", _anchor="prediction-history"))

    records = (
        PredictionHistory.query.filter(
            PredictionHistory.user_id == user.id,
            PredictionHistory.id.in_(prediction_ids),
        ).all()
    )

    for record in records:
        db.session.delete(record)

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        abort(500)

    return redirect(url_for("profile", _anchor="prediction-history"))


@app.route("/chatbot/message", methods=["POST"])
@csrf.exempt
def chatbot_message():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    page_context = (payload.get("page_context") or "").strip()

    try:
        reply = generate_chat_response(message, page_context)
    except ChatbotError as exc:
        status = 400 if message else 500
        return jsonify({"error": str(exc)}), status

    return jsonify({"reply": reply})


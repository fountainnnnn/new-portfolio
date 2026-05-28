from __future__ import annotations

import os
import re
from typing import Any, Dict, Iterable, List, Tuple

from flask import current_app
from openai import OpenAI
from markupsafe import Markup, escape

from application.services.chatbot import ChatbotError

_client_cache: Dict[str, OpenAI] = {}


def _get_openai_client() -> OpenAI:
    api_key = current_app.config.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ChatbotError("OpenAI API key is not configured. Insights are disabled.")
    if api_key not in _client_cache:
        _client_cache[api_key] = OpenAI(api_key=api_key)
    return _client_cache[api_key]


def _format_block(title: str, rows: Iterable[Tuple[str, Any]]) -> str:
    formatted_rows = [f"- {label}: {value}" for label, value in rows if value not in (None, "")]
    if not formatted_rows:
        return ""
    return f"{title}\n" + "\n".join(formatted_rows)


def _prediction_output_summary(prediction_result: Dict[str, Any], comparison_bars: List[Dict[str, Any]]) -> str:
    rows: List[Tuple[str, Any]] = [
        ("Price", prediction_result.get("price")),
        ("Price per sqm", prediction_result.get("price_per_sqm")),
    ]

    demand = prediction_result.get("demand") or {}
    if demand:
        rows.extend(
            [
                ("Demand label", demand.get("label")),
                ("Demand probability", demand.get("percentage")),
                ("Demand message", demand.get("message")),
            ]
        )

    exit_outlook = prediction_result.get("exit_outlook") or {}
    if exit_outlook:
        rows.extend(
            [
                ("Exit price", exit_outlook.get("exit_price_display")),
                ("Profit/Loss", exit_outlook.get("profit_display")),
                ("Exit range", exit_outlook.get("exit_range_display")),
                ("Gain window", exit_outlook.get("gain_window_label")),
                ("Summary", exit_outlook.get("summary")),
            ]
        )

    for detail in prediction_result.get("details") or []:
        rows.append(("Detail", detail))

    if comparison_bars:
        scenario_line = "; ".join(
            f"{bar.get('label')}: {bar.get('value')}" for bar in comparison_bars if bar.get("label")
        )
        rows.append(("Scenario bars", scenario_line))

    return _format_block("Prediction outputs", rows)


def _prediction_input_summary(form_values: Dict[str, Any]) -> str:
    label_map = {
        "town": "Town",
        "flat_type": "Flat type",
        "flat_model": "Flat model",
        "storey_range": "Storey range",
        "floor_area_sqm": "Floor area (sqm)",
        "lease_commence_date": "Lease commence year",
        "transaction_year": "Transaction year",
        "transaction_month": "Transaction month",
    }
    ordered_rows = [(human_label, form_values.get(field)) for field, human_label in label_map.items()]
    return _format_block("User-specified inputs", ordered_rows)


def _render_inline(text: str) -> str:
    segments: List[str] = []
    last_end = 0
    for match in re.finditer(r"\*\*(.+?)\*\*", text):
        segments.append(escape(text[last_end:match.start()]))
        segments.append(f"<strong>{escape(match.group(1))}</strong>")
        last_end = match.end()
    segments.append(escape(text[last_end:]))
    return "".join(segments)


def _format_insights_html(raw_text: str) -> Markup:
    lines = [line.strip() for line in raw_text.splitlines()]
    sections: List[Dict[str, Any]] = []
    current: Dict[str, Any] | None = None

    def _flush():
        if current and (current.get("bullets") or current.get("paragraphs")):
            sections.append(current.copy())

    for line in lines:
        if not line:
            continue
        if line.startswith("#"):
            _flush()
            current = {"title": line.lstrip("# ").strip() or "Insights", "bullets": [], "paragraphs": []}
            continue
        if current is None:
            current = {"title": "Model insights", "bullets": [], "paragraphs": []}
        if line.startswith("-"):
            current["bullets"].append(line.lstrip("- ").strip())
        else:
            current.setdefault("paragraphs", []).append(line)
    _flush()

    if not sections:
        return Markup(f"<p>{escape(raw_text)}</p>")

    html_parts: List[str] = []
    for section in sections:
        html_parts.append("<div class=\"model-insights-card__section\">")
        html_parts.append(f"<h4 class=\"model-insights-card__section-title\">{escape(section.get('title') or '')}</h4>")
        for paragraph in section.get("paragraphs", []):
            html_parts.append(f"<p>{_render_inline(paragraph)}</p>")
        bullets = section.get("bullets") or []
        if bullets:
            html_parts.append("<ul>")
            for bullet in bullets:
                html_parts.append(f"<li>{_render_inline(bullet)}</li>")
            html_parts.append("</ul>")
        html_parts.append("</div>")
    return Markup("".join(html_parts))


def generate_prediction_insights(
    *,
    prediction_result: Dict[str, Any],
    form_values: Dict[str, Any],
    comparison_bars: List[Dict[str, Any]] | None = None,
) -> Markup:
    if not prediction_result:
        raise ChatbotError("Prediction results missing for insights.")

    outputs_section = _prediction_output_summary(prediction_result, comparison_bars or [])
    inputs_section = _prediction_input_summary(form_values)
    context_blob = "\n\n".join([section for section in [outputs_section, inputs_section] if section]).strip()
    if not context_blob:
        raise ChatbotError("Insufficient data for insight generation.")

    model_name = current_app.config.get("OPENAI_INSIGHTS_MODEL") or current_app.config.get(
        "OPENAI_CHAT_MODEL", "gpt-4o-mini"
    )

    system_prompt = (
        "You are an HDB resale market strategist. Analyse quantitative results from a prediction engine "
        "and craft short, high-impact insights for buyers in Singapore. Highlight pricing context, "
        "risk/upsides, and practical levers (storey, town traits, lease age). Avoid repeating raw numbers verbatim."
    )

    user_prompt = (
        "Context:\n"
        f"{context_blob}\n\n"
        "Instructions:\n"
        "- Provide two sections titled 'Model insights' and 'Next-step suggestions'.\n"
        "- Each section should contain 2-3 concise bullet points.\n"
        "- Reference notable metrics (price per sqm, demand probability, exit outlook) only when relevant.\n"
        "- Tie suggestions back to the provided town/flat specs when possible.\n"
        "- Be realistic and mention uncertainty when signals conflict.\n"
        "- Keep the entire response close to 200 words to avoid truncation."
    )

    try:
        client = _get_openai_client()
        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=300,
        )
    except Exception as exc:
        raise ChatbotError(f"Insights service temporarily unavailable: {exc}") from exc

    try:
        raw_text = completion.choices[0].message.content.strip()
        return _format_insights_html(raw_text)
    except (AttributeError, IndexError, KeyError) as exc:
        raise ChatbotError("Insights service returned an unexpected response.") from exc

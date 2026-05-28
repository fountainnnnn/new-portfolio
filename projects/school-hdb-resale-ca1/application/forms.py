from __future__ import annotations

from decimal import Decimal

from flask_wtf import FlaskForm
from wtforms import DecimalField, HiddenField, IntegerField, PasswordField, SelectField, StringField, ValidationError
from wtforms.validators import DataRequired, Email, Length, NumberRange, Optional


def _strip_text(value):
    if isinstance(value, str):
        return value.strip()
    return value


def _normalize_flag(value):
    if isinstance(value, str):
        value = value.strip().lower()
        return "1" if value in {"1", "true", "yes", "on"} else ""
    return "1" if value else ""


def _strip_commas(value):
    if isinstance(value, str):
        return value.replace(",", "").strip()
    return value


class PredictionForm(FlaskForm):
    """WTForms form for the full prediction workflow."""

    form_mode = HiddenField(default="predict", filters=[_strip_text])
    town = SelectField("Town", validators=[DataRequired()], filters=[_strip_text])
    flat_type = SelectField("Flat type", validators=[DataRequired()], filters=[_strip_text])
    flat_model = SelectField("Flat model", validators=[DataRequired()], filters=[_strip_text])
    storey_range = SelectField("Storey range", validators=[DataRequired()], filters=[_strip_text])
    floor_area_sqm = DecimalField(
        "Floor area (sqm)",
        places=1,
        rounding=None,
        filters=[_strip_commas],
        validators=[Optional(), NumberRange(min=Decimal("0.1"), message="Floor area must be positive.")],
    )
    lease_commence_date = IntegerField("Lease commence year", validators=[DataRequired()])
    transaction_year = IntegerField("Transaction year", validators=[DataRequired()])
    transaction_month = IntegerField(
        "Transaction month",
        validators=[
            DataRequired(),
            NumberRange(min=1, max=12, message="Month must be between 1 and 12."),
        ],
    )
    use_average_floor_area = HiddenField(default="", filters=[_normalize_flag])

    def validate_transaction_year(self, field):
        lease_year = self.lease_commence_date.data
        transaction_year = field.data
        if lease_year is None or transaction_year is None:
            return
        if transaction_year < lease_year:
            raise ValidationError(
                "Transaction year must not be earlier than the lease commence year."
            )


class BudgetForm(FlaskForm):
    """WTForms form for the budget suggestion workflow."""

    form_mode = HiddenField(default="budget", filters=[_strip_text])
    budget = DecimalField(
        "Available budget (S$)",
        places=0,
        rounding=None,
        filters=[_strip_commas],
        validators=[
            DataRequired(message="Budget is required."),
            NumberRange(min=1, message="Budget must be a positive number."),
        ],
    )
    budget_flat_type = SelectField(
        "Desired flat type",
        validators=[DataRequired()],
        filters=[_strip_text],
    )


class ProfileForm(FlaskForm):
    """WTForms form for updating the user profile."""

    form_type = HiddenField(default="update_profile", filters=[_strip_text])
    password_verified = HiddenField(default="", filters=[_normalize_flag])
    full_name = StringField("Full name", filters=[_strip_text])
    email = StringField("Email", validators=[DataRequired(message="Email is required."), Email()], filters=[_strip_text])
    username = StringField("Username", validators=[DataRequired(message="Username is required.")], filters=[_strip_text])
    current_password = PasswordField("Current password")
    new_password = PasswordField("New password")
    confirm_password = PasswordField("Confirm new password")

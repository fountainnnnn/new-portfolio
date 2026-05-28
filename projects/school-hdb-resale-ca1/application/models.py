"""Database models for users and prediction history."""

from __future__ import annotations

from datetime import UTC, datetime

from werkzeug.security import check_password_hash, generate_password_hash

from application import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), nullable=False)

    predictions = db.relationship(
        "PredictionHistory",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def set_password(self, password: str) -> None:
        """Hash and store the user's password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Validate a password against the stored hash."""
        return check_password_hash(self.password_hash, password)


class PredictionHistory(db.Model):
    __tablename__ = "prediction_history"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    town = db.Column(db.String(120), nullable=False)
    flat_type = db.Column(db.String(120), nullable=False)
    flat_model = db.Column(db.String(120), nullable=False)
    storey_range = db.Column(db.String(50), nullable=False)
    floor_area_sqm = db.Column(db.Float, nullable=False)
    lease_commence_year = db.Column(db.Integer, nullable=False)
    transaction_year = db.Column(db.Integer, nullable=False)
    transaction_month = db.Column(db.Integer, nullable=False)
    predicted_price = db.Column(db.Float, nullable=False)
    feature_payload = db.Column(db.JSON, nullable=False)
    model_insights = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), nullable=False)

    user = db.relationship("User", back_populates="predictions")

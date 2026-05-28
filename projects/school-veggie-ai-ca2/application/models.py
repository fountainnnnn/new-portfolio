"""Database models for profile information and prediction history."""

from __future__ import annotations

from datetime import UTC, datetime

from werkzeug.security import check_password_hash, generate_password_hash

from application import db


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        db.UniqueConstraint("oauth_provider", "oauth_subject", name="uq_users_oauth"),
    )

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    location = db.Column(db.String(120), nullable=True)
    preferred_model = db.Column(db.String(10), nullable=True)
    oauth_provider = db.Column(db.String(32), nullable=True, index=True)
    oauth_subject = db.Column(db.String(255), nullable=True, index=True)
    oauth_email_verified = db.Column(db.Boolean, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    password_set = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), nullable=False, index=True)

    predictions = db.relationship(
        "PredictionHistory",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    chat_threads = db.relationship(
        "ChatThread",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class PredictionHistory(db.Model):
    __tablename__ = "prediction_history"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)

    model = db.Column(db.String(10), nullable=False)
    label = db.Column(db.String(120), nullable=False, index=True)
    original_label = db.Column(db.String(120), nullable=True, index=True)
    is_corrected = db.Column(db.Boolean, default=False, nullable=False, index=True)
    corrected_at = db.Column(db.DateTime, nullable=True, index=True)
    confidence = db.Column(db.Float, nullable=False)
    sensitivity = db.Column(db.Float, nullable=True)

    top_k = db.Column(db.JSON, nullable=True)
    metrics = db.Column(db.JSON, nullable=True)
    compare = db.Column(db.JSON, nullable=True)

    image_bytes = db.Column(db.LargeBinary, nullable=True)
    image_mime = db.Column(db.String(80), nullable=True)
    image_filename = db.Column(db.String(255), nullable=True)
    image_sha256 = db.Column(db.String(64), nullable=True, index=True)
    image_size_bytes = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), nullable=False, index=True)

    user = db.relationship("User", back_populates="predictions")


class ChatThread(db.Model):
    __tablename__ = "chat_threads"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False, default="New chat")

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), nullable=False, index=True)

    user = db.relationship("User", back_populates="chat_threads")
    messages = db.relationship(
        "ChatMessage",
        back_populates="thread",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("chat_threads.id"), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), nullable=False, index=True)

    thread = db.relationship("ChatThread", back_populates="messages")

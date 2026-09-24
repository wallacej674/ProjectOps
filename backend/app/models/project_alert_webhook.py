from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectAlertWebhook(Base):
    """Per-Project outbound webhook settings for Health Alert open/recover notifications."""

    __tablename__ = "project_alert_webhooks"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_project_alert_webhooks_project_id"),
        CheckConstraint(
            "last_delivery_outcome is null or last_delivery_outcome in ('delivered', 'failed')",
            name="ck_project_alert_webhooks_last_delivery_outcome",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False, default="")
    last_delivery_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_delivery_transition: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_delivery_outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_delivery_http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_delivery_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

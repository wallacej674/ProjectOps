from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class HealthAlert(Base):
    __tablename__ = "health_alerts"
    __table_args__ = (
        CheckConstraint("status in ('active', 'recovered', 'closed')", name="ck_health_alert_status"),
        CheckConstraint("failure_count >= 2", name="ck_health_alert_failure_count"),
        CheckConstraint("closure_reason is null or closure_reason in ('target_changed', 'target_removed', 'project_archived')", name="ck_health_alert_closure_reason"),
        Index("uq_health_alert_active_project", "project_id", unique=True, postgresql_where=text("status = 'active'")),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    target_url: Mapped[str] = mapped_column(String(2048))
    status: Mapped[str] = mapped_column(String(16), default="active")
    first_failure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recovered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_check_id: Mapped[int] = mapped_column(ForeignKey("health_checks.id"))
    opening_check_id: Mapped[int] = mapped_column(ForeignKey("health_checks.id"))
    latest_check_id: Mapped[int] = mapped_column(ForeignKey("health_checks.id"))
    recovery_check_id: Mapped[int | None] = mapped_column(ForeignKey("health_checks.id"))
    failure_count: Mapped[int] = mapped_column(Integer, default=2)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    closure_reason: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HealthAlertEvidence(Base):
    __tablename__ = "health_alert_evidence"
    alert_id: Mapped[int] = mapped_column(ForeignKey("health_alerts.id"), primary_key=True)
    health_check_id: Mapped[int] = mapped_column(ForeignKey("health_checks.id"), primary_key=True)

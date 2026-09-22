from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CiStatusMonitorSchedule(Base):
    __tablename__ = "ci_status_monitor_schedules"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_ci_status_monitor_schedules_project_id"),
        CheckConstraint(
            "cadence_minutes in (15, 60, 360, 1440)",
            name="ck_ci_status_monitor_schedules_cadence",
        ),
        CheckConstraint(
            "last_outcome is null or last_outcome in "
            "('synced', 'no_runs_found', 'permission_missing', 'repo_not_found', 'sync_error')",
            name="ck_ci_status_monitor_schedules_last_outcome",
        ),
        CheckConstraint(
            "consecutive_sync_failures >= 0",
            name="ck_ci_status_monitor_schedules_consecutive_failures",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cadence_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Describes the SYNC ATTEMPT's outcome (did ProjectOps successfully talk to GitHub), not the
    # pipeline's own conclusion — those live on CiPipelineRun.conclusion, kept deliberately separate.
    last_outcome: Mapped[str | None] = mapped_column(String(32), nullable=True)
    consecutive_sync_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generation: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    claim_id: Mapped[str | None] = mapped_column(String(36))
    claim_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

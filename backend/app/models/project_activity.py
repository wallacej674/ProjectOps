from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectActivityCategory(str, Enum):
    project = "project"
    repository = "repository"
    codemap = "codemap"
    health = "health"
    readiness = "readiness"
    artifact = "artifact"
    evidence = "evidence"


class ProjectActivityEventType(str, Enum):
    project_created = "project_created"
    project_updated = "project_updated"
    project_archived = "project_archived"
    repository_attached = "repository_attached"
    repository_replaced = "repository_replaced"
    repository_removed = "repository_removed"
    codemap_analysis_completed = "codemap_analysis_completed"
    codemap_analysis_failed = "codemap_analysis_failed"
    code_risk_scan_imported = "code_risk_scan_imported"
    health_alert_opened = "health_alert_opened"
    health_alert_acknowledged = "health_alert_acknowledged"
    health_alert_recovered = "health_alert_recovered"
    health_alert_closed = "health_alert_closed"
    health_check_healthy = "health_check_healthy"
    health_check_unhealthy = "health_check_unhealthy"
    health_check_timeout = "health_check_timeout"
    health_check_error = "health_check_error"
    readiness_evaluated = "readiness_evaluated"
    readiness_manual_item_updated = "readiness_manual_item_updated"
    artifact_created = "artifact_created"
    artifact_updated = "artifact_updated"
    artifact_archived = "artifact_archived"
    readiness_artifact_linked = "readiness_artifact_linked"
    readiness_artifact_unlinked = "readiness_artifact_unlinked"


class ProjectActivityEvent(Base):
    __tablename__ = "project_activity_events"
    __table_args__ = (
        CheckConstraint(
            "event_category in ('project', 'repository', 'codemap', 'health', 'readiness', 'artifact', 'evidence')",
            name="ck_project_activity_events_category",
        ),
        CheckConstraint(
            "event_type in ("
            "'project_created', 'project_updated', 'project_archived', "
            "'repository_attached', 'repository_replaced', 'repository_removed', "
            "'codemap_analysis_completed', 'codemap_analysis_failed', 'code_risk_scan_imported', "
            "'health_alert_opened', 'health_alert_acknowledged', 'health_alert_recovered', 'health_alert_closed', "
            "'health_check_healthy', 'health_check_unhealthy', 'health_check_timeout', 'health_check_error', "
            "'readiness_evaluated', 'readiness_manual_item_updated', "
            "'artifact_created', 'artifact_updated', 'artifact_archived', "
            "'readiness_artifact_linked', 'readiness_artifact_unlinked'"
            ")",
            name="ck_project_activity_events_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    related_resource_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    related_resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ProjectArtifactType(str, Enum):
    note = "note"
    document = "document"
    link = "link"
    runbook = "runbook"
    decision = "decision"
    incident = "incident"
    requirement = "requirement"
    risk = "risk"
    evidence = "evidence"
    other = "other"


class ProjectArtifactSourceType(str, Enum):
    manual = "manual"
    external_url = "external_url"
    imported = "imported"
    system = "system"


class ProjectArtifactStatus(str, Enum):
    active = "active"
    archived = "archived"


class ProjectArtifact(Base):
    __tablename__ = "project_artifacts"
    __table_args__ = (
        CheckConstraint(
            "artifact_type in ('note', 'document', 'link', 'runbook', 'decision', 'incident', 'requirement', 'risk', 'evidence', 'other')",
            name="ck_project_artifacts_artifact_type",
        ),
        CheckConstraint(
            "source_type in ('manual', 'external_url', 'imported', 'system')",
            name="ck_project_artifacts_source_type",
        ),
        CheckConstraint(
            "status in ('active', 'archived')",
            name="ck_project_artifacts_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ProjectArtifactStatus.active.value,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by_user: Mapped["User | None"] = relationship("User")

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project_artifact import ProjectArtifact


class ReadinessItem(Base):
    __tablename__ = "readiness_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    evaluation_type: Mapped[str] = mapped_column(String(32), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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

    __table_args__ = (
        CheckConstraint(
            "evaluation_type in ('automatic', 'manual')",
            name="ck_readiness_items_evaluation_type",
        ),
    )


class ProjectReadinessItem(Base):
    __tablename__ = "project_readiness_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    readiness_item_id: Mapped[int] = mapped_column(
        ForeignKey("readiness_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    evidence: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    item: Mapped[ReadinessItem] = relationship()

    __table_args__ = (
        UniqueConstraint("project_id", "readiness_item_id", name="uq_project_readiness_items"),
        CheckConstraint(
            "status in ('passed', 'failed', 'unknown', 'not_applicable')",
            name="ck_project_readiness_items_status",
        ),
        CheckConstraint(
            "source in ('codemap', 'health_check', 'project', 'manual')",
            name="ck_project_readiness_items_source",
        ),
    )


class ProjectReadinessArtifactEvidence(Base):
    __tablename__ = "project_readiness_artifact_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    readiness_item_id: Mapped[int] = mapped_column(
        ForeignKey("readiness_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    artifact_id: Mapped[int] = mapped_column(
        ForeignKey("project_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    item: Mapped[ReadinessItem] = relationship()
    artifact: Mapped[ProjectArtifact] = relationship("ProjectArtifact")

    @property
    def item_key(self) -> str:
        return self.item.key

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "readiness_item_id",
            "artifact_id",
            name="uq_project_readiness_artifact_evidence",
        ),
    )

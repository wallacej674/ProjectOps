from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RepoAnalysisStatus(str, Enum):
    completed = "completed"
    failed = "failed"


class RepoAnalysis(Base):
    __tablename__ = "repo_analyses"
    __table_args__ = (
        CheckConstraint("status in ('completed', 'failed')", name="ck_repo_analyses_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    repo_integration_id: Mapped[int] = mapped_column(
        ForeignKey("repo_integrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_stack: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    detected_files: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    detected_folders: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    signals: Mapped[dict[str, bool]] = mapped_column(JSONB, nullable=False)
    warnings: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_files_scanned: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

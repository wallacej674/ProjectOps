from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RepoProvider(str, Enum):
    github = "github"


class RepoIntegration(Base):
    __tablename__ = "repo_integrations"
    __table_args__ = (
        CheckConstraint("provider in ('github')", name="ck_repo_integrations_provider"),
        UniqueConstraint("project_id", name="uq_repo_integrations_project_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default=RepoProvider.github.value)
    repo_owner: Mapped[str] = mapped_column(String(200), nullable=False)
    repo_name: Mapped[str] = mapped_column(String(200), nullable=False)
    repo_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    default_branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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

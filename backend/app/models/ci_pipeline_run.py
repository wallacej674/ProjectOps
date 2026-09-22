from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CiPipelineRun(Base):
    """One observed GitHub Actions workflow run. Upserted (not append-only) since a run
    transitions queued -> in_progress -> completed across polls and is re-observed each time."""

    __tablename__ = "ci_pipeline_runs"
    __table_args__ = (
        UniqueConstraint("repo_integration_id", "github_run_id", name="uq_ci_pipeline_runs_repo_run"),
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
    github_run_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    github_workflow_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    workflow_name: Mapped[str] = mapped_column(String(255), nullable=False)
    run_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Raw GitHub values (status: queued/in_progress/completed; conclusion: success/failure/
    # cancelled/skipped/timed_out/action_required/stale/neutral/...). Not CheckConstraint-enforced
    # since GitHub's conclusion vocabulary grows over time; tone normalization lives in the
    # service layer instead.
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    conclusion: Mapped[str | None] = mapped_column(String(32), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    commit_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    event: Mapped[str | None] = mapped_column(String(64), nullable=True)
    html_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    run_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    run_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

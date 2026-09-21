"""Durable, fenced single-call release reviews."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class RehearsalWorkflow(Base):
    __tablename__ = 'rehearsal_workflows'
    __table_args__ = (UniqueConstraint('created_by', 'request_key'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), index=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    request_key: Mapped[str] = mapped_column(String(36))
    digest: Mapped[str] = mapped_column(String(64))
    manifest: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(30), default='queued', index=True)
    fence: Mapped[int] = mapped_column(default=0)
    reserved_tokens: Mapped[int] = mapped_column(default=27576)
    output: Mapped[dict | None] = mapped_column(JSONB)
    usage: Mapped[dict | None] = mapped_column(JSONB)
    failure: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RehearsalWorkflowRequest(Base):
    __tablename__ = 'rehearsal_workflow_requests'
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    request_key: Mapped[str] = mapped_column(String(36), primary_key=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_workflows.id'), index=True)

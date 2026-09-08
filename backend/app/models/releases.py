"""Release intent is versioned independently of project-level readiness signals."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Release(Base):
    __tablename__ = 'releases'
    __table_args__ = (Index('uq_releases_active_project', 'project_id', unique=True, postgresql_where=text('is_active = true')),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), index=True)
    name: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(default=0)
    current_brief_revision: Mapped[int] = mapped_column(default=1)
    is_active: Mapped[bool] = mapped_column(default=True)
    archived: Mapped[bool] = mapped_column(default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReleaseBriefRevision(Base):
    __tablename__ = 'release_brief_revisions'
    __table_args__ = (UniqueConstraint('release_id', 'revision'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    revision: Mapped[int] = mapped_column()
    content: Mapped[dict] = mapped_column(JSONB)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_by: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class ReleaseRequirement(Base):
    __tablename__ = 'release_requirements'
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    current_revision: Mapped[int] = mapped_column(default=1)
    version: Mapped[int] = mapped_column(default=0)
    retired: Mapped[bool] = mapped_column(default=False)


class RequirementRevision(Base):
    __tablename__ = 'release_requirement_revisions'
    __table_args__ = (UniqueConstraint('requirement_id', 'revision'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey('release_requirements.id'), index=True)
    revision: Mapped[int] = mapped_column()
    brief_revision_id: Mapped[int] = mapped_column(ForeignKey('release_brief_revisions.id'))
    content: Mapped[dict] = mapped_column(JSONB)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_by: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class RequirementMaterial(Base):
    __tablename__ = 'release_requirement_materials'
    __table_args__ = (UniqueConstraint('requirement_revision_id', 'artifact_id', 'digest'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    requirement_revision_id: Mapped[int] = mapped_column(ForeignKey('release_requirement_revisions.id'), index=True)
    artifact_id: Mapped[int] = mapped_column(ForeignKey('project_artifacts.id'))
    snapshot: Mapped[dict] = mapped_column(JSONB)
    digest: Mapped[str] = mapped_column(String(64))
    linked_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

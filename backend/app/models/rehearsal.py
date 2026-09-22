"""Immutable release evidence and reviewed interpretations."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RehearsalScope(Base):
    __tablename__ = 'rehearsal_scopes'
    __table_args__ = (UniqueConstraint('release_id', 'version'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    version: Mapped[int] = mapped_column()
    brief_revision: Mapped[int] = mapped_column()
    source: Mapped[dict] = mapped_column(JSONB)
    environment: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RehearsalEvidence(Base):
    __tablename__ = 'rehearsal_evidence'
    __table_args__ = (UniqueConstraint('release_id', 'request_key'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey('release_requirements.id'), index=True)
    requirement_revision: Mapped[int] = mapped_column()
    requirement_revision_id: Mapped[int] = mapped_column(ForeignKey('release_requirement_revisions.id'))
    scope_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_scopes.id'))
    request_key: Mapped[str] = mapped_column(String(36))
    input_digest: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(30))
    origin: Mapped[str] = mapped_column(String(30))
    digest: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSONB)
    limitations: Mapped[list] = mapped_column(JSONB)
    material_id: Mapped[int | None] = mapped_column(ForeignKey('release_requirement_materials.id'))
    occurrence_id: Mapped[int | None] = mapped_column(ForeignKey('code_risk_occurrences.id'))
    health_check_id: Mapped[int | None] = mapped_column(ForeignKey('health_checks.id'))
    readiness_id: Mapped[int | None] = mapped_column(ForeignKey('project_readiness_items.id'))
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey('repo_analyses.id', ondelete='SET NULL'))
    ci_run_id: Mapped[int | None] = mapped_column(ForeignKey('ci_pipeline_runs.id', ondelete='SET NULL'))
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RehearsalAssessment(Base):
    __tablename__ = 'rehearsal_assessments'
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey('release_requirements.id'), index=True)
    requirement_revision: Mapped[int] = mapped_column()
    requirement_revision_id: Mapped[int] = mapped_column(ForeignKey('release_requirement_revisions.id'))
    scope_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_scopes.id'))
    outcome: Mapped[str] = mapped_column(String(30))
    rationale: Mapped[str] = mapped_column(String(2000))
    limitations: Mapped[list] = mapped_column(JSONB)
    version: Mapped[int] = mapped_column(default=0)
    review_status: Mapped[str] = mapped_column(String(30), default='proposed')
    provenance: Mapped[dict] = mapped_column(JSONB, default=lambda: {'origin': 'human'})
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssessmentEvidence(Base):
    __tablename__ = 'rehearsal_assessment_evidence'
    assessment_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_assessments.id'), primary_key=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_evidence.id'), primary_key=True)


class AssessmentReview(Base):
    __tablename__ = 'rehearsal_assessment_reviews'
    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_assessments.id'), index=True)
    action: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(String(2000))
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RequirementDisposition(Base):
    __tablename__ = 'rehearsal_dispositions'
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey('release_requirements.id'), index=True)
    requirement_revision: Mapped[int] = mapped_column()
    disposition: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(String(2000))
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RehearsalNextStep(Base):
    __tablename__ = 'rehearsal_next_steps'
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    content: Mapped[dict] = mapped_column(JSONB)
    version: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(30), default='proposed')
    provenance: Mapped[dict] = mapped_column(JSONB, default=lambda: {'origin': 'human'})
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NextStepRequirement(Base):
    __tablename__ = 'rehearsal_next_step_requirements'
    next_step_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_next_steps.id'), primary_key=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey('release_requirements.id'), primary_key=True)


class NextStepDependency(Base):
    __tablename__ = 'rehearsal_next_step_dependencies'
    next_step_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_next_steps.id'), primary_key=True)
    dependency_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_next_steps.id'), primary_key=True)


class NextStepReview(Base):
    __tablename__ = 'rehearsal_next_step_reviews'
    id: Mapped[int] = mapped_column(primary_key=True)
    next_step_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_next_steps.id'), index=True)
    status: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(String(2000))
    evidence_ids: Mapped[list] = mapped_column(JSONB)
    content_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

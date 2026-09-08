from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ScanTarget(Base):
    __tablename__ = 'code_risk_targets'
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), index=True)
    name: Mapped[str] = mapped_column(String(200))
    archived: Mapped[bool] = mapped_column(default=False)


class CodeRiskScan(Base):
    __tablename__ = 'code_risk_scans'
    __table_args__ = (UniqueConstraint('target_id', 'run_id'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    target_id: Mapped[int] = mapped_column(ForeignKey('code_risk_targets.id'), index=True)
    run_id: Mapped[str] = mapped_column(String(36))
    digest: Mapped[str] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(20))
    report: Mapped[dict[str, Any]] = mapped_column(JSONB)
    imported_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    artifact_id: Mapped[int | None] = mapped_column(ForeignKey('project_artifacts.id'))


class RiskFinding(Base):
    __tablename__ = 'code_risk_findings'
    __table_args__ = (UniqueConstraint('target_id', 'fingerprint'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    target_id: Mapped[int] = mapped_column(ForeignKey('code_risk_targets.id'), index=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    disposition: Mapped[str] = mapped_column(String(30), default='unreviewed')
    review_version: Mapped[int] = mapped_column(default=0)
    review_history: Mapped[list] = mapped_column(JSONB, default=list)


class FindingOccurrence(Base):
    __tablename__ = 'code_risk_occurrences'
    __table_args__ = (UniqueConstraint('scan_id', 'finding_id'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey('code_risk_scans.id'), index=True)
    finding_id: Mapped[int] = mapped_column(ForeignKey('code_risk_findings.id'), index=True)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB)


class RiskWorkItem(Base):
    __tablename__ = 'code_risk_work_items'
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), default='todo')
    version: Mapped[int] = mapped_column(default=0)


class WorkItemFinding(Base):
    __tablename__ = 'code_risk_work_item_findings'
    work_item_id: Mapped[int] = mapped_column(ForeignKey('code_risk_work_items.id'), primary_key=True)
    finding_id: Mapped[int] = mapped_column(ForeignKey('code_risk_findings.id'), primary_key=True)

class RiskExplanation(Base):
    __tablename__ = 'code_risk_explanations'
    __table_args__ = (UniqueConstraint('created_by', 'request_key'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), index=True)
    occurrence_id: Mapped[int] = mapped_column(ForeignKey('code_risk_occurrences.id'), index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    request_key: Mapped[str] = mapped_column(String(36))
    context_digest: Mapped[str] = mapped_column(String(64), index=True)
    model: Mapped[str] = mapped_column(String(200))
    prompt_version: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20))
    packet: Mapped[dict[str, Any]] = mapped_column(JSONB)
    output: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    usage: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    failure: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class RiskExplanationRequest(Base):
    __tablename__ = 'code_risk_explanation_requests'
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    request_key: Mapped[str] = mapped_column(String(36), primary_key=True)
    explanation_id: Mapped[int] = mapped_column(ForeignKey('code_risk_explanations.id'), index=True)

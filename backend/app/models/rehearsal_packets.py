"""Immutable assignment packets and reviewed returned evidence."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class RehearsalPacket(Base):
    __tablename__ = 'rehearsal_packets'
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    next_step_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_next_steps.id'))
    digest: Mapped[str] = mapped_column(String(64))
    manifest: Mapped[dict] = mapped_column(JSONB)
    markdown: Mapped[str] = mapped_column()
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class RehearsalResult(Base):
    __tablename__ = 'rehearsal_results'
    __table_args__ = (UniqueConstraint('release_id', 'request_key'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey('releases.id'), index=True)
    packet_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_packets.id'))
    scope_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_scopes.id'))
    request_key: Mapped[str] = mapped_column(String(36))
    input_digest: Mapped[str] = mapped_column(String(64))
    preview_digest: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSONB)
    evidence_ids: Mapped[list] = mapped_column(JSONB)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ResultEvidence(Base):
    __tablename__ = 'rehearsal_result_evidence'
    result_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_results.id'), primary_key=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey('rehearsal_evidence.id'), primary_key=True)


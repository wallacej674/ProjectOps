"""Bounded public contracts for Release Rehearsal."""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.schemas.code_risk import Contract, Digest, relative_path

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class SourceScope(Contract):
    target: str | None = Field(default=None, max_length=200)
    snapshot: str | None = Field(default=None, max_length=200)
    files: dict[str, Digest] = Field(default_factory=dict, max_length=5000)
    coverage: Literal['partial', 'complete']

    @field_validator('target', 'snapshot')
    @classmethod
    def known_identity(cls, value):
        return value.strip() or None if value is not None else None

    @field_validator('files')
    @classmethod
    def valid_paths(cls, value):
        for path in value:
            relative_path(path)
        return value


class ScopeInput(Contract):
    version: int = Field(ge=0)
    source: SourceScope
    environment: str | None = Field(default=None, max_length=500)

    @field_validator('environment')
    @classmethod
    def known_environment(cls, value):
        return value.strip() or None if value is not None else None


class Verification(Contract):
    check_id: Short
    criterion: Text
    expected: Text
    command: str = Field(default='', max_length=2000)
    executed: bool
    outcome: Literal['passed', 'failed', 'not_run']
    output: str = Field(default='', max_length=16000)
    not_run_reason: str = Field(default='', max_length=2000)
    tool: Short
    tool_version: Short
    started_at: datetime | None = None
    finished_at: datetime | None = None

    @model_validator(mode='after')
    def coherent_execution(self):
        if self.executed:
            if self.outcome == 'not_run' or not self.started_at or not self.finished_at:
                raise ValueError('Executed checks need an outcome and both timestamps.')
            if self.started_at.tzinfo is None or self.finished_at.tzinfo is None or self.finished_at < self.started_at:
                raise ValueError('Ordered timezone-aware verification times are required.')
        elif self.outcome != 'not_run' or not self.not_run_reason.strip():
            raise ValueError('Unexecuted checks need not_run outcome and a reason.')
        return self


class EvidenceInput(Contract):
    request_key: UUID
    requirement_id: int = Field(gt=0)
    requirement_revision: int = Field(ge=1)
    scope_id: int = Field(gt=0)
    kind: Literal['verification', 'material', 'scan', 'health', 'readiness', 'analysis']
    source_id: int | None = Field(default=None, gt=0)
    verification: Verification | None = None

    @model_validator(mode='after')
    def source_shape(self):
        if self.kind == 'verification':
            if self.verification is None or self.source_id is not None:
                raise ValueError('Verification imports require a report, not a source ID.')
        elif self.source_id is None or self.verification is not None:
            raise ValueError('Existing observations require a source ID, not a report.')
        return self


class AssessmentInput(Contract):
    requirement_id: int = Field(gt=0)
    requirement_revision: int = Field(ge=1)
    scope_id: int = Field(gt=0)
    evidence_ids: list[int] = Field(default_factory=list, max_length=20)
    outcome: Literal['not_verified', 'supported', 'gap_found', 'conflicting']
    rationale: Text
    limitations: list[Text] = Field(default_factory=list, max_length=20)

    @field_validator('evidence_ids')
    @classmethod
    def distinct(cls, values):
        if any(v <= 0 for v in values) or len(values) != len(set(values)):
            raise ValueError('Evidence IDs must be distinct positive identifiers.')
        return values


class AssessmentReviewInput(Contract):
    version: int = Field(ge=0)
    action: Literal['accept', 'supersede']
    reason: Text


class DispositionInput(Contract):
    disposition: Literal['open', 'accepted_risk', 'deferred']
    reason: Text


class NextStepInput(Contract):
    requirement_ids: list[int] = Field(min_length=1, max_length=20)
    title: Short
    rationale: Text
    acceptance_checks: list[Text] = Field(min_length=1, max_length=20)
    dependencies: list[int] = Field(default_factory=list, max_length=20)

    @field_validator('requirement_ids', 'dependencies')
    @classmethod
    def distinct_ids(cls, values):
        if any(v <= 0 for v in values) or len(values) != len(set(values)):
            raise ValueError('Use distinct positive identifiers.')
        return values


class NextStepTransition(Contract):
    version: int = Field(ge=0)
    status: Literal['accepted', 'in_progress', 'awaiting_verification', 'closed', 'cancelled']
    reason: Text
    evidence_ids: list[int] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def reviewed_close(self):
        if self.status == 'closed' and not self.evidence_ids:
            raise ValueError('Closing requires explicitly reviewed evidence.')
        if any(v <= 0 for v in self.evidence_ids) or len(set(self.evidence_ids)) != len(self.evidence_ids):
            raise ValueError('Use distinct positive evidence identifiers.')
        return self


class NextStepUpdate(NextStepInput):
    version: int = Field(ge=0)

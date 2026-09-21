"""Portable assignment input contracts."""
from pydantic import Field, field_validator
from app.schemas.code_risk import Contract


class PacketInput(Contract):
    next_step_id: int = Field(gt=0)
    version: int = Field(ge=0)
    evidence_ids: list[int] = Field(default_factory=list, max_length=20)

    @field_validator('evidence_ids')
    @classmethod
    def unique_evidence(cls, value):
        if any(identity <= 0 for identity in value) or len(value) != len(set(value)):
            raise ValueError('Evidence IDs must be distinct positive identifiers.')
        return value



from typing import Literal
from uuid import UUID
from pydantic import model_validator
from app.schemas.code_risk import Digest
from app.schemas.rehearsal import Verification, Text


class ResultCheck(Contract):
    requirement_id: int = Field(gt=0)
    requirement_revision: int = Field(ge=1)
    verification: Verification


class ResultInput(Contract):
    schema_version: Literal[1] = 1
    request_key: UUID
    packet_id: int = Field(gt=0)
    packet_digest: Digest
    outcome: Literal['completed', 'partial', 'blocked']
    summary: Text
    scope_id: int = Field(gt=0)
    checks: list[ResultCheck] = Field(max_length=20)
    limitations: list[Text] = Field(max_length=20)
    preview_digest: Digest | None = None

    @model_validator(mode='after')
    def distinct_checks(self):
        identities = [(row.requirement_id, row.verification.check_id) for row in self.checks]
        if len(identities) != len(set(identities)):
            raise ValueError('Checks must have distinct identifiers per requirement.')
        return self


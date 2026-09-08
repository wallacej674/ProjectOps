"""Versioned evidence and explanation contracts."""
from typing import Annotated, Literal
from uuid import UUID
from pydantic import Field
from app.schemas.code_risk import Contract

Text = Annotated[str, Field(min_length=1, max_length=2000)]


class PreviewInput(Contract):
    pass


class ExplanationInput(PreviewInput):
    request_key: UUID
    context_digest: str = Field(pattern=r'^[a-f0-9]{64}$')
    consent: Literal[True]
    regenerate: bool = False


class ProposedWork(Contract):
    title: str = Field(min_length=1, max_length=200)
    rationale: Text
    affected_files: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(min_length=1, max_length=3)
    acceptance_checks: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(min_length=1, max_length=8)
    priority: Literal['critical', 'high', 'medium', 'low']


class ExplanationOutput(Contract):
    explanation: Text
    impact_prerequisites: list[Text] = Field(max_length=8)
    uncertainty: list[Text] = Field(min_length=1, max_length=8)
    proposed_change: Text
    verification_steps: list[Text] = Field(min_length=1, max_length=8)
    citations: list[Literal['finding', 'coverage']] = Field(min_length=1, max_length=2)
    work_item: ProposedWork

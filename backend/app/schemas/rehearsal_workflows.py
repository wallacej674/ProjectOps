from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

Text = Annotated[str, Field(min_length=1, max_length=2000)]
class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')

class WorkflowSelection(Strict):
    evidence_ids: list[int] = Field(max_length=20)
    requirement_ids: list[int] = Field(min_length=1, max_length=12)

class WorkflowCreate(WorkflowSelection):
    request_key: UUID
    digest: str = Field(pattern=r'^[a-f0-9]{64}$')
    consent: Literal[True]
    regenerate: bool = False

class AssessmentProposal(Strict):
    requirement_id: int
    outcome: Literal['not_verified', 'supported', 'gap_found', 'conflicting']
    evidence_ids: list[int] = Field(max_length=100)
    rationale: Text
    limitations: list[Text] = Field(max_length=20)

class NextStepProposal(Strict):
    requirement_ids: list[int] = Field(min_length=1, max_length=50)
    title: Annotated[str, Field(min_length=1, max_length=200)]
    rationale: Text
    acceptance_checks: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(min_length=1, max_length=20)
    dependencies: list[int] = Field(max_length=0)

class ReviewOutput(Strict):
    assessments: list[AssessmentProposal] = Field(max_length=50)
    next_steps: list[NextStepProposal] = Field(max_length=3)
    limitations: list[Text] = Field(max_length=20)

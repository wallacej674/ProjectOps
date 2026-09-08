from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic import model_validator


RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid')


class BriefContent(Contract):
    goal: RequiredText
    stage: Literal['prototype', 'private_beta', 'public_beta', 'production']
    audience: RequiredText
    critical_journey: RequiredText
    data_handled: RequiredText
    failure_outcomes: RequiredText
    constraints: str = Field(default='', max_length=2000)
    exclusions: str = Field(default='', max_length=2000)


class ReleaseCreate(Contract):
    name: ShortText
    brief: BriefContent


class VersionInput(Contract):
    version: int = Field(ge=0)


class BriefUpdate(VersionInput):
    brief: BriefContent



class RequirementCreate(Contract):
    brief_revision: int = Field(ge=1)
    title: ShortText
    criterion: RequiredText
    verification_method: RequiredText
    consequence: Literal['high', 'medium', 'low']
    applicability: Literal['applicable', 'not_applicable', 'undecided']
    applicability_reason: str = Field(default='', max_length=2000)

    @model_validator(mode='after')
    def exclusion_reason(self):
        if self.applicability == 'not_applicable' and not self.applicability_reason.strip():
            raise ValueError('Explain why this requirement is excluded.')
        return self


class RequirementUpdate(RequirementCreate):
    version: int = Field(ge=0)

class MaterialInput(VersionInput):
    artifact_id: int = Field(gt=0)

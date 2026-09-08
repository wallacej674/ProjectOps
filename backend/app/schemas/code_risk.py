from datetime import datetime
from pathlib import PurePosixPath
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_REPORT_BYTES = 10 * 1024 * 1024
Digest = Annotated[str, Field(pattern=r'^[a-f0-9]{64}$')]
Short = Annotated[str, Field(min_length=1, max_length=200)]


def relative_path(value: str) -> str:
    if not value or len(value) > 500 or '\\' in value or ':' in value or value.startswith('/'):
        raise ValueError('A repository-relative path is required.')
    if any(part in ('', '.', '..') for part in value.split('/')) or any(ord(c) < 32 for c in value):
        raise ValueError('Invalid repository-relative path.')
    return str(PurePosixPath(value))


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid')


class ToolResult(Contract):
    name: Literal['semgrep', 'osv']
    version: Short
    profile: Short
    outcome: Literal['completed', 'partial', 'failed', 'unavailable']
    covered_files: list[str] = Field(max_length=5000)
    errors: list[Annotated[str, Field(max_length=500)]] = Field(default_factory=list, max_length=100)

    @field_validator('covered_files')
    @classmethod
    def paths(cls, values):
        return [relative_path(v) for v in values]


class FindingInput(Contract):
    tool: Literal['semgrep', 'osv']
    rule_id: Short
    path: str
    line: int | None = Field(default=None, ge=1, le=10000000)
    severity: Literal['critical', 'high', 'medium', 'low', 'info', 'unknown']
    raw_severity: str = Field(max_length=100)
    message: str = Field(min_length=1, max_length=2000)
    anchor: str = Field(min_length=1, max_length=2000)
    snippet: Literal[''] = ''
    versions: list[Annotated[str, Field(max_length=100)]] = Field(default_factory=list, max_length=500)
    package: str | None = Field(default=None, max_length=300)
    version: str | None = Field(default=None, max_length=100)
    ecosystem: str | None = Field(default=None, max_length=50)
    confidence: str | None = Field(default=None, max_length=50)
    advisory_url: str | None = Field(default=None, max_length=1000)

    _path = field_validator('path')(relative_path)

    @field_validator('advisory_url')
    @classmethod
    def advisory(cls, value):
        if value and not value.startswith('https://osv.dev/vulnerability/'):
            raise ValueError('Only OSV advisory links are accepted.')
        return value


class ScanReport(Contract):
    schema_version: Literal[1]
    run_id: UUID
    target_id: int = Field(gt=0)
    snapshot_hash: Digest
    started_at: datetime
    finished_at: datetime
    git_commit: str | None = Field(default=None, pattern=r'^[a-f0-9]{40,64}$')
    dirty: bool = True
    files: dict[str, Digest] = Field(max_length=5000)
    exclusions: list[Annotated[str, Field(max_length=600)]] = Field(default_factory=list, max_length=5000)
    tools: list[ToolResult] = Field(min_length=1, max_length=2)
    findings: list[FindingInput] = Field(max_length=10000)

    @model_validator(mode='after')
    def consistent(self):
        if self.started_at.tzinfo is None or self.finished_at.tzinfo is None or self.finished_at < self.started_at:
            raise ValueError('Ordered timezone-aware scan timestamps are required.')
        for path in self.files:
            relative_path(path)
        names = [t.name for t in self.tools]
        if len(set(names)) != len(names):
            raise ValueError('Duplicate tool result.')
        coverage = {t.name: set(t.covered_files) for t in self.tools}
        if any(not paths.issubset(self.files) for paths in coverage.values()):
            raise ValueError('Coverage must reference snapshot files.')
        for finding in self.findings:
            if finding.path not in coverage.get(finding.tool, set()):
                raise ValueError('Finding must reference a covered file and tool.')
        return self


class TargetCreate(Contract):
    name: Short

    @field_validator('name')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Name is required.')
        return value.strip()

class TargetUpdate(TargetCreate):
    archived: bool = False


class ReviewInput(Contract):
    version: int = Field(ge=0)
    disposition: Literal['unreviewed', 'acknowledged', 'false_positive', 'accepted_risk']
    reason: str = Field(max_length=2000)
    occurrence_id: int = Field(gt=0)

    @model_validator(mode='after')
    def reason_required(self):
        if self.disposition in ('false_positive', 'accepted_risk') and not self.reason.strip():
            raise ValueError('A reason is required for this review decision.')
        return self


class WorkCreate(Contract):
    explanation_id: int | None = Field(default=None, gt=0)
    title: Short
    rationale: str = Field(min_length=1, max_length=4000)
    finding_ids: list[int] = Field(min_length=1, max_length=20)
    affected_files: list[str] = Field(min_length=1, max_length=30)
    acceptance_checks: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(min_length=1, max_length=20)
    priority: Literal['critical', 'high', 'medium', 'low'] = 'medium'

    @field_validator('affected_files')
    @classmethod
    def paths(cls, values):
        return [relative_path(v) for v in values]


class WorkUpdate(Contract):
    version: int = Field(ge=0)
    status: Literal['todo', 'in_progress', 'done']

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.project_artifact import ProjectArtifactRead

ReadinessStatus = Literal["passed", "failed", "unknown", "not_applicable"]


class ReadinessItemRead(BaseModel):
    id: int
    key: str
    label: str
    description: str
    category: str
    evaluation_type: str
    sort_order: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ProjectReadinessItemRead(BaseModel):
    id: int
    project_id: int
    readiness_item_id: int
    item: ReadinessItemRead
    status: ReadinessStatus
    source: str
    evidence: dict[str, Any] | None
    notes: str | None
    evaluated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadinessItemUpdate(BaseModel):
    status: ReadinessStatus
    notes: str | None = None


class ReadinessArtifactLinkRequest(BaseModel):
    artifact_id: int


class ReadinessArtifactEvidenceRead(BaseModel):
    id: int
    project_id: int
    readiness_item_id: int
    item_key: str
    artifact: ProjectArtifactRead
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadinessEvidenceItemUsageRead(BaseModel):
    readiness_item_id: int
    item_key: str
    label: str
    status: ReadinessStatus | None


class ReadinessEvidenceArtifactUsageRead(BaseModel):
    artifact: ProjectArtifactRead
    linked_item_count: int
    readiness_items: list[ReadinessEvidenceItemUsageRead]


class ReadinessEvidenceItemCoverageRead(BaseModel):
    readiness_item_id: int
    item_key: str
    label: str
    status: ReadinessStatus
    linked_artifact_count: int
    artifacts: list[ProjectArtifactRead]


class ProjectReadinessEvidenceCoverage(BaseModel):
    active_artifacts: int
    linked_active_artifacts: int
    unlinked_active_artifacts: int
    readiness_items_with_linked_artifacts: int
    readiness_items_without_linked_artifacts: int
    total_evidence_links: int
    artifact_usage: list[ReadinessEvidenceArtifactUsageRead]
    readiness_items: list[ReadinessEvidenceItemCoverageRead]


class ProjectReadinessSummary(BaseModel):
    score: int | None
    status: str
    passed: int
    failed: int
    unknown: int
    not_applicable: int
    total_applicable: int
    top_gaps: list[str]
    items: list[ProjectReadinessItemRead]


class ProjectReadinessOverviewRead(BaseModel):
    project_id: int
    project_name: str
    project_status: str
    score: int | None
    status: str
    passed: int
    failed: int
    unknown: int
    not_applicable: int
    total_applicable: int
    top_gaps: list[str]

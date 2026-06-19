from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

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
    status: ReadinessStatus
    source: str
    evidence: dict[str, Any] | None
    notes: str | None
    evaluated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadinessItemUpdate(BaseModel):
    status: ReadinessStatus
    notes: str | None = None


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

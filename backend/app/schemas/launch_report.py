from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.dashboard import DashboardReadiness
from app.schemas.project import ProjectRead

LaunchDecision = Literal["ready", "review", "not_ready"]
LaunchChecklistStatus = Literal["done", "needs_attention", "todo"]


class LaunchEvidenceSummary(BaseModel):
    repository_connected: bool
    codemap_completed: bool
    health_check_healthy: bool
    production_url_configured: bool
    active_artifacts: int
    linked_active_artifacts: int
    unlinked_active_artifacts: int
    readiness_items_with_linked_artifacts: int
    readiness_items_without_linked_artifacts: int
    total_evidence_links: int
    activity_events: int


class ProjectLaunchReportRead(BaseModel):
    project: ProjectRead
    generated_at: datetime
    decision: LaunchDecision
    headline: str
    readiness: DashboardReadiness
    evidence_summary: LaunchEvidenceSummary
    blockers: list[str]
    recommended_actions: list[str]


class LaunchChecklistItemRead(BaseModel):
    key: str
    label: str
    status: LaunchChecklistStatus
    description: str
    action: str
    target: str


class LaunchChecklistSummary(BaseModel):
    done: int
    needs_attention: int
    todo: int
    total: int


class ProjectLaunchChecklistRead(BaseModel):
    project: ProjectRead
    generated_at: datetime
    summary: LaunchChecklistSummary
    items: list[LaunchChecklistItemRead]

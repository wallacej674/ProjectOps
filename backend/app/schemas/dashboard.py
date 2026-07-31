from datetime import datetime

from pydantic import BaseModel

from app.models.project_artifact import ProjectArtifactSourceType, ProjectArtifactType
from app.models.project_activity import ProjectActivityCategory, ProjectActivityEventType
from app.models.repo_integration import RepoProvider
from app.schemas.health_check import HealthCheckRead
from app.schemas.project import ProjectRead
from app.schemas.repo_analysis import RepoAnalysisRead


class DashboardRepoStatus(BaseModel):
    repo_url: str | None
    connected: bool
    provider: RepoProvider | None
    repo_owner: str | None
    repo_name: str | None
    default_branch: str | None
    last_verified_at: datetime | None
    message: str


class DashboardReadiness(BaseModel):
    score: int | None
    status: str
    passed: int
    failed: int
    unknown: int
    not_applicable: int
    total_applicable: int
    top_gaps: list[str]


class DashboardLatestArtifact(BaseModel):
    id: int
    title: str
    artifact_type: ProjectArtifactType
    source_type: ProjectArtifactSourceType
    updated_at: datetime


class DashboardArtifacts(BaseModel):
    active_count: int
    archived_count: int
    total_count: int
    latest_artifact: DashboardLatestArtifact | None


class DashboardLatestActivityEvent(BaseModel):
    id: int
    event_type: ProjectActivityEventType
    event_category: ProjectActivityCategory
    message: str
    related_resource_type: str | None
    related_resource_id: int | None
    created_at: datetime


class DashboardActivity(BaseModel):
    recent_count: int
    latest_event: DashboardLatestActivityEvent | None


class ProjectDashboardRead(BaseModel):
    project: ProjectRead
    repo: DashboardRepoStatus
    latest_repo_analysis: RepoAnalysisRead | None
    latest_health_check: HealthCheckRead | None
    readiness: DashboardReadiness
    artifacts: DashboardArtifacts
    activity: DashboardActivity
    next_steps: list[str]

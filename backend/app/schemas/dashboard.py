from datetime import datetime

from pydantic import BaseModel

from app.models.repo_integration import RepoProvider
from app.schemas.project import ProjectRead


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
    message: str


class ProjectDashboardRead(BaseModel):
    project: ProjectRead
    repo: DashboardRepoStatus
    latest_repo_analysis: None
    latest_health_check: None
    readiness: DashboardReadiness
    next_steps: list[str]

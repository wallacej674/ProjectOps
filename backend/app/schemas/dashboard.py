from pydantic import BaseModel

from app.schemas.project import ProjectRead


class DashboardRepoStatus(BaseModel):
    repo_url: str | None
    connected: bool
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

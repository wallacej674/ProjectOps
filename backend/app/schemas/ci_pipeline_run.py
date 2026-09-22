from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CiPipelineRunRead(BaseModel):
    id: int
    project_id: int
    repo_integration_id: int
    github_run_id: int
    github_workflow_id: int | None
    workflow_name: str
    run_number: int | None
    status: str
    conclusion: str | None
    branch: str | None
    commit_sha: str | None
    commit_message: str | None
    event: str | None
    html_url: str | None
    run_started_at: datetime | None
    run_completed_at: datetime | None
    duration_seconds: int | None
    observed_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CiSyncResultRead(BaseModel):
    new_count: int
    updated_count: int
    latest_run: CiPipelineRunRead | None

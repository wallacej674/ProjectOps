from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.repo_integration import RepoProvider


class RepoIntegrationCreate(BaseModel):
    repo_url: str = Field(min_length=1, max_length=2048)


class RepoIntegrationRead(BaseModel):
    id: int
    project_id: int
    provider: RepoProvider
    repo_owner: str
    repo_name: str
    repo_url: str
    default_branch: str | None
    is_connected: bool
    last_verified_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    repo_url: str | None = Field(default=None, max_length=2048)
    production_url: str | None = Field(default=None, max_length=2048)
    status: ProjectStatus = ProjectStatus.planning


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    repo_url: str | None = Field(default=None, max_length=2048)
    production_url: str | None = Field(default=None, max_length=2048)
    status: ProjectStatus | None = None


class ProjectRead(BaseModel):
    id: int
    name: str
    description: str | None
    repo_url: str | None
    production_url: str | None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

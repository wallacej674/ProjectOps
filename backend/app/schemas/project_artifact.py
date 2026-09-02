from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.project_artifact import (
    ProjectArtifactSourceType,
    ProjectArtifactStatus,
    ProjectArtifactType,
)


class ProjectArtifactBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    artifact_type: ProjectArtifactType = ProjectArtifactType.note
    source_type: ProjectArtifactSourceType = ProjectArtifactSourceType.manual
    url: str | None = Field(default=None, max_length=2048)
    content: str | None = Field(default=None, max_length=10000)
    summary: str | None = Field(default=None, max_length=2000)
    tags: str | None = Field(default=None, max_length=1000)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Artifact title is required.")
        return value

    @field_validator("url")
    @classmethod
    def url_must_be_http_url(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Enter a valid HTTP or HTTPS URL.")
        return value


class ProjectArtifactCreate(ProjectArtifactBase):
    pass


class ProjectArtifactUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    artifact_type: ProjectArtifactType | None = None
    source_type: ProjectArtifactSourceType | None = None
    url: str | None = Field(default=None, max_length=2048)
    content: str | None = Field(default=None, max_length=10000)
    summary: str | None = Field(default=None, max_length=2000)
    tags: str | None = Field(default=None, max_length=1000)
    status: ProjectArtifactStatus | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Artifact title is required.")
        return value

    @field_validator("url")
    @classmethod
    def url_must_be_http_url(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Enter a valid HTTP or HTTPS URL.")
        return value


class ProjectArtifactCreatorRead(BaseModel):
    id: int
    email: str
    display_name: str | None

    model_config = ConfigDict(from_attributes=True)


class ProjectArtifactRead(BaseModel):
    id: int
    project_id: int
    created_by_user_id: int | None
    created_by_user: ProjectArtifactCreatorRead | None
    title: str
    artifact_type: ProjectArtifactType
    source_type: ProjectArtifactSourceType
    url: str | None
    content: str | None
    summary: str | None
    tags: str | None
    status: ProjectArtifactStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectArtifactOverviewRead(BaseModel):
    project_id: int
    project_name: str
    project_status: str
    active_artifact_count: int
    most_recent_title: str | None
    most_recent_updated_at: datetime | None

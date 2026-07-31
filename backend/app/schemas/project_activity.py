from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.project_activity import ProjectActivityCategory, ProjectActivityEventType


class ProjectActivityEventRead(BaseModel):
    id: int
    project_id: int
    event_type: ProjectActivityEventType
    event_category: ProjectActivityCategory
    message: str
    related_resource_type: str | None
    related_resource_id: int | None
    metadata: dict[str, Any] | None = Field(default=None, validation_alias="metadata_json")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CrossProjectActivityEventRead(ProjectActivityEventRead):
    project_name: str
    project_status: str

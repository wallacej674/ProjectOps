from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.health_check import HealthCheckStatus


class ProjectStatusPageUpdate(BaseModel):
    enabled: bool
    label: str | None = Field(default=None, max_length=200)


class ProjectStatusPageRead(BaseModel):
    project_id: int
    enabled: bool
    slug: str | None
    label: str | None
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class PublicStatusCheckRead(BaseModel):
    status: HealthCheckStatus
    http_status_code: int | None
    response_time_ms: int | None
    checked_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicStatusIncidentRead(BaseModel):
    opened_at: datetime
    last_observed_at: datetime
    recovered_at: datetime | None


class PublicStatusPageRead(BaseModel):
    label: str
    target_url: str | None
    current_status: HealthCheckStatus | None
    last_checked_at: datetime | None
    active_incident: PublicStatusIncidentRead | None
    history: list[PublicStatusCheckRead]
    generated_at: datetime

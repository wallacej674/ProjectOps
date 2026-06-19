from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.health_check import HealthCheckStatus


class HealthCheckRunRequest(BaseModel):
    url: str | None = Field(default=None, min_length=1, max_length=2048)


class HealthCheckRead(BaseModel):
    id: int
    project_id: int
    target_url: str
    status: HealthCheckStatus
    http_status_code: int | None
    response_time_ms: int | None
    checked_at: datetime
    error_message: str | None
    response_preview: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

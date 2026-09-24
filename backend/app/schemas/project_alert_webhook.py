from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProjectAlertWebhookUpdate(BaseModel):
    enabled: bool
    url: str = Field(default="", max_length=2048)


class ProjectAlertWebhookRead(BaseModel):
    project_id: int
    enabled: bool
    url: str
    last_delivery_attempted_at: datetime | None
    last_delivery_transition: str | None
    last_delivery_outcome: Literal["delivered", "failed"] | None
    last_delivery_http_status: int | None
    last_delivery_error: str | None
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

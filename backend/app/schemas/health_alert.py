from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.health_check import HealthCheckRead

AlertStatus = Literal["active", "recovered", "closed"]


class HealthAlertRead(BaseModel):
    id: int
    project_id: int
    target_url: str
    status: AlertStatus
    first_failure_at: datetime
    opened_at: datetime
    last_observed_at: datetime
    recovered_at: datetime | None
    closed_at: datetime | None
    first_check_id: int
    opening_check_id: int
    latest_check_id: int
    recovery_check_id: int | None
    failure_count: int
    acknowledged_at: datetime | None
    acknowledged_by_user_id: int | None
    closure_reason: str | None
    model_config = ConfigDict(from_attributes=True)


class HealthAlertPage(BaseModel):
    items: list[HealthAlertRead]
    total: int


class HealthAlertEvidencePage(BaseModel):
    items: list[HealthCheckRead]
    total: int


class HealthAlertDetail(BaseModel):
    alert: HealthAlertRead
    evidence: HealthAlertEvidencePage

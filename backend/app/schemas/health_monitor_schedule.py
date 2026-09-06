from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.health_alert import HealthAlertRead
from app.models.health_check import HealthCheckStatus

HealthMonitorCadence = Literal[15, 60, 360, 1440]


class HealthMonitorScheduleUpdate(BaseModel):
    enabled: bool
    cadence_minutes: HealthMonitorCadence


class HealthMonitorScheduleRead(BaseModel):
    project_id: int
    enabled: bool
    cadence_minutes: int
    next_run_at: datetime | None
    last_started_at: datetime | None
    last_completed_at: datetime | None
    last_outcome: HealthCheckStatus | None
    consecutive_failures: int
    consecutive_healthy: int = 0
    active_alert: HealthAlertRead | None = None
    freshness: Literal["disabled", "awaiting_first_check", "current", "overdue"] = "disabled"
    failure_threshold: int = 2
    recovery_threshold: int = 2
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

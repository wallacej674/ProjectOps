from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

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
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

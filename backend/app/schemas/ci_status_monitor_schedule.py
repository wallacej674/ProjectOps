from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

CiMonitorCadence = Literal[15, 60, 360, 1440]


class CiStatusMonitorScheduleUpdate(BaseModel):
    enabled: bool
    cadence_minutes: CiMonitorCadence


class CiStatusMonitorScheduleRead(BaseModel):
    project_id: int
    enabled: bool
    cadence_minutes: int
    next_run_at: datetime | None
    last_started_at: datetime | None
    last_completed_at: datetime | None
    last_outcome: str | None
    consecutive_sync_failures: int
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

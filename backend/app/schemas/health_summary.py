from pydantic import BaseModel
from app.schemas.health_check import HealthCheckRead
from app.schemas.health_monitor_schedule import HealthMonitorScheduleRead


class ProjectHealthSummaryRead(BaseModel):
    project_id: int
    project_name: str
    project_status: str
    production_url: str | None
    latest_check: HealthCheckRead | None
    latest_scheduled_check: HealthCheckRead | None = None
    monitor: HealthMonitorScheduleRead

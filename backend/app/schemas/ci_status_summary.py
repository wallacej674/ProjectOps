from pydantic import BaseModel

from app.schemas.ci_pipeline_run import CiPipelineRunRead
from app.schemas.ci_status_monitor_schedule import CiStatusMonitorScheduleRead


class ProjectCiStatusSummaryRead(BaseModel):
    project_id: int
    project_name: str
    project_status: str
    repo_owner: str | None
    repo_name: str | None
    ci_available: bool
    needs_reauthorization: bool = False
    latest_run: CiPipelineRunRead | None
    monitor: CiStatusMonitorScheduleRead

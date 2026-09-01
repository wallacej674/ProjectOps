from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.health_monitor_schedule import HealthMonitorSchedule
from app.models.project import ProjectStatus
from app.repositories.health_monitor_schedules import health_monitor_schedule_repository
from app.schemas.health_monitor_schedule import HealthMonitorScheduleRead, HealthMonitorScheduleUpdate
from app.services.projects import project_service


class HealthMonitorScheduleValidationError(Exception):
    pass


class HealthMonitorScheduleService:
    def get_for_project(self, db: Session, project_id: int) -> HealthMonitorSchedule | HealthMonitorScheduleRead:
        project_service.get_project(db, project_id)
        schedule = health_monitor_schedule_repository.get_by_project_id(db, project_id)
        if schedule is not None:
            return schedule
        return HealthMonitorScheduleRead(
            project_id=project_id,
            enabled=False,
            cadence_minutes=60,
            next_run_at=None,
            last_started_at=None,
            last_completed_at=None,
            last_outcome=None,
            consecutive_failures=0,
            created_at=None,
            updated_at=None,
        )

    def update_for_project(
        self,
        db: Session,
        project_id: int,
        update: HealthMonitorScheduleUpdate,
    ) -> HealthMonitorSchedule:
        project = project_service.get_project(db, project_id)
        if project.status == ProjectStatus.archived.value and update.enabled:
            raise HealthMonitorScheduleValidationError("Archived Projects cannot enable scheduled monitoring.")
        if update.enabled and not project.production_url:
            raise HealthMonitorScheduleValidationError(
                "Add a Project production URL before enabling scheduled monitoring."
            )
        now = datetime.now(timezone.utc)
        return health_monitor_schedule_repository.save(
            db,
            project_id=project_id,
            enabled=update.enabled,
            cadence_minutes=update.cadence_minutes,
            next_run_at=now + timedelta(minutes=update.cadence_minutes) if update.enabled else None,
        )

    def pause_for_project(self, db: Session, project_id: int) -> HealthMonitorSchedule:
        current = self.get_for_project(db, project_id)
        return health_monitor_schedule_repository.save(
            db,
            project_id=project_id,
            enabled=False,
            cadence_minutes=current.cadence_minutes,
            next_run_at=None,
        )


health_monitor_schedule_service = HealthMonitorScheduleService()

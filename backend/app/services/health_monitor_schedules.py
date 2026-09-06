from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.health_monitor_schedule import HealthMonitorSchedule
from app.repositories.health_monitor_schedules import health_monitor_schedule_repository
from app.schemas.health_monitor_schedule import HealthMonitorScheduleRead, HealthMonitorScheduleUpdate
from app.services.projects import project_service
from app.services.health_alerts import active_alert
from app.services.monitor_state import lock_monitor, reset_sequence, freshness
from app.schemas.health_alert import HealthAlertRead


class HealthMonitorScheduleValidationError(Exception):
    pass


class HealthMonitorScheduleService:
    def get_for_project(self, db: Session, project_id: int) -> HealthMonitorScheduleRead:
        project_service.get_project(db, project_id)
        schedule = health_monitor_schedule_repository.get_by_project_id(db, project_id)
        if schedule is None:
            return HealthMonitorScheduleRead(
                project_id=project_id, enabled=False, cadence_minutes=60,
                next_run_at=None, last_started_at=None, last_completed_at=None,
                last_outcome=None, consecutive_failures=0, created_at=None, updated_at=None,
            )
        result = HealthMonitorScheduleRead.model_validate(schedule)
        result.freshness = freshness(schedule)
        alert = active_alert(db, project_id)
        result.active_alert = HealthAlertRead.model_validate(alert) if alert else None
        return result

    def update_for_project(self, db: Session, project_id: int, update: HealthMonitorScheduleUpdate):
        project, schedule = lock_monitor(db, project_id)
        if update.enabled and project.status == "archived":
            raise HealthMonitorScheduleValidationError("Archived Projects cannot enable scheduled monitoring.")
        if update.enabled and not project.production_url:
            raise HealthMonitorScheduleValidationError("Add a Project production URL before enabling scheduled monitoring.")
        changed = schedule is None or schedule.enabled != update.enabled or schedule.cadence_minutes != update.cadence_minutes
        if schedule is None:
            schedule = HealthMonitorSchedule(project_id=project_id)
            db.add(schedule)
        schedule.enabled = update.enabled
        schedule.cadence_minutes = update.cadence_minutes
        if changed:
            reset_sequence(schedule, datetime.now(timezone.utc))
        db.commit()
        return self.get_for_project(db, project_id)

    def pause_for_project(self, db: Session, project_id: int):
        current = self.get_for_project(db, project_id)
        return self.update_for_project(db, project_id, HealthMonitorScheduleUpdate(enabled=False, cadence_minutes=current.cadence_minutes))


health_monitor_schedule_service = HealthMonitorScheduleService()

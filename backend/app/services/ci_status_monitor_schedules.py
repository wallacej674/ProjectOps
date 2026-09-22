from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.ci_status_monitor_schedule import CiStatusMonitorSchedule
from app.repositories.ci_status_monitor_schedules import ci_status_monitor_schedule_repository
from app.repositories.repo_integrations import repo_integration_repository
from app.schemas.ci_status_monitor_schedule import CiStatusMonitorScheduleRead, CiStatusMonitorScheduleUpdate
from app.services.ci_monitor_state import lock_monitor, reset_sequence
from app.services.projects import project_service


class CiStatusMonitorScheduleValidationError(Exception):
    pass


class CiStatusMonitorScheduleService:
    def get_for_project(self, db: Session, project_id: int) -> CiStatusMonitorScheduleRead:
        project_service.get_project(db, project_id)
        schedule = ci_status_monitor_schedule_repository.get_by_project_id(db, project_id)
        if schedule is None:
            return CiStatusMonitorScheduleRead(
                project_id=project_id, enabled=False, cadence_minutes=60,
                next_run_at=None, last_started_at=None, last_completed_at=None,
                last_outcome=None, consecutive_sync_failures=0, created_at=None, updated_at=None,
            )
        return CiStatusMonitorScheduleRead.model_validate(schedule)

    def update_for_project(self, db: Session, project_id: int, update: CiStatusMonitorScheduleUpdate) -> CiStatusMonitorScheduleRead:
        project, schedule = lock_monitor(db, project_id)
        if update.enabled and project.status == "archived":
            raise CiStatusMonitorScheduleValidationError("Archived Projects cannot enable scheduled build-status checks.")
        repo = repo_integration_repository.get_by_project_id(db, project_id)
        if update.enabled and (repo is None or repo.github_installation_id is None):
            raise CiStatusMonitorScheduleValidationError(
                "Connect this repository through GitHub App before enabling scheduled build-status checks."
            )
        changed = schedule is None or schedule.enabled != update.enabled or schedule.cadence_minutes != update.cadence_minutes
        if schedule is None:
            schedule = CiStatusMonitorSchedule(project_id=project_id)
            db.add(schedule)
        schedule.enabled = update.enabled
        schedule.cadence_minutes = update.cadence_minutes
        if changed:
            reset_sequence(schedule, datetime.now(timezone.utc))
        db.commit()
        return self.get_for_project(db, project_id)

    def pause_for_project(self, db: Session, project_id: int) -> CiStatusMonitorScheduleRead:
        current = self.get_for_project(db, project_id)
        return self.update_for_project(
            db, project_id, CiStatusMonitorScheduleUpdate(enabled=False, cadence_minutes=current.cadence_minutes)
        )


ci_status_monitor_schedule_service = CiStatusMonitorScheduleService()

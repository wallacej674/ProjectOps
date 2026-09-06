from datetime import datetime
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.models.health_monitor_schedule import HealthMonitorSchedule
from app.models.project import Project


class HealthMonitorScheduleRepository:
    def get_by_project_id(self, db: Session, project_id: int) -> HealthMonitorSchedule | None:
        return db.scalar(select(HealthMonitorSchedule).where(HealthMonitorSchedule.project_id == project_id))

    def lock_project_and_schedule(self, db: Session, project_id: int):
        project = db.scalar(select(Project).where(Project.id == project_id).with_for_update().execution_options(populate_existing=True))
        schedule = db.scalar(select(HealthMonitorSchedule).where(HealthMonitorSchedule.project_id == project_id).with_for_update().execution_options(populate_existing=True))
        return project, schedule

    def lock_next_due_project(self, db: Session, now: datetime, excluded: list[int]) -> Project | None:
        return db.scalar(select(Project).join(HealthMonitorSchedule).where(
            HealthMonitorSchedule.enabled.is_(True), HealthMonitorSchedule.next_run_at <= now,
            or_(HealthMonitorSchedule.claim_expires_at.is_(None), HealthMonitorSchedule.claim_expires_at <= now),
            Project.status != "archived", Project.production_url.is_not(None), Project.id.not_in(excluded),
        ).order_by(HealthMonitorSchedule.next_run_at, Project.id).with_for_update(of=Project, skip_locked=True).limit(1).execution_options(populate_existing=True))


health_monitor_schedule_repository = HealthMonitorScheduleRepository()

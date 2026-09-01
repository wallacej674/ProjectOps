from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.health_monitor_schedule import HealthMonitorSchedule
from app.models.project import Project, ProjectStatus


class HealthMonitorScheduleRepository:
    def get_by_project_id(self, db: Session, project_id: int) -> HealthMonitorSchedule | None:
        return db.scalar(
            select(HealthMonitorSchedule).where(HealthMonitorSchedule.project_id == project_id).limit(1)
        )

    def save(
        self,
        db: Session,
        *,
        project_id: int,
        enabled: bool,
        cadence_minutes: int,
        next_run_at: datetime | None,
    ) -> HealthMonitorSchedule:
        schedule = self.get_by_project_id(db, project_id)
        if schedule is None:
            schedule = HealthMonitorSchedule(project_id=project_id)
        schedule.enabled = enabled
        schedule.cadence_minutes = cadence_minutes
        schedule.next_run_at = next_run_at
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        return schedule

    def claim_due(self, db: Session, *, now: datetime, limit: int = 25) -> list[HealthMonitorSchedule]:
        statement = (
            select(HealthMonitorSchedule)
            .join(Project, Project.id == HealthMonitorSchedule.project_id)
            .where(
                HealthMonitorSchedule.enabled.is_(True),
                HealthMonitorSchedule.next_run_at.is_not(None),
                HealthMonitorSchedule.next_run_at <= now,
                Project.status != ProjectStatus.archived.value,
                Project.production_url.is_not(None),
            )
            .order_by(HealthMonitorSchedule.next_run_at, HealthMonitorSchedule.id)
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
        schedules = list(db.scalars(statement).all())
        for schedule in schedules:
            schedule.last_started_at = now
            schedule.next_run_at = now + timedelta(minutes=schedule.cadence_minutes)
        db.commit()
        return schedules

    def complete_run(
        self,
        db: Session,
        *,
        schedule: HealthMonitorSchedule,
        outcome: str,
        completed_at: datetime,
    ) -> HealthMonitorSchedule:
        schedule.last_completed_at = completed_at
        schedule.last_outcome = outcome
        schedule.consecutive_failures = 0 if outcome == "healthy" else schedule.consecutive_failures + 1
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        return schedule


health_monitor_schedule_repository = HealthMonitorScheduleRepository()

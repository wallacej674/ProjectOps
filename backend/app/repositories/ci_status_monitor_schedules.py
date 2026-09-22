from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.ci_status_monitor_schedule import CiStatusMonitorSchedule
from app.models.project import Project
from app.models.repo_integration import RepoIntegration


class CiStatusMonitorScheduleRepository:
    def get_by_project_id(self, db: Session, project_id: int) -> CiStatusMonitorSchedule | None:
        return db.scalar(select(CiStatusMonitorSchedule).where(CiStatusMonitorSchedule.project_id == project_id))

    def lock_project_and_schedule(self, db: Session, project_id: int):
        project = db.scalar(
            select(Project).where(Project.id == project_id).with_for_update().execution_options(populate_existing=True)
        )
        schedule = db.scalar(
            select(CiStatusMonitorSchedule)
            .where(CiStatusMonitorSchedule.project_id == project_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return project, schedule

    def lock_next_due_project(self, db: Session, now: datetime, excluded: list[int]):
        row = db.execute(
            select(Project, RepoIntegration)
            .join(CiStatusMonitorSchedule, CiStatusMonitorSchedule.project_id == Project.id)
            .join(RepoIntegration, RepoIntegration.project_id == Project.id)
            .where(
                CiStatusMonitorSchedule.enabled.is_(True),
                CiStatusMonitorSchedule.next_run_at <= now,
                or_(
                    CiStatusMonitorSchedule.claim_expires_at.is_(None),
                    CiStatusMonitorSchedule.claim_expires_at <= now,
                ),
                Project.status != "archived",
                RepoIntegration.github_installation_id.is_not(None),
                Project.id.not_in(excluded),
            )
            .order_by(CiStatusMonitorSchedule.next_run_at, Project.id)
            .with_for_update(of=Project, skip_locked=True)
            .limit(1)
            .execution_options(populate_existing=True)
        ).first()
        return tuple(row) if row is not None else None


ci_status_monitor_schedule_repository = CiStatusMonitorScheduleRepository()

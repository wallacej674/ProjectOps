from sqlalchemy.orm import Session

from app.models.project import Project
from app.repositories.projects import project_repository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectNotFoundError(Exception):
    pass


class ProjectService:
    def create_project(self, db: Session, project_in: ProjectCreate, owner_user_id: int | None = None) -> Project:
        project = project_repository.create(db, project_in, owner_user_id=owner_user_id)
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=project.id,
            event_type="project_created",
            event_category="project",
            message="Project was created.",
            related_resource_type="project",
            related_resource_id=project.id,
            metadata={"name": project.name, "status": project.status},
        )
        return project

    def list_projects(
        self,
        db: Session,
        include_archived: bool = False,
        owner_user_id: int | None = None,
    ) -> list[Project]:
        return project_repository.list(db, include_archived=include_archived, owner_user_id=owner_user_id)

    def get_project(self, db: Session, project_id: int) -> Project:
        project = project_repository.get(db, project_id)
        if project is None:
            raise ProjectNotFoundError(f"Project {project_id} was not found.")
        return project

    def get_project_for_user(self, db: Session, project_id: int, owner_user_id: int) -> Project:
        project = project_repository.get_for_owner(db, project_id, owner_user_id)
        if project is None:
            raise ProjectNotFoundError(f"Project {project_id} was not found.")
        return project

    def update_project(
        self,
        db: Session,
        project_id: int,
        project_in: ProjectUpdate,
        owner_user_id: int | None = None,
    ) -> Project:
        project = (
            self.get_project_for_user(db, project_id, owner_user_id)
            if owner_user_id is not None
            else self.get_project(db, project_id)
        )
        from datetime import datetime, timezone
        from app.services.monitor_state import lock_monitor, reset_sequence
        from app.services.health_alerts import close_alert
        project, schedule = lock_monitor(db, project_id)
        old_url, old_status = project.production_url, project.status
        updated_project = project_repository.update(db, project, project_in, commit=False)
        archived = updated_project.status == "archived" and old_status != "archived"
        target_changed = old_url != updated_project.production_url
        if archived or target_changed:
            reason = "project_archived" if archived else ("target_changed" if updated_project.production_url else "target_removed")
            close_alert(db, project_id, reason)
            if schedule is not None:
                if archived or not updated_project.production_url:
                    schedule.enabled = False
                reset_sequence(schedule, datetime.now(timezone.utc))
        db.commit()
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=updated_project.id,
            event_type="project_archived" if archived else "project_updated",
            event_category="project",
            message="Project was archived." if archived else "Project details were updated.",
            related_resource_type="project",
            related_resource_id=updated_project.id,
            metadata={"name": updated_project.name, "status": updated_project.status},
        )
        return updated_project

    def archive_project(self, db: Session, project_id: int, owner_user_id: int | None = None) -> Project:
        return self.update_project(db, project_id, ProjectUpdate(status="archived"), owner_user_id=owner_user_id)


project_service = ProjectService()

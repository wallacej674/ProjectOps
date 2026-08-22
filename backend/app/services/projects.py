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
        updated_project = project_repository.update(db, project, project_in)
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=updated_project.id,
            event_type="project_updated",
            event_category="project",
            message="Project details were updated.",
            related_resource_type="project",
            related_resource_id=updated_project.id,
            metadata={"name": updated_project.name, "status": updated_project.status},
        )
        return updated_project

    def archive_project(self, db: Session, project_id: int, owner_user_id: int | None = None) -> Project:
        project = (
            self.get_project_for_user(db, project_id, owner_user_id)
            if owner_user_id is not None
            else self.get_project(db, project_id)
        )
        archived_project = project_repository.archive(db, project)
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=archived_project.id,
            event_type="project_archived",
            event_category="project",
            message="Project was archived.",
            related_resource_type="project",
            related_resource_id=archived_project.id,
            metadata={"name": archived_project.name, "status": archived_project.status},
        )
        return archived_project


project_service = ProjectService()

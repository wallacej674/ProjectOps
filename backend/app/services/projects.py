from sqlalchemy.orm import Session

from app.models.project import Project
from app.repositories.projects import project_repository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectNotFoundError(Exception):
    pass


class ProjectService:
    def create_project(self, db: Session, project_in: ProjectCreate) -> Project:
        return project_repository.create(db, project_in)

    def list_projects(self, db: Session, include_archived: bool = False) -> list[Project]:
        return project_repository.list(db, include_archived=include_archived)

    def get_project(self, db: Session, project_id: int) -> Project:
        project = project_repository.get(db, project_id)
        if project is None:
            raise ProjectNotFoundError(f"Project {project_id} was not found.")
        return project

    def update_project(self, db: Session, project_id: int, project_in: ProjectUpdate) -> Project:
        project = self.get_project(db, project_id)
        return project_repository.update(db, project, project_in)

    def archive_project(self, db: Session, project_id: int) -> Project:
        project = self.get_project(db, project_id)
        return project_repository.archive(db, project)


project_service = ProjectService()

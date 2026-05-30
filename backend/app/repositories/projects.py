from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectStatus
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectRepository:
    def create(self, db: Session, project_in: ProjectCreate) -> Project:
        project = Project(
            name=project_in.name,
            description=project_in.description,
            repo_url=project_in.repo_url,
            production_url=project_in.production_url,
            status=project_in.status.value,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    def list(self, db: Session, include_archived: bool = False) -> list[Project]:
        statement = select(Project).order_by(Project.created_at.desc(), Project.id.desc())
        if not include_archived:
            statement = statement.where(Project.status != ProjectStatus.archived.value)
        return list(db.scalars(statement).all())

    def get(self, db: Session, project_id: int) -> Project | None:
        return db.get(Project, project_id)

    def update(self, db: Session, project: Project, project_in: ProjectUpdate) -> Project:
        update_data = project_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "status" and isinstance(value, ProjectStatus):
                value = value.value
            setattr(project, field, value)

        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    def archive(self, db: Session, project: Project) -> Project:
        project.status = ProjectStatus.archived.value
        db.add(project)
        db.commit()
        db.refresh(project)
        return project


project_repository = ProjectRepository()

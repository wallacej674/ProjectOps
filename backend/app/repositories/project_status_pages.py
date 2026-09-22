from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project_status_page import ProjectStatusPage


class ProjectStatusPageRepository:
    def get_by_project_id(self, db: Session, project_id: int) -> ProjectStatusPage | None:
        return db.scalar(select(ProjectStatusPage).where(ProjectStatusPage.project_id == project_id))

    def get_by_slug(self, db: Session, slug: str) -> ProjectStatusPage | None:
        return db.scalar(select(ProjectStatusPage).where(ProjectStatusPage.slug == slug))


project_status_page_repository = ProjectStatusPageRepository()

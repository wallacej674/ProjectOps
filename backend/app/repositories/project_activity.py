from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_activity import ProjectActivityEvent


class ProjectActivityRepository:
    def create(
        self,
        db: Session,
        *,
        project_id: int,
        event_type: str,
        event_category: str,
        message: str,
        related_resource_type: str | None = None,
        related_resource_id: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ProjectActivityEvent:
        event = ProjectActivityEvent(
            project_id=project_id,
            event_type=event_type,
            event_category=event_category,
            message=message,
            related_resource_type=related_resource_type,
            related_resource_id=related_resource_id,
            metadata_json=metadata,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    def list_by_project_id(
        self,
        db: Session,
        project_id: int,
        *,
        event_category: str | None = None,
        event_type: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> list[ProjectActivityEvent]:
        statement = select(ProjectActivityEvent).where(ProjectActivityEvent.project_id == project_id)
        if event_category:
            statement = statement.where(ProjectActivityEvent.event_category == event_category)
        if event_type:
            statement = statement.where(ProjectActivityEvent.event_type == event_type)
        statement = statement.order_by(ProjectActivityEvent.created_at.desc(), ProjectActivityEvent.id.desc()).limit(limit).offset(offset)
        return list(db.scalars(statement).all())

    def count_by_project_id(self, db: Session, project_id: int) -> int:
        statement = select(func.count(ProjectActivityEvent.id)).where(ProjectActivityEvent.project_id == project_id)
        return int(db.scalar(statement) or 0)

    def list_all(
        self,
        db: Session,
        *,
        event_category: str | None = None,
        event_type: str | None = None,
        project_id: int | None = None,
        owner_user_id: int | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> list[tuple[ProjectActivityEvent, str, str]]:
        statement = select(ProjectActivityEvent, Project.name, Project.status).join(
            Project,
            Project.id == ProjectActivityEvent.project_id,
        )
        if event_category:
            statement = statement.where(ProjectActivityEvent.event_category == event_category)
        if event_type:
            statement = statement.where(ProjectActivityEvent.event_type == event_type)
        if project_id:
            statement = statement.where(ProjectActivityEvent.project_id == project_id)
        if owner_user_id is not None:
            statement = statement.where(Project.owner_user_id == owner_user_id)
        statement = statement.order_by(ProjectActivityEvent.created_at.desc(), ProjectActivityEvent.id.desc()).limit(limit).offset(offset)
        return list(db.execute(statement).all())


project_activity_repository = ProjectActivityRepository()

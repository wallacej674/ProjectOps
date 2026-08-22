from typing import Any

from sqlalchemy.orm import Session

from app.models.project_activity import ProjectActivityEvent
from app.repositories.project_activity import project_activity_repository
from app.schemas.project_activity import CrossProjectActivityEventRead
from app.services.projects import project_service


class ActivityService:
    def record_event(
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
        project_service.get_project(db, project_id)
        return project_activity_repository.create(
            db,
            project_id=project_id,
            event_type=event_type,
            event_category=event_category,
            message=message,
            related_resource_type=related_resource_type,
            related_resource_id=related_resource_id,
            metadata=metadata,
        )

    def list_project_activity(
        self,
        db: Session,
        project_id: int,
        *,
        event_category: str | None = None,
        event_type: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> list[ProjectActivityEvent]:
        project_service.get_project(db, project_id)
        return project_activity_repository.list_by_project_id(
            db,
            project_id,
            event_category=event_category,
            event_type=event_type,
            limit=limit,
            offset=offset,
        )

    def count_project_activity(self, db: Session, project_id: int) -> int:
        project_service.get_project(db, project_id)
        return project_activity_repository.count_by_project_id(db, project_id)

    def list_activity(
        self,
        db: Session,
        *,
        event_category: str | None = None,
        event_type: str | None = None,
        project_id: int | None = None,
        owner_user_id: int | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> list[CrossProjectActivityEventRead]:
        if project_id is not None and owner_user_id is not None:
            project_service.get_project_for_user(db, project_id, owner_user_id)
        elif project_id is not None:
            project_service.get_project(db, project_id)
        events = project_activity_repository.list_all(
            db,
            event_category=event_category,
            event_type=event_type,
            project_id=project_id,
            owner_user_id=owner_user_id,
            limit=limit,
            offset=offset,
        )
        return [
            CrossProjectActivityEventRead.model_validate(
                {
                    "id": event.id,
                    "project_id": event.project_id,
                    "project_name": project_name,
                    "project_status": project_status,
                    "event_type": event.event_type,
                    "event_category": event.event_category,
                    "message": event.message,
                    "related_resource_type": event.related_resource_type,
                    "related_resource_id": event.related_resource_id,
                    "metadata_json": event.metadata_json,
                    "created_at": event.created_at,
                }
            )
            for event, project_name, project_status in events
        ]


activity_service = ActivityService()

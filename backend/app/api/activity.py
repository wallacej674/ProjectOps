from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project_activity import ProjectActivityCategory, ProjectActivityEventType
from app.schemas.project_activity import CrossProjectActivityEventRead
from app.services.activity import activity_service
from app.services.projects import ProjectNotFoundError

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("", response_model=list[CrossProjectActivityEventRead])
def list_activity(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    category: ProjectActivityCategory | None = Query(default=None),
    event_type: ProjectActivityEventType | None = Query(default=None),
    project_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[CrossProjectActivityEventRead]:
    try:
        return activity_service.list_activity(
            db,
            event_category=category.value if category else None,
            event_type=event_type.value if event_type else None,
            project_id=project_id,
            owner_user_id=current_user.id,
            limit=limit,
            offset=offset,
        )
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

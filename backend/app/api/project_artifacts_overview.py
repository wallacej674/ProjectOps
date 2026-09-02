from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.project_artifact import ProjectArtifactOverviewRead
from app.services.project_artifacts import project_artifact_service

router = APIRouter(prefix="/artifacts-overview", tags=["Project Artifacts"])


@router.get("", response_model=list[ProjectArtifactOverviewRead])
def list_cross_project_artifacts_overview(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ProjectArtifactOverviewRead]:
    rows = project_artifact_service.list_artifact_overview_for_owner(db, owner_user_id=current_user.id)
    return [
        ProjectArtifactOverviewRead(
            project_id=project.id,
            project_name=project.name,
            project_status=project.status,
            active_artifact_count=len(artifacts),
            most_recent_title=artifacts[0].title if artifacts else None,
            most_recent_updated_at=artifacts[0].updated_at if artifacts else None,
        )
        for project, artifacts in rows
    ]

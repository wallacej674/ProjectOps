from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.repo_analysis import ProjectRepoAnalysisOverviewRead
from app.services.repo_analyses import repo_analysis_service

router = APIRouter(prefix="/repo-analyses", tags=["Repository Analysis"])


@router.get("", response_model=list[ProjectRepoAnalysisOverviewRead])
def list_cross_project_repo_analysis(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ProjectRepoAnalysisOverviewRead]:
    rows = repo_analysis_service.list_repo_analysis_overview_for_owner(db, owner_user_id=current_user.id)
    return [
        ProjectRepoAnalysisOverviewRead(
            project_id=project.id,
            project_name=project.name,
            project_status=project.status,
            repo_owner=repo.repo_owner if repo else None,
            repo_name=repo.repo_name if repo else None,
            latest_status=latest.status if latest else None,
            summary=latest.summary if latest else None,
            detected_stack=latest.detected_stack if latest else {},
            total_files_scanned=latest.total_files_scanned if latest else None,
            analyzed_at=latest.created_at if latest else None,
        )
        for project, repo, latest in rows
    ]

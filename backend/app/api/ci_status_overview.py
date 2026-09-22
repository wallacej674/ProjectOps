from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ci_status_summary import ProjectCiStatusSummaryRead
from app.services.ci_pipeline_status import ci_pipeline_status_service
from app.services.ci_status_monitor_schedules import ci_status_monitor_schedule_service

router = APIRouter(prefix="/ci-status", tags=["CI Status"])


@router.get("", response_model=list[ProjectCiStatusSummaryRead])
def list_cross_project_ci_status(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ProjectCiStatusSummaryRead]:
    rows = ci_pipeline_status_service.list_latest_ci_status_for_owner(db, owner_user_id=current_user.id)
    summaries = []
    for project, repo, latest_run in rows:
        ci_available = bool(repo and repo.github_installation_id is not None)
        monitor = ci_status_monitor_schedule_service.get_for_project(db, project.id)
        summaries.append(
            ProjectCiStatusSummaryRead(
                project_id=project.id,
                project_name=project.name,
                project_status=project.status,
                repo_owner=repo.repo_owner if repo else None,
                repo_name=repo.repo_name if repo else None,
                ci_available=ci_available,
                needs_reauthorization=ci_available and monitor.last_outcome in ("permission_missing", "repo_not_found"),
                latest_run=latest_run,
                monitor=monitor,
            )
        )
    return summaries

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.health_summary import ProjectHealthSummaryRead
from app.services.health_monitor_schedules import health_monitor_schedule_service
from app.models.health_check import HealthCheck
from sqlalchemy import select
from app.services.health_checks import health_check_service

router = APIRouter(prefix="/health-checks", tags=["Health Checks"])


@router.get("", response_model=list[ProjectHealthSummaryRead])
def list_cross_project_health(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ProjectHealthSummaryRead]:
    pairs = health_check_service.list_latest_health_checks_for_owner(db, owner_user_id=current_user.id)
    return [
        ProjectHealthSummaryRead(
            project_id=project.id,
            project_name=project.name,
            project_status=project.status,
            production_url=project.production_url,
            latest_check=latest_check,
            monitor=health_monitor_schedule_service.get_for_project(db, project.id),
            latest_scheduled_check=db.scalar(select(HealthCheck).where(
                HealthCheck.project_id == project.id, HealthCheck.target_url == project.production_url,
                HealthCheck.execution_source == "scheduled",
            ).order_by(HealthCheck.checked_at.desc(), HealthCheck.id.desc()).limit(1)),
        )
        for project, latest_check in pairs
    ]

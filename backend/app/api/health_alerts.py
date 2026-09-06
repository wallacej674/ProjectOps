from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.health_alert import HealthAlert, HealthAlertEvidence
from app.models.health_check import HealthCheck
from app.schemas.health_alert import AlertStatus, HealthAlertRead, HealthAlertPage, HealthAlertDetail
from app.services.health_alerts import record_transition

router = APIRouter(prefix="/projects/{project_id}/health-alerts", tags=["Health Alerts"])
Database = Annotated[Session, Depends(get_db)]
Account = Annotated[User, Depends(get_current_user)]
PageLimit = Annotated[int, Query(ge=1, le=100)]
PageOffset = Annotated[int, Query(ge=0)]


def owned_project(db: Session, project_id: int, user_id: int, *, lock: bool = False):
    query = select(Project).where(Project.id == project_id, Project.owner_user_id == user_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    if db.scalar(query) is None:
        raise HTTPException(404, "Project not found.")


def get_alert(db: Session, project_id: int, alert_id: int):
    alert = db.scalar(select(HealthAlert).where(HealthAlert.project_id == project_id, HealthAlert.id == alert_id))
    if alert is None:
        raise HTTPException(404, "Health alert not found.")
    return alert


@router.get("", response_model=HealthAlertPage)
def list_alerts(project_id: int, db: Database, current_user: Account, status: AlertStatus | None = None,
                limit: PageLimit = 25, offset: PageOffset = 0):
    owned_project(db, project_id, current_user.id)
    query = select(HealthAlert).where(HealthAlert.project_id == project_id)
    if status:
        query = query.where(HealthAlert.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    return {"items": db.scalars(query.order_by(HealthAlert.opened_at.desc(), HealthAlert.id.desc()).limit(limit).offset(offset)).all(), "total": total}


@router.get("/{alert_id}", response_model=HealthAlertDetail)
def alert_detail(project_id: int, alert_id: int, db: Database, current_user: Account,
                 limit: PageLimit = 25, offset: PageOffset = 0):
    owned_project(db, project_id, current_user.id)
    alert = get_alert(db, project_id, alert_id)
    query = select(HealthCheck).join(HealthAlertEvidence, HealthAlertEvidence.health_check_id == HealthCheck.id).where(
        HealthAlertEvidence.alert_id == alert.id, HealthCheck.project_id == project_id)
    return {"alert": alert, "evidence": {
        "total": db.scalar(select(func.count()).select_from(query.subquery())),
        "items": db.scalars(query.order_by(HealthCheck.checked_at.desc(), HealthCheck.id.desc()).limit(limit).offset(offset)).all(),
    }}


@router.post("/{alert_id}/acknowledge", response_model=HealthAlertRead)
def acknowledge(project_id: int, alert_id: int, db: Database, current_user: Account):
    owned_project(db, project_id, current_user.id, lock=True)
    alert = get_alert(db, project_id, alert_id)
    if alert.acknowledged_at is not None:
        return alert
    if alert.status != "active":
        raise HTTPException(409, "Only active alerts can be acknowledged.")
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by_user_id = current_user.id
    record_transition(db, alert, "acknowledged")
    db.commit()
    db.refresh(alert)
    return alert

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.health_check import HealthCheck


class HealthCheckRepository:
    def create(self, db: Session, health_check: HealthCheck) -> HealthCheck:
        db.add(health_check)
        db.commit()
        db.refresh(health_check)
        return health_check

    def get_latest_by_project_id(self, db: Session, project_id: int) -> HealthCheck | None:
        statement = (
            select(HealthCheck)
            .where(HealthCheck.project_id == project_id)
            .order_by(HealthCheck.checked_at.desc(), HealthCheck.id.desc())
            .limit(1)
        )
        return db.scalar(statement)

    def list_by_project_id(self, db: Session, project_id: int) -> list[HealthCheck]:
        statement = (
            select(HealthCheck)
            .where(HealthCheck.project_id == project_id)
            .order_by(HealthCheck.checked_at.desc(), HealthCheck.id.desc())
        )
        return list(db.scalars(statement).all())

    def get_latest_by_project_ids(self, db: Session, project_ids: list[int]) -> dict[int, HealthCheck]:
        if not project_ids:
            return {}
        statement = (
            select(HealthCheck)
            .where(HealthCheck.project_id.in_(project_ids))
            .distinct(HealthCheck.project_id)
            .order_by(HealthCheck.project_id, HealthCheck.checked_at.desc(), HealthCheck.id.desc())
        )
        return {health_check.project_id: health_check for health_check in db.scalars(statement).all()}


health_check_repository = HealthCheckRepository()

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.readiness import ProjectReadinessItem, ReadinessItem
from app.readiness_catalog import DEFAULT_READINESS_CATALOG


def seed_default_readiness_items(db: Session) -> None:
    stmt = pg_insert(ReadinessItem).values(DEFAULT_READINESS_CATALOG)
    stmt = stmt.on_conflict_do_nothing(index_elements=["key"])
    db.execute(stmt)
    db.commit()


class ReadinessRepository:
    def get_all_active_items(self, db: Session) -> list[ReadinessItem]:
        statement = (
            select(ReadinessItem)
            .where(ReadinessItem.is_active == True)  # noqa: E712
            .order_by(ReadinessItem.sort_order)
        )
        return list(db.scalars(statement).all())

    def get_item_by_key(self, db: Session, key: str) -> ReadinessItem | None:
        return db.scalar(select(ReadinessItem).where(ReadinessItem.key == key))

    def get_project_assessments(self, db: Session, project_id: int) -> list[ProjectReadinessItem]:
        statement = (
            select(ProjectReadinessItem)
            .where(ProjectReadinessItem.project_id == project_id)
            .order_by(ProjectReadinessItem.readiness_item_id)
        )
        return list(db.scalars(statement).all())

    def get_project_assessment_by_key(
        self, db: Session, project_id: int, item_key: str
    ) -> ProjectReadinessItem | None:
        statement = (
            select(ProjectReadinessItem)
            .join(ReadinessItem, ProjectReadinessItem.readiness_item_id == ReadinessItem.id)
            .where(
                ProjectReadinessItem.project_id == project_id,
                ReadinessItem.key == item_key,
            )
        )
        return db.scalar(statement)

    def upsert_project_assessment(
        self,
        db: Session,
        project_id: int,
        readiness_item_id: int,
        status: str,
        source: str,
        evidence: dict | None,
        evaluated_at: datetime,
    ) -> None:
        # Atomic INSERT ... ON CONFLICT DO UPDATE — safe under concurrent evaluate calls.
        # notes is intentionally excluded from set_ so manual engineer notes survive
        # re-evaluation. This method is only called for automatic items.
        stmt = pg_insert(ProjectReadinessItem).values(
            project_id=project_id,
            readiness_item_id=readiness_item_id,
            status=status,
            source=source,
            evidence=evidence,
            evaluated_at=evaluated_at,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_project_readiness_items",
            set_={
                "status": stmt.excluded.status,
                "source": stmt.excluded.source,
                "evidence": stmt.excluded.evidence,
                "evaluated_at": stmt.excluded.evaluated_at,
                # ORM onupdate does not fire for raw execute — set explicitly.
                "updated_at": func.now(),
            },
        )
        db.execute(stmt)
        # Expire any cached ProjectReadinessItem objects so subsequent ORM reads
        # re-query the DB rather than serving stale identity-map state.
        db.flush()

    def update_project_assessment(
        self,
        db: Session,
        assessment: ProjectReadinessItem,
        status: str,
        notes: str | None,
        evaluated_at: datetime,
    ) -> ProjectReadinessItem:
        assessment.status = status
        assessment.notes = notes
        assessment.evaluated_at = evaluated_at
        db.flush()
        return assessment

    def create_project_assessment(
        self,
        db: Session,
        project_id: int,
        readiness_item_id: int,
        status: str,
        source: str,
        notes: str | None,
        evaluated_at: datetime,
    ) -> ProjectReadinessItem:
        item = ProjectReadinessItem(
            project_id=project_id,
            readiness_item_id=readiness_item_id,
            status=status,
            source=source,
            evidence=None,
            notes=notes,
            evaluated_at=evaluated_at,
        )
        db.add(item)
        db.flush()
        return item

    def commit(self, db: Session) -> None:
        db.commit()


readiness_repository = ReadinessRepository()

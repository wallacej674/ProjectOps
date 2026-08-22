from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, selectinload

from app.models.readiness import ProjectReadinessArtifactEvidence, ProjectReadinessItem, ReadinessItem
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
            .options(selectinload(ProjectReadinessItem.item))
            .where(ProjectReadinessItem.project_id == project_id)
            .order_by(ProjectReadinessItem.readiness_item_id)
        )
        return list(db.scalars(statement).all())

    def get_project_assessment_by_key(
        self, db: Session, project_id: int, item_key: str
    ) -> ProjectReadinessItem | None:
        statement = (
            select(ProjectReadinessItem)
            .options(selectinload(ProjectReadinessItem.item))
            .join(ReadinessItem, ProjectReadinessItem.readiness_item_id == ReadinessItem.id)
            .where(
                ProjectReadinessItem.project_id == project_id,
                ReadinessItem.key == item_key,
            )
        )
        return db.scalar(statement)

    def get_artifact_evidence_link(
        self,
        db: Session,
        project_id: int,
        readiness_item_id: int,
        artifact_id: int,
    ) -> ProjectReadinessArtifactEvidence | None:
        statement = (
            select(ProjectReadinessArtifactEvidence)
            .options(
                selectinload(ProjectReadinessArtifactEvidence.item),
                selectinload(ProjectReadinessArtifactEvidence.artifact),
            )
            .where(
                ProjectReadinessArtifactEvidence.project_id == project_id,
                ProjectReadinessArtifactEvidence.readiness_item_id == readiness_item_id,
                ProjectReadinessArtifactEvidence.artifact_id == artifact_id,
            )
        )
        return db.scalar(statement)

    def list_artifact_evidence_links(
        self,
        db: Session,
        project_id: int,
        readiness_item_id: int,
    ) -> list[ProjectReadinessArtifactEvidence]:
        statement = (
            select(ProjectReadinessArtifactEvidence)
            .options(
                selectinload(ProjectReadinessArtifactEvidence.item),
                selectinload(ProjectReadinessArtifactEvidence.artifact),
            )
            .where(
                ProjectReadinessArtifactEvidence.project_id == project_id,
                ProjectReadinessArtifactEvidence.readiness_item_id == readiness_item_id,
            )
            .order_by(ProjectReadinessArtifactEvidence.created_at.desc(), ProjectReadinessArtifactEvidence.id.desc())
        )
        return list(db.scalars(statement).all())

    def list_project_artifact_evidence_links(
        self,
        db: Session,
        project_id: int,
    ) -> list[ProjectReadinessArtifactEvidence]:
        statement = (
            select(ProjectReadinessArtifactEvidence)
            .options(
                selectinload(ProjectReadinessArtifactEvidence.item),
                selectinload(ProjectReadinessArtifactEvidence.artifact),
            )
            .where(ProjectReadinessArtifactEvidence.project_id == project_id)
            .order_by(ProjectReadinessArtifactEvidence.created_at.desc(), ProjectReadinessArtifactEvidence.id.desc())
        )
        return list(db.scalars(statement).all())

    def create_artifact_evidence_link(
        self,
        db: Session,
        project_id: int,
        readiness_item_id: int,
        artifact_id: int,
    ) -> ProjectReadinessArtifactEvidence:
        link = ProjectReadinessArtifactEvidence(
            project_id=project_id,
            readiness_item_id=readiness_item_id,
            artifact_id=artifact_id,
        )
        db.add(link)
        db.commit()
        db.refresh(link)
        return self.get_artifact_evidence_link(db, project_id, readiness_item_id, artifact_id) or link

    def delete_artifact_evidence_link(
        self,
        db: Session,
        link: ProjectReadinessArtifactEvidence,
    ) -> None:
        db.delete(link)
        db.commit()

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

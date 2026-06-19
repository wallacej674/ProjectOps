from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.readiness import ProjectReadinessItem, ReadinessItem

_DEFAULT_READINESS_ITEMS = [
    {
        "key": "readme_present",
        "label": "README Present",
        "description": "The repository has a README.md at its root.",
        "category": "documentation",
        "evaluation_type": "automatic",
        "sort_order": 10,
        "is_active": True,
    },
    {
        "key": "tests_present",
        "label": "Tests Present",
        "description": "The repository contains a tests directory.",
        "category": "testing",
        "evaluation_type": "automatic",
        "sort_order": 20,
        "is_active": True,
    },
    {
        "key": "ci_configured",
        "label": "CI Configured",
        "description": "The repository has GitHub Actions workflows configured.",
        "category": "testing",
        "evaluation_type": "automatic",
        "sort_order": 30,
        "is_active": True,
    },
    {
        "key": "env_example_present",
        "label": "Environment Example Present",
        "description": "The repository has a .env.example file documenting required environment variables.",
        "category": "documentation",
        "evaluation_type": "automatic",
        "sort_order": 40,
        "is_active": True,
    },
    {
        "key": "production_url_configured",
        "label": "Production URL Configured",
        "description": "The project has a production_url set.",
        "category": "observability",
        "evaluation_type": "automatic",
        "sort_order": 50,
        "is_active": True,
    },
    {
        "key": "latest_health_check_healthy",
        "label": "Latest Health Check Healthy",
        "description": "The most recent health check returned a healthy status.",
        "category": "observability",
        "evaluation_type": "automatic",
        "sort_order": 60,
        "is_active": True,
    },
    {
        "key": "deployment_docs_reviewed",
        "label": "Deployment Docs Reviewed",
        "description": "An engineer has reviewed and confirmed the deployment documentation.",
        "category": "engineering_review",
        "evaluation_type": "manual",
        "sort_order": 70,
        "is_active": True,
    },
    {
        "key": "logging_error_handling_reviewed",
        "label": "Logging and Error Handling Reviewed",
        "description": "An engineer has reviewed logging and error handling for production suitability.",
        "category": "engineering_review",
        "evaluation_type": "manual",
        "sort_order": 80,
        "is_active": True,
    },
    {
        "key": "secrets_management_reviewed",
        "label": "Secrets Management Reviewed",
        "description": "An engineer has reviewed how secrets and credentials are managed.",
        "category": "engineering_review",
        "evaluation_type": "manual",
        "sort_order": 90,
        "is_active": True,
    },
]


def seed_default_readiness_items(db: Session) -> None:
    stmt = pg_insert(ReadinessItem).values(_DEFAULT_READINESS_ITEMS)
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
    ) -> ProjectReadinessItem:
        existing = db.scalar(
            select(ProjectReadinessItem).where(
                ProjectReadinessItem.project_id == project_id,
                ProjectReadinessItem.readiness_item_id == readiness_item_id,
            )
        )
        if existing is not None:
            existing.status = status
            existing.source = source
            existing.evidence = evidence
            existing.evaluated_at = evaluated_at
            db.flush()
            return existing

        item = ProjectReadinessItem(
            project_id=project_id,
            readiness_item_id=readiness_item_id,
            status=status,
            source=source,
            evidence=evidence,
            evaluated_at=evaluated_at,
        )
        db.add(item)
        db.flush()
        return item

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

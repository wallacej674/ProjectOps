import math
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.readiness import ProjectReadinessItem, ReadinessItem
from app.repositories.readiness import readiness_repository
from app.repositories.repo_analyses import repo_analysis_repository
from app.repositories.health_checks import health_check_repository
from app.services.projects import project_service


@dataclass
class ReadinessScore:
    score: int | None
    status: str
    passed: int
    failed: int
    unknown: int
    not_applicable: int
    total_applicable: int
    top_gaps: list[str]


class ManualItemUpdateError(Exception):
    pass


class ReadinessItemNotFoundError(Exception):
    pass


def calculate_readiness_score(statuses: list[str]) -> ReadinessScore:
    if not statuses:
        return ReadinessScore(
            score=None,
            status="not_started",
            passed=0,
            failed=0,
            unknown=0,
            not_applicable=0,
            total_applicable=0,
            top_gaps=[],
        )

    passed = statuses.count("passed")
    failed = statuses.count("failed")
    unknown = statuses.count("unknown")
    not_applicable = statuses.count("not_applicable")
    total_applicable = passed + failed + unknown

    if total_applicable == 0:
        score = None
        status = "not_started"
    else:
        score = math.floor(passed / total_applicable * 100)
        if score >= 80:
            status = "strong"
        elif score >= 50:
            status = "in_progress"
        else:
            status = "needs_work"

    return ReadinessScore(
        score=score,
        status=status,
        passed=passed,
        failed=failed,
        unknown=unknown,
        not_applicable=not_applicable,
        total_applicable=total_applicable,
        top_gaps=[],
    )


class ReadinessService:
    def evaluate_project(self, db: Session, project_id: int) -> tuple[list[ProjectReadinessItem], ReadinessScore]:
        project = project_service.get_project(db, project_id)
        catalog = readiness_repository.get_all_active_items(db)
        latest_analysis = repo_analysis_repository.get_latest_completed_by_project_id(db, project_id)
        latest_health_check = health_check_repository.get_latest_by_project_id(db, project_id)
        now = datetime.now(timezone.utc)

        for item in catalog:
            if item.evaluation_type == "automatic":
                status, evidence = _evaluate_automatic_item(item, project, latest_analysis, latest_health_check)
                readiness_repository.upsert_project_assessment(
                    db=db,
                    project_id=project_id,
                    readiness_item_id=item.id,
                    status=status,
                    source=_source_for_item(item.key),
                    evidence=evidence,
                    evaluated_at=now,
                )
            else:
                existing = readiness_repository.get_project_assessment_by_key(db, project_id, item.key)
                if existing is None:
                    readiness_repository.create_project_assessment(
                        db=db,
                        project_id=project_id,
                        readiness_item_id=item.id,
                        status="unknown",
                        source="manual",
                        notes=None,
                        evaluated_at=now,
                    )

        readiness_repository.commit(db)
        assessments = readiness_repository.get_project_assessments(db, project_id)
        statuses = [a.status for a in assessments]
        return assessments, calculate_readiness_score(statuses)

    def get_project_readiness(self, db: Session, project_id: int) -> tuple[list[ProjectReadinessItem], ReadinessScore]:
        project_service.get_project(db, project_id)
        assessments = readiness_repository.get_project_assessments(db, project_id)
        statuses = [a.status for a in assessments]
        return assessments, calculate_readiness_score(statuses)

    def update_manual_item(
        self,
        db: Session,
        project_id: int,
        item_key: str,
        status: str,
        notes: str | None,
    ) -> ProjectReadinessItem:
        project_service.get_project(db, project_id)
        catalog_item = readiness_repository.get_item_by_key(db, item_key)
        if catalog_item is None:
            raise ReadinessItemNotFoundError(f"Readiness item '{item_key}' was not found.")
        if catalog_item.evaluation_type == "automatic":
            raise ManualItemUpdateError(f"Readiness item '{item_key}' is automatic and cannot be updated manually.")

        now = datetime.now(timezone.utc)
        assessment = readiness_repository.get_project_assessment_by_key(db, project_id, item_key)
        if assessment is None:
            assessment = readiness_repository.create_project_assessment(
                db=db,
                project_id=project_id,
                readiness_item_id=catalog_item.id,
                status=status,
                source="manual",
                notes=notes,
                evaluated_at=now,
            )
        else:
            assessment = readiness_repository.update_project_assessment(
                db=db,
                assessment=assessment,
                status=status,
                notes=notes,
                evaluated_at=now,
            )

        db.commit()
        db.refresh(assessment)
        return assessment


def _evaluate_automatic_item(
    item: ReadinessItem,
    project,
    latest_analysis,
    latest_health_check,
) -> tuple[str, dict | None]:
    key = item.key

    if key in ("readme_present", "tests_present", "ci_configured", "env_example_present"):
        signal_map = {
            "readme_present": "has_readme",
            "tests_present": "has_tests",
            "ci_configured": "has_ci",
            "env_example_present": "has_env_example",
        }
        signal_name = signal_map[key]
        if latest_analysis is None:
            return "unknown", None
        value = latest_analysis.signals.get(signal_name, False)
        status = "passed" if value else "failed"
        evidence = {"analysis_id": latest_analysis.id, "signal": signal_name, "value": value}
        return status, evidence

    if key == "production_url_configured":
        present = bool(project.production_url)
        status = "passed" if present else "failed"
        evidence = {"field": "production_url", "present": present}
        return status, evidence

    if key == "latest_health_check_healthy":
        if latest_health_check is None:
            return "unknown", None
        is_healthy = latest_health_check.status == "healthy"
        status = "passed" if is_healthy else "failed"
        evidence = {"health_check_id": latest_health_check.id, "status": latest_health_check.status}
        return status, evidence

    return "unknown", None


def _source_for_item(key: str) -> str:
    if key in ("readme_present", "tests_present", "ci_configured", "env_example_present"):
        return "codemap"
    if key == "production_url_configured":
        return "project"
    if key == "latest_health_check_healthy":
        return "health_check"
    return "manual"


readiness_service = ReadinessService()

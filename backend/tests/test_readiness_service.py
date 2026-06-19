import pytest

from app.schemas.project import ProjectCreate
from app.services.health_checks import health_check_service
from app.services.projects import project_service
from app.services.readiness import (
    ManualItemUpdateError,
    ReadinessItemNotFoundError,
    calculate_readiness_score,
    readiness_service,
)
from app.schemas.health_check import HealthCheckRunRequest


# ---------------------------------------------------------------------------
# Score calculation (pure function — no DB needed)
# ---------------------------------------------------------------------------

def test_score_all_passed_returns_100_and_strong():
    score = calculate_readiness_score(["passed"] * 6)

    assert score.score == 100
    assert score.status == "strong"
    assert score.passed == 6
    assert score.failed == 0
    assert score.unknown == 0
    assert score.not_applicable == 0
    assert score.total_applicable == 6


def test_score_empty_list_returns_not_started():
    score = calculate_readiness_score([])

    assert score.score is None
    assert score.status == "not_started"
    assert score.total_applicable == 0


def test_score_floor_division_and_in_progress():
    # 4/6 = 66.66 → floor → 66 → in_progress
    score = calculate_readiness_score(["passed"] * 4 + ["failed"] * 2)

    assert score.score == 66
    assert score.status == "in_progress"
    assert score.passed == 4
    assert score.failed == 2
    assert score.total_applicable == 6


def test_score_excludes_not_applicable_from_denominator():
    # 3 passed, 1 N/A, 2 failed → denominator is 5
    score = calculate_readiness_score(["passed"] * 3 + ["not_applicable"] * 1 + ["failed"] * 2)

    assert score.score == 60
    assert score.total_applicable == 5
    assert score.not_applicable == 1


def test_score_all_unknown_returns_needs_work():
    score = calculate_readiness_score(["unknown"] * 6)

    assert score.score == 0
    assert score.status == "needs_work"
    assert score.unknown == 6


# ---------------------------------------------------------------------------
# Helpers for DB-backed evaluation tests
# ---------------------------------------------------------------------------

def _create_project(db, production_url="https://example.com"):
    return project_service.create_project(
        db,
        ProjectCreate(
            name="TestApp",
            description=None,
            repo_url=None,
            production_url=production_url,
            status="development",
        ),
    )


def _create_repo_integration(db, project_id):
    from app.models.repo_integration import RepoIntegration, RepoProvider
    repo = RepoIntegration(
        project_id=project_id,
        provider=RepoProvider.github.value,
        repo_owner="example",
        repo_name="repo",
        repo_url="https://github.com/example/repo",
        is_connected=True,
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    return repo


def _create_completed_analysis(db, project_id, repo_integration_id, signals: dict):
    from app.models.repo_analysis import RepoAnalysis
    from app.repositories.repo_analyses import repo_analysis_repository
    all_signals = {
        "has_readme": False, "has_backend": False, "has_frontend": False,
        "has_tests": False, "has_ci": False, "has_docker": False,
        "has_env_example": False, "has_migrations": False, "has_python": False,
        "has_fastapi": False, "has_sqlalchemy": False, "has_alembic": False,
        "has_react": False, "has_typescript": False, "has_vite": False,
    }
    all_signals.update(signals)
    return repo_analysis_repository.create(
        db,
        RepoAnalysis(
            project_id=project_id,
            repo_integration_id=repo_integration_id,
            status="completed",
            summary="Test analysis.",
            detected_stack={"languages": [], "frameworks": [], "tools": []},
            detected_files=[],
            detected_folders=[],
            signals=all_signals,
            warnings=[],
            error_message=None,
            total_files_scanned=1,
        ),
    )


def _create_health_check(db, project_id, status="healthy"):
    from datetime import datetime, timezone
    from app.models.health_check import HealthCheck
    from app.repositories.health_checks import health_check_repository
    return health_check_repository.create(
        db,
        HealthCheck(
            project_id=project_id,
            target_url="https://example.com",
            status=status,
            http_status_code=200 if status == "healthy" else 500,
            response_time_ms=100,
            checked_at=datetime.now(timezone.utc),
            error_message=None,
            response_preview=None,
        ),
    )


def _find_item(assessments, key):
    return next((a for a in assessments if True), None)


# ---------------------------------------------------------------------------
# Automatic evaluation (E1-E5) — DB required
# ---------------------------------------------------------------------------

def test_evaluate_readme_passed_when_signal_true(db):
    project = _create_project(db)
    repo = _create_repo_integration(db, project.id)
    _create_completed_analysis(db, project.id, repo.id, {"has_readme": True})

    assessments, score = readiness_service.evaluate_project(db, project.id)

    readme = next(a for a in assessments if a.readiness_item_id is not None
                  and _item_key(db, a) == "readme_present")
    assert readme.status == "passed"
    assert readme.source == "codemap"
    assert readme.evidence["signal"] == "has_readme"
    assert readme.evidence["value"] is True


def test_evaluate_readme_failed_when_signal_false(db):
    project = _create_project(db)
    repo = _create_repo_integration(db, project.id)
    _create_completed_analysis(db, project.id, repo.id, {"has_readme": False})

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    readme = next(a for a in assessments if _item_key(db, a) == "readme_present")
    assert readme.status == "failed"
    assert readme.evidence["value"] is False


def test_evaluate_codemap_items_unknown_when_no_completed_analysis(db):
    project = _create_project(db)

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    codemap_keys = {"readme_present", "tests_present", "ci_configured", "env_example_present"}
    for assessment in assessments:
        if _item_key(db, assessment) in codemap_keys:
            assert assessment.status == "unknown"


def test_evaluate_production_url_passed_when_url_set(db):
    project = _create_project(db, production_url="https://myapp.example.com")

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    item = next(a for a in assessments if _item_key(db, a) == "production_url_configured")
    assert item.status == "passed"
    assert item.evidence["present"] is True


def test_evaluate_production_url_failed_when_url_missing(db):
    project = _create_project(db, production_url=None)

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    item = next(a for a in assessments if _item_key(db, a) == "production_url_configured")
    assert item.status == "failed"
    assert item.evidence["present"] is False


def test_evaluate_health_check_passed_when_healthy(db):
    project = _create_project(db)
    _create_health_check(db, project.id, status="healthy")

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    item = next(a for a in assessments if _item_key(db, a) == "latest_health_check_healthy")
    assert item.status == "passed"
    assert item.evidence["status"] == "healthy"


def test_evaluate_health_check_failed_when_unhealthy(db):
    project = _create_project(db)
    _create_health_check(db, project.id, status="unhealthy")

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    item = next(a for a in assessments if _item_key(db, a) == "latest_health_check_healthy")
    assert item.status == "failed"


def test_evaluate_health_check_unknown_when_no_check(db):
    project = _create_project(db)

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    item = next(a for a in assessments if _item_key(db, a) == "latest_health_check_healthy")
    assert item.status == "unknown"


# ---------------------------------------------------------------------------
# Manual item behavior (M1-M4)
# ---------------------------------------------------------------------------

def test_manual_items_start_as_unknown_after_evaluate(db):
    project = _create_project(db)

    assessments, _ = readiness_service.evaluate_project(db, project.id)

    manual_keys = {"deployment_docs_reviewed", "logging_error_handling_reviewed", "secrets_management_reviewed"}
    for assessment in assessments:
        if _item_key(db, assessment) in manual_keys:
            assert assessment.status == "unknown"
            assert assessment.source == "manual"


def test_update_manual_item_changes_status_and_notes(db):
    project = _create_project(db)
    readiness_service.evaluate_project(db, project.id)

    result = readiness_service.update_manual_item(
        db, project.id, "secrets_management_reviewed", "passed", "Reviewed on 2026-06-19."
    )

    assert result.status == "passed"
    assert result.notes == "Reviewed on 2026-06-19."


def test_update_manual_item_rejects_automatic_item(db):
    project = _create_project(db)

    with pytest.raises(ManualItemUpdateError):
        readiness_service.update_manual_item(db, project.id, "readme_present", "passed", None)


def test_evaluate_preserves_manual_item_status(db):
    project = _create_project(db)
    readiness_service.evaluate_project(db, project.id)
    readiness_service.update_manual_item(
        db, project.id, "secrets_management_reviewed", "passed", "Done."
    )

    readiness_service.evaluate_project(db, project.id)

    assessments = readiness_service.get_project_readiness(db, project.id)[0]
    item = next(a for a in assessments if _item_key(db, a) == "secrets_management_reviewed")
    assert item.status == "passed"
    assert item.notes == "Done."


# ---------------------------------------------------------------------------
# Helper to look up catalog key from an assessment row
# ---------------------------------------------------------------------------

def _item_key(db, assessment) -> str:
    from app.models.readiness import ReadinessItem
    from sqlalchemy import select
    from app.core.database import SessionLocal
    item = db.get(ReadinessItem, assessment.readiness_item_id)
    return item.key if item else ""

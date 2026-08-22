from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.health_check import HealthCheck, HealthCheckStatus
from app.models.project import Project
from app.models.repo_analysis import RepoAnalysis, RepoAnalysisStatus
from app.repositories.health_checks import health_check_repository
from app.repositories.repo_analyses import repo_analysis_repository
from app.schemas.project import ProjectCreate
from app.schemas.project_artifact import ProjectArtifactCreate
from app.schemas.repo_integration import RepoIntegrationCreate
from app.services.activity import activity_service
from app.services.project_artifacts import project_artifact_service
from app.services.projects import project_service
from app.services.readiness import readiness_service
from app.services.repo_integrations import repo_integration_service

DEMO_PROJECT_NAME = "ProjectOps Demo Command Center"
DEMO_COMPANION_PROJECT_NAME = "Checkout API Modernization"


class DemoDataDisabledError(Exception):
    pass


class DemoDataService:
    def is_enabled(self, environment: str) -> bool:
        return environment.lower() not in {"production", "prod"}

    def disabled_reason(self, environment: str) -> str | None:
        if self.is_enabled(environment):
            return None
        return "Demo data seeding is disabled in production environments."

    def seed_demo_workspace(self, db: Session, environment: str, owner_user_id: int | None = None) -> tuple[Project, bool]:
        if not self.is_enabled(environment):
            raise DemoDataDisabledError("Demo data seeding is disabled in production environments.")

        existing = self._get_project_by_name(db, DEMO_PROJECT_NAME, owner_user_id)
        if existing is not None:
            self._ensure_companion_project(db, owner_user_id)
            return existing, False

        project = project_service.create_project(
            db,
            ProjectCreate(
                name=DEMO_PROJECT_NAME,
                description=(
                    "A sample workspace showing repository intake, CodeMap Lite, manual health checks, "
                    "readiness review, artifacts, evidence links, and recent activity."
                ),
                repo_url="https://github.com/projectops/demo-command-center",
                production_url="https://demo.projectops.example.com",
                status="staging",
            ),
            owner_user_id=owner_user_id,
        )
        repo = repo_integration_service.attach_github_repo(
            db,
            project.id,
            RepoIntegrationCreate(repo_url="https://github.com/projectops/demo-command-center"),
        )
        repo.default_branch = "main"
        repo.last_verified_at = datetime.now(timezone.utc)
        db.add(repo)
        db.commit()
        db.refresh(repo)

        analysis = repo_analysis_repository.create(
            db,
            RepoAnalysis(
                project_id=project.id,
                repo_integration_id=repo.id,
                status=RepoAnalysisStatus.completed.value,
                summary="CodeMap Lite detected a FastAPI backend, React/Vite frontend, tests, CI, and deployment docs.",
                detected_stack={
                    "languages": ["python", "typescript"],
                    "frameworks": ["fastapi", "react", "vite"],
                    "tools": ["docker", "alembic", "github actions", "vitest"],
                },
                detected_files=[
                    "README.md",
                    "backend/app/main.py",
                    "backend/pyproject.toml",
                    "frontend/package.json",
                    ".github/workflows/ci.yml",
                    "docs/deployment-readiness.md",
                ],
                detected_folders=["backend/app", "backend/tests", "frontend/src", "docs"],
                signals={
                    "has_readme": True,
                    "has_tests": True,
                    "has_ci": True,
                    "has_env_example": False,
                    "has_docker": True,
                    "has_migrations": True,
                },
                warnings=["No .env.example file was detected in the repository tree snapshot."],
                error_message=None,
                total_files_scanned=126,
            ),
        )
        activity_service.record_event(
            db,
            project_id=project.id,
            event_type="codemap_analysis_completed",
            event_category="codemap",
            message="CodeMap Lite analysis completed.",
            related_resource_type="repo_analysis",
            related_resource_id=analysis.id,
            metadata={"status": analysis.status, "total_files_scanned": analysis.total_files_scanned},
        )

        checked_at = datetime.now(timezone.utc)
        health_check = health_check_repository.create(
            db,
            HealthCheck(
                project_id=project.id,
                target_url=project.production_url or "https://demo.projectops.example.com",
                status=HealthCheckStatus.healthy.value,
                http_status_code=200,
                response_time_ms=245,
                checked_at=checked_at,
                error_message=None,
                response_preview='{"status":"ok","service":"projectops-demo"}',
            ),
        )
        activity_service.record_event(
            db,
            project_id=project.id,
            event_type="health_check_healthy",
            event_category="health",
            message="Manual health check was healthy.",
            related_resource_type="health_check",
            related_resource_id=health_check.id,
            metadata={"http_status_code": 200, "response_time_ms": 245},
        )

        runbook = project_artifact_service.create_project_artifact(
            db,
            project.id,
            ProjectArtifactCreate(
                title="Deployment runbook",
                artifact_type="runbook",
                source_type="external_url",
                url="https://docs.example.com/projectops/deployment-runbook",
                summary="Step-by-step deployment and rollback reference for the demo service.",
                tags="deployment,runbook,readiness",
            ),
        )
        project_artifact_service.create_project_artifact(
            db,
            project.id,
            ProjectArtifactCreate(
                title="Release risk review",
                artifact_type="risk",
                source_type="manual",
                summary="Known demo risk: environment variable documentation still needs a final pass.",
                content="The team reviewed deployment flow and health evidence, but env var examples are incomplete.",
                tags="release,risk,review",
            ),
        )
        project_artifact_service.create_project_artifact(
            db,
            project.id,
            ProjectArtifactCreate(
                title="Production readiness notes",
                artifact_type="evidence",
                source_type="manual",
                summary="Supporting notes for manual readiness review items.",
                content="Deployment docs and logging behavior were reviewed during the demo readiness pass.",
                tags="readiness,evidence",
            ),
        )

        readiness_service.evaluate_project(db, project.id)
        readiness_service.update_manual_item(
            db,
            project.id,
            "deployment_docs_reviewed",
            "passed",
            "Deployment runbook reviewed for the demo workspace.",
        )
        readiness_service.update_manual_item(
            db,
            project.id,
            "logging_error_handling_reviewed",
            "passed",
            "Demo service logs expected startup and health-check failures clearly.",
        )
        readiness_service.link_artifact_evidence(db, project.id, "deployment_docs_reviewed", runbook.id)

        self._ensure_companion_project(db, owner_user_id)
        return project, True

    def _ensure_companion_project(self, db: Session, owner_user_id: int | None) -> None:
        if self._get_project_by_name(db, DEMO_COMPANION_PROJECT_NAME, owner_user_id) is not None:
            return
        project_service.create_project(
            db,
            ProjectCreate(
                name=DEMO_COMPANION_PROJECT_NAME,
                description="A lighter sample Project that still needs repository analysis and health evidence.",
                repo_url="https://github.com/projectops/checkout-api-modernization",
                production_url=None,
                status="development",
            ),
            owner_user_id=owner_user_id,
        )

    def _get_project_by_name(self, db: Session, name: str, owner_user_id: int | None) -> Project | None:
        statement = select(Project).where(Project.name == name)
        if owner_user_id is None:
            statement = statement.where(Project.owner_user_id.is_(None))
        else:
            statement = statement.where(Project.owner_user_id == owner_user_id)
        return db.scalar(statement.limit(1))


demo_data_service = DemoDataService()

from sqlalchemy.orm import Session

from app.models.health_check import HealthCheck
from app.models.project import Project
from app.models.project_activity import ProjectActivityEvent
from app.models.project_artifact import ProjectArtifact, ProjectArtifactStatus
from app.models.readiness import ProjectReadinessItem, ReadinessItem
from app.models.repo_analysis import RepoAnalysis
from app.models.repo_integration import RepoIntegration
from app.repositories.health_checks import health_check_repository
from app.repositories.project_activity import project_activity_repository
from app.repositories.project_artifacts import project_artifact_repository
from app.repositories.readiness import readiness_repository
from app.repositories.repo_analyses import repo_analysis_repository
from app.repositories.repo_integrations import repo_integration_repository
from app.schemas.dashboard import (
    DashboardArtifacts,
    DashboardActivity,
    DashboardLatestArtifact,
    DashboardLatestActivityEvent,
    DashboardReadiness,
    DashboardRepoStatus,
    ProjectDashboardRead,
)
from app.schemas.health_check import HealthCheckRead
from app.schemas.project import ProjectRead
from app.schemas.repo_analysis import RepoAnalysisRead
from app.services.projects import project_service
from app.services.readiness import calculate_readiness_score, compute_top_gaps


class DashboardService:
    def get_project_dashboard(self, db: Session, project_id: int) -> ProjectDashboardRead:
        project = project_service.get_project(db, project_id)
        repo_integration = repo_integration_repository.get_by_project_id(db, project_id)
        latest_repo_analysis = repo_analysis_repository.get_latest_by_project_id(db, project_id)
        latest_health_check = health_check_repository.get_latest_by_project_id(db, project_id)
        assessments = readiness_repository.get_project_assessments(db, project_id)
        catalog = readiness_repository.get_all_active_items(db)
        artifacts = project_artifact_repository.list(db, project_id, include_archived=True)
        recent_activity = project_activity_repository.list_by_project_id(db, project_id, limit=1)
        activity_count = project_activity_repository.count_by_project_id(db, project_id)
        return self.build_project_dashboard(
            project,
            repo_integration,
            latest_repo_analysis,
            latest_health_check,
            assessments,
            catalog,
            artifacts,
            recent_activity,
            activity_count,
        )

    def build_project_dashboard(
        self,
        project: Project,
        repo_integration: RepoIntegration | None = None,
        latest_repo_analysis: RepoAnalysis | None = None,
        latest_health_check: HealthCheck | None = None,
        assessments: list[ProjectReadinessItem] | None = None,
        catalog: list[ReadinessItem] | None = None,
        artifacts: list[ProjectArtifact] | None = None,
        recent_activity: list[ProjectActivityEvent] | None = None,
        activity_count: int = 0,
    ) -> ProjectDashboardRead:
        return ProjectDashboardRead(
            project=ProjectRead.model_validate(project),
            repo=self.build_repo_status(repo_integration),
            latest_repo_analysis=self.build_latest_repo_analysis(latest_repo_analysis),
            latest_health_check=self.build_latest_health_check(latest_health_check),
            readiness=self.build_readiness_summary(assessments or [], catalog or []),
            artifacts=self.build_artifacts_summary(artifacts or []),
            activity=self.build_activity_summary(recent_activity or [], activity_count),
            next_steps=self.build_next_steps(repo_integration, latest_repo_analysis, latest_health_check),
        )

    def build_artifacts_summary(self, artifacts: list[ProjectArtifact]) -> DashboardArtifacts:
        active_artifacts = [
            artifact for artifact in artifacts if artifact.status == ProjectArtifactStatus.active.value
        ]
        archived_count = len(
            [artifact for artifact in artifacts if artifact.status == ProjectArtifactStatus.archived.value]
        )
        latest_active = active_artifacts[0] if active_artifacts else None
        latest_artifact = (
            DashboardLatestArtifact(
                id=latest_active.id,
                title=latest_active.title,
                artifact_type=latest_active.artifact_type,
                source_type=latest_active.source_type,
                updated_at=latest_active.updated_at,
            )
            if latest_active
            else None
        )
        return DashboardArtifacts(
            active_count=len(active_artifacts),
            archived_count=archived_count,
            total_count=len(artifacts),
            latest_artifact=latest_artifact,
        )

    def build_activity_summary(
        self,
        recent_activity: list[ProjectActivityEvent],
        activity_count: int,
    ) -> DashboardActivity:
        latest = recent_activity[0] if recent_activity else None
        latest_event = (
            DashboardLatestActivityEvent(
                id=latest.id,
                event_type=latest.event_type,
                event_category=latest.event_category,
                message=latest.message,
                related_resource_type=latest.related_resource_type,
                related_resource_id=latest.related_resource_id,
                created_at=latest.created_at,
            )
            if latest
            else None
        )
        return DashboardActivity(recent_count=activity_count, latest_event=latest_event)

    def build_readiness_summary(
        self,
        assessments: list[ProjectReadinessItem],
        catalog: list[ReadinessItem],
    ) -> DashboardReadiness:
        statuses = [a.status for a in assessments]
        score = calculate_readiness_score(statuses)
        return DashboardReadiness(
            score=score.score,
            status=score.status,
            passed=score.passed,
            failed=score.failed,
            unknown=score.unknown,
            not_applicable=score.not_applicable,
            total_applicable=score.total_applicable,
            top_gaps=compute_top_gaps(assessments, catalog),
        )

    def build_latest_repo_analysis(self, latest_repo_analysis: RepoAnalysis | None) -> RepoAnalysisRead | None:
        if latest_repo_analysis is None:
            return None
        return RepoAnalysisRead.model_validate(latest_repo_analysis)

    def build_latest_health_check(self, latest_health_check: HealthCheck | None) -> HealthCheckRead | None:
        if latest_health_check is None:
            return None
        return HealthCheckRead.model_validate(latest_health_check)

    def build_repo_status(self, repo_integration: RepoIntegration | None) -> DashboardRepoStatus:
        if repo_integration is None:
            return DashboardRepoStatus(
                repo_url=None,
                connected=False,
                provider=None,
                repo_owner=None,
                repo_name=None,
                default_branch=None,
                last_verified_at=None,
                message="No GitHub repository has been attached yet.",
            )

        return DashboardRepoStatus(
            repo_url=repo_integration.repo_url,
            connected=repo_integration.is_connected,
            provider=repo_integration.provider,
            repo_owner=repo_integration.repo_owner,
            repo_name=repo_integration.repo_name,
            default_branch=repo_integration.default_branch,
            last_verified_at=repo_integration.last_verified_at,
            message="GitHub repository attached.",
        )

    def build_next_steps(
        self,
        repo_integration: RepoIntegration | None,
        latest_repo_analysis: RepoAnalysis | None,
        latest_health_check: HealthCheck | None,
    ) -> list[str]:
        next_steps = ["Complete the production readiness checklist in a future milestone."]
        if repo_integration is None:
            next_steps.insert(0, "Attach a GitHub repository to start repo intake.")
        elif latest_repo_analysis is None:
            next_steps.insert(0, "Run CodeMap Lite analysis for the attached repo.")
        if latest_health_check is None:
            insert_at = max(0, len(next_steps) - 1)
            next_steps.insert(insert_at, "Run a manual health check for the Project.")
        return next_steps


dashboard_service = DashboardService()

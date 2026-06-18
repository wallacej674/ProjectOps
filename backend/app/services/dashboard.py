from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.repo_integration import RepoIntegration
from app.repositories.repo_integrations import repo_integration_repository
from app.schemas.dashboard import DashboardReadiness, DashboardRepoStatus, ProjectDashboardRead
from app.schemas.project import ProjectRead
from app.services.projects import project_service


class DashboardService:
    def get_project_dashboard(self, db: Session, project_id: int) -> ProjectDashboardRead:
        project = project_service.get_project(db, project_id)
        repo_integration = repo_integration_repository.get_by_project_id(db, project_id)
        return self.build_project_dashboard(project, repo_integration)

    def build_project_dashboard(
        self,
        project: Project,
        repo_integration: RepoIntegration | None = None,
    ) -> ProjectDashboardRead:
        return ProjectDashboardRead(
            project=ProjectRead.model_validate(project),
            repo=self.build_repo_status(repo_integration),
            latest_repo_analysis=None,
            latest_health_check=None,
            readiness=DashboardReadiness(
                score=None,
                status="not_started",
                message="Production readiness scoring has not been implemented yet.",
            ),
            next_steps=self.build_next_steps(repo_integration),
        )

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
            message="GitHub repository attached. Repository analysis has not been implemented yet.",
        )

    def build_next_steps(self, repo_integration: RepoIntegration | None) -> list[str]:
        next_steps = [
            "Run CodeMap Lite analysis in a future milestone.",
            "Add a health endpoint check in a future milestone.",
            "Complete the production readiness checklist in a future milestone.",
        ]
        if repo_integration is None:
            return ["Attach a GitHub repository to start repo intake.", *next_steps]
        return next_steps


dashboard_service = DashboardService()

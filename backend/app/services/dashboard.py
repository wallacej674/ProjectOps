from sqlalchemy.orm import Session

from app.models.project import Project
from app.schemas.dashboard import DashboardReadiness, DashboardRepoStatus, ProjectDashboardRead
from app.schemas.project import ProjectRead
from app.services.projects import project_service


class DashboardService:
    def get_project_dashboard(self, db: Session, project_id: int) -> ProjectDashboardRead:
        project = project_service.get_project(db, project_id)
        return self.build_project_dashboard(project)

    def build_project_dashboard(self, project: Project) -> ProjectDashboardRead:
        return ProjectDashboardRead(
            project=ProjectRead.model_validate(project),
            repo=DashboardRepoStatus(
                repo_url=project.repo_url,
                connected=False,
                message="GitHub repo intake has not been implemented yet.",
            ),
            latest_repo_analysis=None,
            latest_health_check=None,
            readiness=DashboardReadiness(
                score=None,
                status="not_started",
                message="Production readiness scoring has not been implemented yet.",
            ),
            next_steps=[
                "Connect a GitHub repository in a future milestone.",
                "Run CodeMap Lite analysis in a future milestone.",
                "Add a health endpoint check in a future milestone.",
                "Complete the production readiness checklist in a future milestone.",
            ],
        )


dashboard_service = DashboardService()

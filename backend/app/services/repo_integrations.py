from sqlalchemy.orm import Session

from app.models.repo_integration import RepoIntegration
from app.repositories.repo_integrations import repo_integration_repository
from app.schemas.repo_integration import RepoIntegrationCreate
from app.services.github_repo_parser import parse_github_repo_url
from app.services.projects import project_service


class RepoIntegrationNotFoundError(Exception):
    pass


class RepoIntegrationService:
    def attach_github_repo(
        self,
        db: Session,
        project_id: int,
        repo_integration_in: RepoIntegrationCreate,
    ) -> RepoIntegration:
        project_service.get_project(db, project_id)
        parsed_repo = parse_github_repo_url(repo_integration_in.repo_url)
        return repo_integration_repository.upsert_github_repo(db, project_id, parsed_repo)

    def get_project_repo(self, db: Session, project_id: int) -> RepoIntegration:
        project_service.get_project(db, project_id)
        repo_integration = repo_integration_repository.get_by_project_id(db, project_id)
        if repo_integration is None:
            raise RepoIntegrationNotFoundError(f"Project {project_id} does not have an attached repo.")
        return repo_integration

    def remove_project_repo(self, db: Session, project_id: int) -> None:
        repo_integration = self.get_project_repo(db, project_id)
        repo_integration_repository.delete(db, repo_integration)


repo_integration_service = RepoIntegrationService()

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.repo_integration import RepoIntegration, RepoProvider
from app.services.github_repo_parser import ParsedGitHubRepo


class RepoIntegrationRepository:
    def get_by_project_id(self, db: Session, project_id: int) -> RepoIntegration | None:
        statement = select(RepoIntegration).where(RepoIntegration.project_id == project_id)
        return db.scalar(statement)

    def upsert_github_repo(self, db: Session, project_id: int, parsed_repo: ParsedGitHubRepo) -> RepoIntegration:
        repo_integration = self.get_by_project_id(db, project_id)
        if repo_integration is None:
            repo_integration = RepoIntegration(project_id=project_id)

        repo_integration.provider = RepoProvider.github.value
        repo_integration.repo_owner = parsed_repo.repo_owner
        repo_integration.repo_name = parsed_repo.repo_name
        repo_integration.repo_url = parsed_repo.repo_url
        repo_integration.default_branch = None
        repo_integration.is_connected = True
        repo_integration.last_verified_at = None

        db.add(repo_integration)
        db.commit()
        db.refresh(repo_integration)
        return repo_integration

    def delete(self, db: Session, repo_integration: RepoIntegration) -> None:
        db.delete(repo_integration)
        db.commit()


repo_integration_repository = RepoIntegrationRepository()

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
        existing_repo = repo_integration_repository.get_by_project_id(db, project_id)
        parsed_repo = parse_github_repo_url(repo_integration_in.repo_url)
        repo_integration = repo_integration_repository.upsert_github_repo(db, project_id, parsed_repo)
        from app.services.activity import activity_service

        repo_label = f"{repo_integration.repo_owner}/{repo_integration.repo_name}"
        activity_service.record_event(
            db,
            project_id=project_id,
            event_type="repository_replaced" if existing_repo else "repository_attached",
            event_category="repository",
            message="Repository was replaced." if existing_repo else "Repository was attached.",
            related_resource_type="repo_integration",
            related_resource_id=repo_integration.id,
            metadata={"repo": repo_label, "provider": repo_integration.provider},
        )
        return repo_integration

    def get_project_repo(self, db: Session, project_id: int) -> RepoIntegration:
        project_service.get_project(db, project_id)
        repo_integration = repo_integration_repository.get_by_project_id(db, project_id)
        if repo_integration is None:
            raise RepoIntegrationNotFoundError(f"Project {project_id} does not have an attached repo.")
        return repo_integration

    def remove_project_repo(self, db: Session, project_id: int) -> None:
        repo_integration = self.get_project_repo(db, project_id)
        repo_label = f"{repo_integration.repo_owner}/{repo_integration.repo_name}"
        repo_id = repo_integration.id
        repo_integration_repository.delete(db, repo_integration)
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=project_id,
            event_type="repository_removed",
            event_category="repository",
            message="Repository connection was removed.",
            related_resource_type="repo_integration",
            related_resource_id=repo_id,
            metadata={"repo": repo_label},
        )


repo_integration_service = RepoIntegrationService()

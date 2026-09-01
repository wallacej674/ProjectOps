from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.repo_integration import GitHubInstallation, RepoIntegration, RepoProvider
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
        repo_integration.github_repository_id = None
        repo_integration.github_installation_id = None
        repo_integration.is_private = False
        repo_integration.connection_mode = "public_url"

        db.add(repo_integration)
        db.commit()
        db.refresh(repo_integration)
        return repo_integration

    def upsert_github_app_repo(
        self, db: Session, project_id: int, *, installation_id: int, repository: dict
    ) -> RepoIntegration:
        repo_integration = self.get_by_project_id(db, project_id) or RepoIntegration(project_id=project_id)
        owner, name = repository["full_name"].split("/", 1)
        repo_integration.provider = RepoProvider.github.value
        repo_integration.repo_owner = owner
        repo_integration.repo_name = name
        repo_integration.repo_url = repository["html_url"]
        repo_integration.default_branch = repository.get("default_branch")
        repo_integration.is_connected = True
        repo_integration.github_repository_id = repository["id"]
        repo_integration.github_installation_id = installation_id
        repo_integration.is_private = bool(repository.get("private"))
        repo_integration.connection_mode = "github_app"
        db.add(repo_integration)
        db.commit()
        db.refresh(repo_integration)
        return repo_integration

    def delete(self, db: Session, repo_integration: RepoIntegration) -> None:
        db.delete(repo_integration)
        db.commit()


repo_integration_repository = RepoIntegrationRepository()


class GitHubInstallationRepository:
    def upsert_many(self, db: Session, owner_user_id: int, installations: list[dict]) -> list[GitHubInstallation]:
        stored: list[GitHubInstallation] = []
        for payload in installations:
            installation_id = int(payload["id"])
            row = db.scalar(
                select(GitHubInstallation).where(
                    GitHubInstallation.owner_user_id == owner_user_id,
                    GitHubInstallation.installation_id == installation_id,
                )
            ) or GitHubInstallation(owner_user_id=owner_user_id, installation_id=installation_id)
            account = payload["account"]
            row.account_id = int(account["id"])
            row.account_login = str(account["login"])
            row.account_type = str(account.get("type") or "Unknown")
            db.add(row)
            stored.append(row)
        db.commit()
        for row in stored:
            db.refresh(row)
        return stored

    def list_for_user(self, db: Session, owner_user_id: int) -> list[GitHubInstallation]:
        return list(db.scalars(select(GitHubInstallation).where(GitHubInstallation.owner_user_id == owner_user_id)).all())

    def get_for_user(self, db: Session, owner_user_id: int, installation_id: int) -> GitHubInstallation | None:
        return db.scalar(select(GitHubInstallation).where(
            GitHubInstallation.owner_user_id == owner_user_id,
            GitHubInstallation.installation_id == installation_id,
        ))


github_installation_repository = GitHubInstallationRepository()

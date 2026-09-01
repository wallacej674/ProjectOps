from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.repositories.repo_integrations import github_installation_repository


class GitHubAppConfigurationError(Exception): pass
class GitHubAppAuthorizationError(Exception): pass
class GitHubRepositorySelectionError(Exception): pass


class GitHubAppService:
    api_url = "https://api.github.com"

    def authorization_url(self, settings: Settings, *, user_id: int, project_id: int) -> str:
        self._require_enabled(settings)
        now = datetime.now(timezone.utc)
        state = jwt.encode(
            {"sub": str(user_id), "project_id": project_id, "purpose": "github_app", "iat": now, "exp": now + timedelta(minutes=10)},
            settings.auth_secret_key,
            algorithm=settings.auth_token_algorithm,
        )
        return f"https://github.com/apps/{settings.github_app_slug}/installations/new?" + urlencode({"state": state})

    def complete_authorization(self, db: Session, settings: Settings, *, user_id: int, code: str, state: str) -> tuple[int, int]:
        self._require_enabled(settings)
        try:
            payload = jwt.decode(state, settings.auth_secret_key, algorithms=[settings.auth_token_algorithm])
            if payload.get("purpose") != "github_app" or int(payload["sub"]) != user_id:
                raise GitHubAppAuthorizationError("GitHub authorization state did not match the signed-in account.")
            project_id = int(payload["project_id"])
        except (jwt.PyJWTError, KeyError, TypeError, ValueError) as error:
            raise GitHubAppAuthorizationError("GitHub authorization state was invalid or expired.") from error

        with httpx.Client(timeout=10, headers={"Accept": "application/json", "User-Agent": "ProjectOps-GitHub-App"}) as client:
            token_response = client.post("https://github.com/login/oauth/access_token", data={
                "client_id": settings.github_app_client_id,
                "client_secret": settings.github_app_client_secret,
                "code": code,
                "redirect_uri": settings.github_app_callback_url,
            })
            token_response.raise_for_status()
            user_token = token_response.json().get("access_token")
            if not user_token:
                raise GitHubAppAuthorizationError("GitHub did not return a user authorization token.")
            installations_response = client.get(
                f"{self.api_url}/user/installations",
                headers={"Authorization": f"Bearer {user_token}", "X-GitHub-Api-Version": "2022-11-28"},
            )
            installations_response.raise_for_status()
            installations = installations_response.json().get("installations", [])
        rows = github_installation_repository.upsert_many(db, user_id, installations)
        return project_id, len(rows)

    def installation_token(self, settings: Settings, installation_id: int) -> str:
        self._require_enabled(settings)
        now = datetime.now(timezone.utc)
        app_jwt = jwt.encode(
            {"iat": now - timedelta(seconds=30), "exp": now + timedelta(minutes=9), "iss": settings.github_app_id},
            settings.github_app_private_key.replace("\\n", "\n"),
            algorithm="RS256",
        )
        with httpx.Client(timeout=10, headers={"Accept": "application/vnd.github+json", "User-Agent": "ProjectOps-GitHub-App"}) as client:
            response = client.post(
                f"{self.api_url}/app/installations/{installation_id}/access_tokens",
                headers={"Authorization": f"Bearer {app_jwt}", "X-GitHub-Api-Version": "2022-11-28"},
            )
            response.raise_for_status()
            token = response.json().get("token")
        if not token:
            raise GitHubAppAuthorizationError("GitHub did not return an installation token.")
        return token

    def list_repositories(self, db: Session, settings: Settings, user_id: int) -> list[dict]:
        repositories: list[dict] = []
        for installation in github_installation_repository.list_for_user(db, user_id):
            token = self.installation_token(settings, installation.installation_id)
            with httpx.Client(timeout=10, headers={
                "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "ProjectOps-GitHub-App",
            }) as client:
                response = client.get(f"{self.api_url}/installation/repositories", params={"per_page": 100})
                response.raise_for_status()
                for repo in response.json().get("repositories", []):
                    repositories.append({**repo, "installation_id": installation.installation_id})
        return repositories

    def select_repository(self, db: Session, settings: Settings, *, user_id: int, installation_id: int, repository_id: int) -> dict:
        if github_installation_repository.get_for_user(db, user_id, installation_id) is None:
            raise GitHubRepositorySelectionError("GitHub installation was not authorized for this account.")
        repository = next((repo for repo in self.list_repositories(db, settings, user_id) if repo["installation_id"] == installation_id and int(repo["id"]) == repository_id), None)
        if repository is None:
            raise GitHubRepositorySelectionError("Repository was not available through the selected GitHub installation.")
        return repository

    @staticmethod
    def _require_enabled(settings: Settings) -> None:
        if not settings.github_app_enabled():
            raise GitHubAppConfigurationError("GitHub App integration is not configured.")


github_app_service = GitHubAppService()

import httpx

API_URL = "https://api.github.com"
PERMISSION_MISSING_MESSAGE = "Resource not accessible by integration"


class GitHubActionsPermissionMissingError(Exception):
    """The installation token is not authorized for the Actions API (App permission not granted)."""


class GitHubActionsRepositoryNotFoundError(Exception):
    """GitHub returned 404 — the installation may have been revoked from this repository."""


class GitHubActionsFetchError(Exception):
    """Any other network/API failure, including exhausted rate limits."""


class GitHubActionsClient:
    def __init__(self, access_token: str, timeout_seconds: float = 10.0) -> None:
        self.access_token = access_token
        self.timeout_seconds = timeout_seconds

    def fetch_workflow_runs(self, repo_owner: str, repo_name: str, *, branch: str | None = None, per_page: int = 10) -> list[dict]:
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "ProjectOps-CI-Status",
        }
        params: dict[str, str | int] = {"per_page": per_page}
        if branch:
            params["branch"] = branch

        try:
            with httpx.Client(timeout=self.timeout_seconds, headers=headers) as client:
                response = client.get(f"{API_URL}/repos/{repo_owner}/{repo_name}/actions/runs", params=params)
        except httpx.TimeoutException as error:
            raise GitHubActionsFetchError(str(error) or "GitHub Actions request timed out.") from error
        except httpx.HTTPError as error:
            raise GitHubActionsFetchError(str(error) or "GitHub Actions request failed.") from error

        if response.status_code == 404:
            raise GitHubActionsRepositoryNotFoundError(
                f"GitHub repository {repo_owner}/{repo_name} was not found, or this installation no longer has access."
            )
        if response.status_code == 403:
            if response.headers.get("X-RateLimit-Remaining") == "0":
                raise GitHubActionsFetchError("GitHub API rate limit exhausted for this installation.")
            message = ""
            try:
                message = str(response.json().get("message", ""))
            except ValueError:
                pass
            if PERMISSION_MISSING_MESSAGE in message:
                raise GitHubActionsPermissionMissingError(
                    "This GitHub App installation has not been granted access to Actions data."
                )
            raise GitHubActionsFetchError(message or "GitHub Actions request was forbidden.")

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise GitHubActionsFetchError(str(error)) from error

        return response.json().get("workflow_runs", [])

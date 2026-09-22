import httpx
import pytest

from app.services.github_actions_client import (
    GitHubActionsClient,
    GitHubActionsFetchError,
    GitHubActionsPermissionMissingError,
    GitHubActionsRepositoryNotFoundError,
)


class FakeClient:
    def __init__(self, response: httpx.Response) -> None:
        self.response = response
        self.captured_params: dict | None = None

    def __call__(self, *args, **kwargs):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def get(self, url, params=None):
        self.captured_params = params
        self.response.request = httpx.Request("GET", url)
        return self.response


def install_fake_client(monkeypatch, response: httpx.Response) -> FakeClient:
    fake = FakeClient(response)
    monkeypatch.setattr(httpx, "Client", fake)
    return fake


def test_fetch_workflow_runs_parses_successful_response(monkeypatch):
    response = httpx.Response(200, json={"total_count": 1, "workflow_runs": [{"id": 1, "status": "completed"}]})
    fake = install_fake_client(monkeypatch, response)

    runs = GitHubActionsClient(access_token="token").fetch_workflow_runs("acme", "widgets", branch="main")

    assert runs == [{"id": 1, "status": "completed"}]
    assert fake.captured_params == {"per_page": 10, "branch": "main"}


def test_fetch_workflow_runs_raises_permission_missing_on_integration_403(monkeypatch):
    response = httpx.Response(403, json={"message": "Resource not accessible by integration"})
    install_fake_client(monkeypatch, response)

    with pytest.raises(GitHubActionsPermissionMissingError):
        GitHubActionsClient(access_token="token").fetch_workflow_runs("acme", "widgets")


def test_fetch_workflow_runs_raises_generic_error_on_rate_limit_403(monkeypatch):
    response = httpx.Response(
        403,
        json={"message": "API rate limit exceeded"},
        headers={"X-RateLimit-Remaining": "0"},
    )
    install_fake_client(monkeypatch, response)

    with pytest.raises(GitHubActionsFetchError) as excinfo:
        GitHubActionsClient(access_token="token").fetch_workflow_runs("acme", "widgets")
    assert "rate limit" in str(excinfo.value).lower()


def test_fetch_workflow_runs_raises_not_found_on_404(monkeypatch):
    response = httpx.Response(404, json={"message": "Not Found"})
    install_fake_client(monkeypatch, response)

    with pytest.raises(GitHubActionsRepositoryNotFoundError):
        GitHubActionsClient(access_token="token").fetch_workflow_runs("acme", "widgets")


def test_fetch_workflow_runs_raises_fetch_error_on_timeout(monkeypatch):
    class TimeoutClient:
        def __call__(self, *args, **kwargs):
            return self

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, url, params=None):
            raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "Client", TimeoutClient())

    with pytest.raises(GitHubActionsFetchError):
        GitHubActionsClient(access_token="token").fetch_workflow_runs("acme", "widgets")

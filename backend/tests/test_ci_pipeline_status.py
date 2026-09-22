from app.services.ci_pipeline_status import ci_pipeline_status_service
from app.services.github_actions_client import GitHubActionsPermissionMissingError
from app.services.github_app import github_app_service
from app.repositories.repo_integrations import repo_integration_repository
from app.core.database import SessionLocal


def create_project(client, name="LaunchBudget"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": "A budgeting app for product launches.",
            "repo_url": None,
            "production_url": None,
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def attach_github_app_repo(project_id: int, *, installation_id: int = 999) -> None:
    with SessionLocal() as db:
        repo_integration_repository.upsert_github_app_repo(
            db,
            project_id,
            installation_id=installation_id,
            repository={
                "id": 42,
                "full_name": "acme/widgets",
                "html_url": "https://github.com/acme/widgets",
                "default_branch": "main",
                "private": False,
            },
        )


def attach_public_url_repo(client, project_id: int) -> None:
    response = client.post(
        f"/api/v1/projects/{project_id}/repo",
        json={"repo_url": "https://github.com/acme/public-widgets"},
    )
    assert response.status_code == 201


class FakeGitHubActionsClient:
    calls: list[tuple[str, str]] = []

    def __init__(self, access_token: str) -> None:
        self.access_token = access_token

    def fetch_workflow_runs(self, repo_owner, repo_name, *, branch=None, per_page=10):
        FakeGitHubActionsClient.calls.append((repo_owner, repo_name))
        return FakeGitHubActionsClient.runs_to_return


def install_fake_client(monkeypatch, runs: list[dict]):
    FakeGitHubActionsClient.runs_to_return = runs
    FakeGitHubActionsClient.calls = []
    monkeypatch.setattr(ci_pipeline_status_service, "client_factory", FakeGitHubActionsClient)
    monkeypatch.setattr(github_app_service, "installation_token", lambda settings, installation_id: "fake-token")


def workflow_run_payload(run_id=1, status="completed", conclusion="success", run_number=5):
    return {
        "id": run_id,
        "workflow_id": 100,
        "name": "CI",
        "run_number": run_number,
        "status": status,
        "conclusion": conclusion,
        "head_branch": "main",
        "head_sha": "abc123",
        "head_commit": {"message": "Fix the thing\n\nMore detail."},
        "event": "push",
        "html_url": "https://github.com/acme/widgets/actions/runs/1",
        "run_started_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:05:00Z",
    }


def test_sync_without_connected_repo_returns_404(client):
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/ci-status/sync")

    assert response.status_code == 404


def test_sync_with_unconfigured_github_app_returns_502_not_500(client):
    # Regression: installation_token() raises GitHubAppConfigurationError (not one of the
    # GitHubActions* errors) when the app isn't configured at all -- this must not escape as an
    # unhandled 500. Deliberately does NOT monkeypatch installation_token/client_factory, so the
    # real (unconfigured) github_app_service path runs.
    project = create_project(client)
    attach_github_app_repo(project["id"])

    response = client.post(f"/api/v1/projects/{project['id']}/ci-status/sync")

    assert response.status_code == 502


def test_sync_with_public_url_only_repo_returns_422(client):
    project = create_project(client)
    attach_public_url_repo(client, project["id"])

    response = client.post(f"/api/v1/projects/{project['id']}/ci-status/sync")

    assert response.status_code == 422
    assert "GitHub App" in response.json()["detail"]


def test_sync_creates_new_run_and_returns_summary(client, monkeypatch):
    project = create_project(client)
    attach_github_app_repo(project["id"])
    install_fake_client(monkeypatch, [workflow_run_payload()])

    response = client.post(f"/api/v1/projects/{project['id']}/ci-status/sync")

    assert response.status_code == 200
    body = response.json()
    assert body["new_count"] == 1
    assert body["updated_count"] == 0
    assert body["latest_run"]["conclusion"] == "success"
    assert body["latest_run"]["workflow_name"] == "CI"
    assert body["latest_run"]["commit_message"] == "Fix the thing"
    assert FakeGitHubActionsClient.calls == [("acme", "widgets")]


def test_resync_upserts_in_progress_run_without_duplicate(client, monkeypatch):
    project = create_project(client)
    attach_github_app_repo(project["id"])
    install_fake_client(monkeypatch, [workflow_run_payload(status="in_progress", conclusion=None)])

    first = client.post(f"/api/v1/projects/{project['id']}/ci-status/sync")
    assert first.status_code == 200
    assert first.json()["new_count"] == 1

    install_fake_client(monkeypatch, [workflow_run_payload(status="completed", conclusion="failure")])
    second = client.post(f"/api/v1/projects/{project['id']}/ci-status/sync")
    assert second.status_code == 200
    assert second.json()["new_count"] == 0
    assert second.json()["updated_count"] == 1
    assert second.json()["latest_run"]["conclusion"] == "failure"

    runs = client.get(f"/api/v1/projects/{project['id']}/ci-status/runs")
    assert len(runs.json()) == 1

    activity = client.get(f"/api/v1/projects/{project['id']}/activity", params={"category": "ci"})
    assert len(activity.json()) == 1
    assert activity.json()[0]["event_type"] == "ci_run_failed"


def test_permission_missing_returns_409_and_records_monitor_outcome(client, monkeypatch):
    project = create_project(client)
    attach_github_app_repo(project["id"])
    enable = client.put(
        f"/api/v1/projects/{project['id']}/ci-monitor",
        json={"enabled": True, "cadence_minutes": 60},
    )
    assert enable.status_code == 200

    def raise_permission_missing(*args, **kwargs):
        raise GitHubActionsPermissionMissingError("nope")

    class RaisingClient:
        def __init__(self, access_token: str) -> None:
            pass

        def fetch_workflow_runs(self, *args, **kwargs):
            raise_permission_missing()

    monkeypatch.setattr(ci_pipeline_status_service, "client_factory", RaisingClient)
    monkeypatch.setattr(github_app_service, "installation_token", lambda settings, installation_id: "fake-token")

    response = client.post(f"/api/v1/projects/{project['id']}/ci-status/sync")

    assert response.status_code == 409
    assert response.json()["detail"]["needs_reauthorization"] is True

    monitor = client.get(f"/api/v1/projects/{project['id']}/ci-monitor")
    assert monitor.json()["last_outcome"] == "permission_missing"
    assert monitor.json()["consecutive_sync_failures"] == 1


def test_cross_project_ci_status_overview_lists_projects(client, monkeypatch):
    project = create_project(client)
    attach_github_app_repo(project["id"])
    install_fake_client(monkeypatch, [workflow_run_payload()])
    assert client.post(f"/api/v1/projects/{project['id']}/ci-status/sync").status_code == 200

    response = client.get("/api/v1/ci-status")

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["project_id"] == project["id"]
    assert rows[0]["ci_available"] is True
    assert rows[0]["latest_run"]["conclusion"] == "success"

from app.services.github_repo_tree_fetcher import RepoTreeFetchError
from app.services.repo_analyses import repo_analysis_service


class FakeTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        assert repo_owner == "openai"
        assert repo_name == "codex"
        return [
            "README.md",
            "backend/pyproject.toml",
            "backend/app/main.py",
            "backend/tests/test_health.py",
            ".github/workflows/ci.yml",
        ]


class FailingTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        raise RepoTreeFetchError("GitHub repository tree could not be fetched.")


def create_project(client):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "LaunchBudget",
            "description": "A budgeting app for product launches.",
            "repo_url": None,
            "production_url": None,
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def attach_repo(client, project_id):
    response = client.post(
        f"/api/v1/projects/{project_id}/repo",
        json={"repo_url": "https://github.com/openai/codex"},
    )
    assert response.status_code == 201
    return response.json()


def test_run_repo_analysis_without_attached_repo_returns_404(client):
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")

    assert response.status_code == 404
    assert response.json()["detail"] == f"Project {project['id']} does not have an attached repo."


def test_run_repo_analysis_stores_completed_snapshot(client, monkeypatch):
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FakeTreeFetcher())
    project = create_project(client)
    repo = attach_repo(client, project["id"])

    response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")

    assert response.status_code == 201
    analysis = response.json()
    assert analysis["project_id"] == project["id"]
    assert analysis["repo_integration_id"] == repo["id"]
    assert analysis["status"] == "completed"
    assert analysis["error_message"] is None
    assert analysis["total_files_scanned"] == 5
    assert analysis["signals"]["has_readme"] is True
    assert analysis["signals"]["has_backend"] is True
    assert analysis["signals"]["has_ci"] is True
    assert "Python backend" in analysis["summary"]


def test_run_repo_analysis_stores_failed_snapshot_when_tree_fetch_fails(client, monkeypatch):
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FailingTreeFetcher())
    project = create_project(client)
    repo = attach_repo(client, project["id"])

    response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")

    assert response.status_code == 201
    analysis = response.json()
    assert analysis["project_id"] == project["id"]
    assert analysis["repo_integration_id"] == repo["id"]
    assert analysis["status"] == "failed"
    assert analysis["summary"] == "CodeMap Lite analysis failed."
    assert analysis["error_message"] == "GitHub repository tree could not be fetched."
    assert analysis["total_files_scanned"] == 0


def test_get_latest_repo_analysis_returns_newest_snapshot(client, monkeypatch):
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FakeTreeFetcher())
    project = create_project(client)
    attach_repo(client, project["id"])
    first_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    assert first_response.status_code == 201
    second_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    assert second_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/analyses/latest")

    assert response.status_code == 200
    assert response.json()["id"] == second_response.json()["id"]


def test_list_repo_analyses_returns_newest_first(client, monkeypatch):
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FakeTreeFetcher())
    project = create_project(client)
    attach_repo(client, project["id"])
    first_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    assert first_response.status_code == 201
    second_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    assert second_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/analyses")

    assert response.status_code == 200
    analyses = response.json()
    assert [analysis["id"] for analysis in analyses] == [
        second_response.json()["id"],
        first_response.json()["id"],
    ]

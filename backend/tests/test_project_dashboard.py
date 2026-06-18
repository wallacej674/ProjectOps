from app.services.repo_analyses import repo_analysis_service


class FakeTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        return [
            "README.md",
            "backend/pyproject.toml",
            "backend/app/main.py",
            "backend/tests/test_health.py",
        ]


def create_project(client):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "LaunchBudget",
            "description": "A budgeting app for product launches.",
            "repo_url": "https://github.com/example/launch-budget",
            "production_url": "https://launchbudget.example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_project_dashboard_returns_project_metadata_and_placeholders(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["project"]["id"] == project["id"]
    assert dashboard["project"]["name"] == "LaunchBudget"
    assert dashboard["project"]["repo_url"] == "https://github.com/example/launch-budget"
    assert dashboard["project"]["production_url"] == "https://launchbudget.example.com"
    assert dashboard["project"]["status"] == "development"
    assert dashboard["repo"] == {
        "repo_url": None,
        "connected": False,
        "provider": None,
        "repo_owner": None,
        "repo_name": None,
        "default_branch": None,
        "last_verified_at": None,
        "message": "No GitHub repository has been attached yet.",
    }
    assert dashboard["latest_repo_analysis"] is None
    assert dashboard["latest_health_check"] is None
    assert dashboard["readiness"] == {
        "score": None,
        "status": "not_started",
        "message": "Production readiness scoring has not been implemented yet.",
    }
    assert dashboard["next_steps"] == [
        "Attach a GitHub repository to start repo intake.",
        "Run CodeMap Lite analysis in a future milestone.",
        "Add a health endpoint check in a future milestone.",
        "Complete the production readiness checklist in a future milestone.",
    ]


def test_project_dashboard_returns_404_for_missing_project(client):
    response = client.get("/api/v1/projects/999/dashboard")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_project_dashboard_can_be_read_for_archived_project(client):
    project = create_project(client)
    archive_response = client.delete(f"/api/v1/projects/{project['id']}")
    assert archive_response.status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    assert response.json()["project"]["status"] == "archived"


def test_project_dashboard_repo_section_uses_attached_repo(client):
    project = create_project(client)
    attach_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex.git"},
    )
    assert attach_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["repo"] == {
        "repo_url": "https://github.com/openai/codex",
        "connected": True,
        "provider": "github",
        "repo_owner": "openai",
        "repo_name": "codex",
        "default_branch": None,
        "last_verified_at": None,
        "message": "GitHub repository attached. Repository analysis has not been implemented yet.",
    }
    assert dashboard["latest_repo_analysis"] is None
    assert dashboard["next_steps"] == [
        "Run CodeMap Lite analysis in a future milestone.",
        "Add a health endpoint check in a future milestone.",
        "Complete the production readiness checklist in a future milestone.",
    ]


def test_project_dashboard_latest_repo_analysis_uses_latest_attempt(client, monkeypatch):
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FakeTreeFetcher())
    project = create_project(client)
    attach_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex.git"},
    )
    assert attach_response.status_code == 201
    analysis_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    assert analysis_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["latest_repo_analysis"]["id"] == analysis_response.json()["id"]
    assert dashboard["latest_repo_analysis"]["status"] == "completed"
    assert dashboard["latest_repo_analysis"]["signals"]["has_backend"] is True
    assert dashboard["latest_repo_analysis"]["signals"]["has_python"] is True
    assert "Python backend" in dashboard["latest_repo_analysis"]["summary"]

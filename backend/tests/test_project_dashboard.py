import pytest

from app.models.project import Project
from app.services.activity import activity_service
from app.services.repo_analyses import repo_analysis_service
from app.services.health_checks import health_check_service


@pytest.fixture(autouse=True)
def _patch_dns_resolver(monkeypatch):
    """Prevent real DNS lookups in dashboard tests that trigger health checks."""
    from app.services import health_checks as hc_module
    monkeypatch.setattr(hc_module, "_resolve_url_addresses", lambda hostname: ["93.184.216.34"])


class FakeTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        return [
            "README.md",
            "backend/pyproject.toml",
            "backend/app/main.py",
            "backend/tests/test_health.py",
        ]


class FakeHealthResponse:
    status_code = 200
    text = "ok"


class FakeHealthClient:
    def get(self, url: str) -> FakeHealthResponse:
        return FakeHealthResponse()


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


def create_project_without_activity(db, name="LaunchBudget"):
    project = Project(
        name=name,
        description="A budgeting app for product launches.",
        repo_url="https://github.com/example/launch-budget",
        production_url="https://launchbudget.example.com",
        status="development",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def create_artifact(client, project_id, **overrides):
    payload = {
        "title": "Deployment runbook",
        "artifact_type": "runbook",
        "source_type": "external_url",
        "url": "https://docs.example.com/runbook",
        "summary": "Deployment steps.",
        "tags": "deployment,runbook",
    }
    payload.update(overrides)
    response = client.post(f"/api/v1/projects/{project_id}/artifacts", json=payload)
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
    assert dashboard["readiness"]["status"] == "not_started"
    assert dashboard["readiness"]["score"] is None
    assert dashboard["readiness"]["passed"] == 0
    assert dashboard["readiness"]["total_applicable"] == 0
    assert dashboard["readiness"]["top_gaps"] == []
    assert dashboard["artifacts"] == {
        "active_count": 0,
        "archived_count": 0,
        "total_count": 0,
        "latest_artifact": None,
    }
    assert dashboard["activity"]["recent_count"] == 1
    assert dashboard["activity"]["latest_event"]["event_type"] == "project_created"
    assert dashboard["activity"]["latest_event"]["event_category"] == "project"
    assert dashboard["activity"]["latest_event"]["message"] == "Project was created."
    assert dashboard["next_steps"] == [
        "Attach a GitHub repository to start repo intake.",
        "Run a manual health check for the Project.",
        "Complete the production readiness checklist in a future milestone.",
    ]


def test_project_dashboard_includes_artifact_summary_counts_and_latest_active(client):
    project = create_project(client)
    older = create_artifact(client, project["id"], title="Architecture note", artifact_type="note", source_type="manual")
    latest_active = create_artifact(client, project["id"], title="Deployment runbook")
    archived = create_artifact(client, project["id"], title="Archived incident note", artifact_type="incident", source_type="manual")
    archive_response = client.delete(f"/api/v1/projects/{project['id']}/artifacts/{archived['id']}")
    assert archive_response.status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    artifacts = response.json()["artifacts"]
    assert artifacts["active_count"] == 2
    assert artifacts["archived_count"] == 1
    assert artifacts["total_count"] == 3
    assert artifacts["latest_artifact"] == {
        "id": latest_active["id"],
        "title": "Deployment runbook",
        "artifact_type": "runbook",
        "source_type": "external_url",
        "updated_at": latest_active["updated_at"],
    }
    assert artifacts["latest_artifact"]["id"] != older["id"]


def test_project_dashboard_latest_artifact_ignores_archived_artifacts(client):
    project = create_project(client)
    active = create_artifact(client, project["id"], title="Active runbook")
    archived = create_artifact(client, project["id"], title="Archived newer note", artifact_type="note", source_type="manual")
    archive_response = client.delete(f"/api/v1/projects/{project['id']}/artifacts/{archived['id']}")
    assert archive_response.status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    artifacts = response.json()["artifacts"]
    assert artifacts["active_count"] == 1
    assert artifacts["archived_count"] == 1
    assert artifacts["latest_artifact"]["id"] == active["id"]
    assert artifacts["latest_artifact"]["title"] == "Active runbook"


def test_project_dashboard_includes_activity_summary(client, db):
    project = create_project(client)
    first_event = activity_service.record_event(
        db,
        project_id=project["id"],
        event_type="project_created",
        event_category="project",
        message="Project was created.",
        related_resource_type="project",
        related_resource_id=project["id"],
    )
    latest_event = activity_service.record_event(
        db,
        project_id=project["id"],
        event_type="artifact_created",
        event_category="artifact",
        message="Artifact was created.",
        related_resource_type="project_artifact",
        related_resource_id=41,
        metadata={"title": "Deployment runbook"},
    )
    other_project = create_project(client)
    activity_service.record_event(
        db,
        project_id=other_project["id"],
        event_type="project_created",
        event_category="project",
        message="Other Project was created.",
    )

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    activity = response.json()["activity"]
    assert activity["recent_count"] == 3
    assert activity["latest_event"]["id"] == latest_event.id
    assert activity["latest_event"]["id"] != first_event.id
    assert activity["latest_event"]["event_type"] == "artifact_created"
    assert activity["latest_event"]["event_category"] == "artifact"
    assert activity["latest_event"]["message"] == "Artifact was created."
    assert activity["latest_event"]["related_resource_type"] == "project_artifact"
    assert activity["latest_event"]["related_resource_id"] == 41
    assert activity["latest_event"]["created_at"] is not None


def test_project_dashboard_activity_summary_is_unfiltered(client, db):
    project = create_project_without_activity(db)
    activity_service.record_event(
        db,
        project_id=project.id,
        event_type="project_created",
        event_category="project",
        message="Project was created.",
    )
    latest_event = activity_service.record_event(
        db,
        project_id=project.id,
        event_type="artifact_created",
        event_category="artifact",
        message="Artifact was created.",
    )

    filtered_response = client.get(f"/api/v1/projects/{project.id}/activity?category=project")
    dashboard_response = client.get(f"/api/v1/projects/{project.id}/dashboard")

    assert filtered_response.status_code == 200
    assert [event["event_category"] for event in filtered_response.json()] == ["project"]
    assert dashboard_response.status_code == 200
    activity = dashboard_response.json()["activity"]
    assert activity["recent_count"] == 2
    assert activity["latest_event"]["id"] == latest_event.id
    assert activity["latest_event"]["event_category"] == "artifact"


def test_project_dashboard_activity_summary_is_zero_when_no_events(client, db):
    project = create_project_without_activity(db)

    response = client.get(f"/api/v1/projects/{project.id}/dashboard")

    assert response.status_code == 200
    activity = response.json()["activity"]
    assert activity["recent_count"] == 0
    assert activity["latest_event"] is None


def test_dashboard_readiness_reflects_evaluation_result(client):
    project = create_project(client)
    eval_response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")
    assert eval_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    readiness = response.json()["readiness"]
    assert readiness["status"] != "not_started"
    assert isinstance(readiness["passed"], int)
    assert isinstance(readiness["total_applicable"], int)
    assert isinstance(readiness["top_gaps"], list)


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
        "message": "GitHub repository attached.",
    }
    assert dashboard["latest_repo_analysis"] is None
    assert dashboard["next_steps"] == [
        "Run CodeMap Lite analysis for the attached repo.",
        "Run a manual health check for the Project.",
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


def test_project_dashboard_latest_health_check_uses_latest_attempt(client, monkeypatch):
    monkeypatch.setattr(health_check_service, "http_client", FakeHealthClient())
    project = create_project(client)
    health_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert health_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["latest_health_check"]["id"] == health_response.json()["id"]
    assert dashboard["latest_health_check"]["status"] == "healthy"
    assert dashboard["latest_health_check"]["http_status_code"] == 200
    assert dashboard["latest_health_check"]["response_preview"] == "ok"

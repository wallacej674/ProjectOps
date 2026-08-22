from app.core.config import Settings, get_settings
from app.main import app


def _register(client, email: str) -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct horse battery staple", "display_name": email.split("@")[0]},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_demo_data_status_is_enabled_outside_production(client):
    response = client.get("/api/v1/demo-data/status")

    assert response.status_code == 200
    assert response.json() == {"enabled": True, "reason": None}


def test_seed_demo_data_requires_authentication_outside_production(unauthenticated_client):
    response = unauthenticated_client.post("/api/v1/demo-data/seed")

    assert response.status_code == 401


def test_seed_demo_data_creates_demo_workspace(client):
    response = client.post("/api/v1/demo-data/seed")

    assert response.status_code == 201
    body = response.json()
    assert body["created"] is True
    assert body["project"]["name"] == "ProjectOps Demo Command Center"

    project_id = body["project"]["id"]
    projects_response = client.get("/api/v1/projects?include_archived=true")
    project_names = [project["name"] for project in projects_response.json()]
    assert project_names == ["Checkout API Modernization", "ProjectOps Demo Command Center"]

    repo_response = client.get(f"/api/v1/projects/{project_id}/repo")
    assert repo_response.status_code == 200
    assert repo_response.json()["repo_url"] == "https://github.com/projectops/demo-command-center"

    analysis_response = client.get(f"/api/v1/projects/{project_id}/analyses/latest")
    assert analysis_response.status_code == 200
    assert analysis_response.json()["status"] == "completed"
    assert analysis_response.json()["signals"]["has_ci"] is True
    assert analysis_response.json()["signals"]["has_env_example"] is False

    health_response = client.get(f"/api/v1/projects/{project_id}/health-checks/latest")
    assert health_response.status_code == 200
    assert health_response.json()["status"] == "healthy"
    assert health_response.json()["http_status_code"] == 200

    artifacts_response = client.get(f"/api/v1/projects/{project_id}/artifacts")
    assert artifacts_response.status_code == 200
    artifact_titles = [artifact["title"] for artifact in artifacts_response.json()]
    assert artifact_titles == ["Production readiness notes", "Release risk review", "Deployment runbook"]

    readiness_response = client.get(f"/api/v1/projects/{project_id}/readiness")
    assert readiness_response.status_code == 200
    readiness = readiness_response.json()
    assert readiness["status"] == "in_progress"
    assert readiness["score"] == 77
    assert "Environment Example Present" in readiness["top_gaps"]

    evidence_response = client.get(
        f"/api/v1/projects/{project_id}/readiness/items/deployment_docs_reviewed/artifacts"
    )
    assert evidence_response.status_code == 200
    assert evidence_response.json()[0]["artifact"]["title"] == "Deployment runbook"

    activity_response = client.get(f"/api/v1/projects/{project_id}/activity")
    assert activity_response.status_code == 200
    event_types = [event["event_type"] for event in activity_response.json()]
    assert "project_created" in event_types
    assert "repository_attached" in event_types
    assert "codemap_analysis_completed" in event_types
    assert "health_check_healthy" in event_types
    assert "readiness_artifact_linked" in event_types


def test_seed_demo_data_is_idempotent(client):
    first_response = client.post("/api/v1/demo-data/seed")
    second_response = client.post("/api/v1/demo-data/seed")

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert first_response.json()["created"] is True
    assert second_response.json()["created"] is False
    assert second_response.json()["project"]["id"] == first_response.json()["project"]["id"]

    projects_response = client.get("/api/v1/projects?include_archived=true")
    assert len(projects_response.json()) == 2


def test_seed_demo_data_is_idempotent_per_user(unauthenticated_client):
    first_token = _register(unauthenticated_client, "first@example.com")
    second_token = _register(unauthenticated_client, "second@example.com")

    first_response = unauthenticated_client.post("/api/v1/demo-data/seed", headers=_headers(first_token))
    first_repeat_response = unauthenticated_client.post("/api/v1/demo-data/seed", headers=_headers(first_token))
    second_response = unauthenticated_client.post("/api/v1/demo-data/seed", headers=_headers(second_token))

    assert first_response.status_code == 201
    assert first_repeat_response.status_code == 201
    assert second_response.status_code == 201
    assert first_repeat_response.json()["created"] is False
    assert second_response.json()["created"] is True
    assert second_response.json()["project"]["id"] != first_response.json()["project"]["id"]

    second_projects = unauthenticated_client.get("/api/v1/projects?include_archived=true", headers=_headers(second_token))
    assert [project["name"] for project in second_projects.json()] == [
        "Checkout API Modernization",
        "ProjectOps Demo Command Center",
    ]


def test_demo_data_is_disabled_in_production(unauthenticated_client):
    app.dependency_overrides[get_settings] = lambda: Settings(
        environment="production",
        cors_allowed_origins="https://projectops.example",
        auth_secret_key="production-secret-for-test",
    )
    try:
        status_response = unauthenticated_client.get("/api/v1/demo-data/status")
        seed_response = unauthenticated_client.post("/api/v1/demo-data/seed")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert status_response.status_code == 200
    assert status_response.json() == {
        "enabled": False,
        "reason": "Demo data seeding is disabled in production environments.",
    }
    assert seed_response.status_code == 403
    assert seed_response.json()["detail"] == "Demo data seeding is disabled in production environments."

import httpx

from app.models.project import Project
from app.models.user import User
from app.services.github_repo_tree_fetcher import RepoTreeFetchError
from app.services.health_checks import health_check_service
from app.services.repo_analyses import repo_analysis_service
from app.services.activity import activity_service


class FakeTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        return ["README.md", "backend/app/main.py", ".github/workflows/ci.yml"]


class FailingTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        raise RepoTreeFetchError("GitHub repository tree could not be fetched.")


class FakeHealthResponse:
    def __init__(self, status_code: int, text: str = "ok") -> None:
        self.status_code = status_code
        self.text = text


class FakeHealthClient:
    def __init__(self, response: FakeHealthResponse | None = None, error: Exception | None = None) -> None:
        self.response = response or FakeHealthResponse(200)
        self.error = error

    def get(self, url: str) -> FakeHealthResponse:
        if self.error:
            raise self.error
        return self.response


def create_project(client, name="ProjectOps"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": "A software project command center.",
            "repo_url": "https://github.com/example/projectops",
            "production_url": "https://projectops.example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_project_without_activity(db, name="ProjectOps"):
    owner = db.query(User).filter(User.email == "test-user@example.com").one()
    project = Project(
        owner_user_id=owner.id,
        name=name,
        description="A software project command center.",
        repo_url="https://github.com/example/projectops",
        production_url="https://projectops.example.com",
        status="development",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def test_list_project_activity_returns_empty_list_for_project_with_no_events(client, db):
    project = create_project_without_activity(db)

    response = client.get(f"/api/v1/projects/{project.id}/activity")

    assert response.status_code == 200
    assert response.json() == []


def test_list_activity_across_projects_returns_newest_events_with_project_names(client, db):
    first_project = create_project_without_activity(db, name="CivicPermit API")
    second_project = create_project_without_activity(db, name="LaunchBudget")
    first_event = activity_service.record_event(
        db,
        project_id=first_project.id,
        event_type="project_created",
        event_category="project",
        message="CivicPermit API was created.",
    )
    second_event = activity_service.record_event(
        db,
        project_id=second_project.id,
        event_type="artifact_created",
        event_category="artifact",
        message="Deployment runbook was created.",
    )

    response = client.get("/api/v1/activity")

    assert response.status_code == 200
    events = response.json()
    assert [event["id"] for event in events] == [second_event.id, first_event.id]
    assert events[0]["project_id"] == second_project.id
    assert events[0]["project_name"] == "LaunchBudget"
    assert events[0]["event_type"] == "artifact_created"
    assert events[1]["project_id"] == first_project.id
    assert events[1]["project_name"] == "CivicPermit API"


def test_list_activity_across_projects_returns_empty_list_when_no_events(client):
    response = client.get("/api/v1/activity")

    assert response.status_code == 200
    assert response.json() == []


def test_list_activity_across_projects_filters_by_category_event_type_and_project_id(client, db):
    first_project = create_project_without_activity(db, name="CivicPermit API")
    second_project = create_project_without_activity(db, name="LaunchBudget")
    activity_service.record_event(
        db,
        project_id=first_project.id,
        event_type="project_created",
        event_category="project",
        message="CivicPermit API was created.",
    )
    artifact_event = activity_service.record_event(
        db,
        project_id=first_project.id,
        event_type="artifact_created",
        event_category="artifact",
        message="Deployment runbook was created.",
    )
    activity_service.record_event(
        db,
        project_id=second_project.id,
        event_type="artifact_archived",
        event_category="artifact",
        message="LaunchBudget artifact was archived.",
    )

    category_response = client.get("/api/v1/activity?category=artifact")
    event_type_response = client.get("/api/v1/activity?event_type=artifact_created")
    project_response = client.get(f"/api/v1/activity?project_id={first_project.id}")

    assert category_response.status_code == 200
    assert [event["event_type"] for event in category_response.json()] == ["artifact_archived", "artifact_created"]
    assert event_type_response.status_code == 200
    assert [event["id"] for event in event_type_response.json()] == [artifact_event.id]
    assert project_response.status_code == 200
    assert {event["project_id"] for event in project_response.json()} == {first_project.id}


def test_list_activity_across_projects_supports_limit_offset_and_max_limit(client, db):
    project = create_project_without_activity(db)
    for index in range(3):
        activity_service.record_event(
            db,
            project_id=project.id,
            event_type="artifact_created",
            event_category="artifact",
            message=f"Artifact {index} was created.",
        )

    response = client.get("/api/v1/activity?limit=1&offset=1")
    invalid_response = client.get("/api/v1/activity?limit=101")

    assert response.status_code == 200
    assert [event["message"] for event in response.json()] == ["Artifact 1 was created."]
    assert invalid_response.status_code == 422


def test_list_activity_across_projects_missing_project_filter_returns_404(client):
    response = client.get("/api/v1/activity?project_id=999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_list_project_activity_returns_events_newest_first(client, db):
    project = create_project_without_activity(db)

    first_event = activity_service.record_event(
        db,
        project_id=project.id,
        event_type="project_created",
        event_category="project",
        message="Project was created.",
        related_resource_type="project",
        related_resource_id=project.id,
        metadata={"name": project.name},
    )
    second_event = activity_service.record_event(
        db,
        project_id=project.id,
        event_type="artifact_created",
        event_category="artifact",
        message="Artifact was created.",
        related_resource_type="project_artifact",
        related_resource_id=42,
        metadata={"title": "Deployment runbook"},
    )

    response = client.get(f"/api/v1/projects/{project.id}/activity")

    assert response.status_code == 200
    events = response.json()
    assert [event["id"] for event in events] == [second_event.id, first_event.id]
    assert events[0]["event_type"] == "artifact_created"
    assert events[0]["event_category"] == "artifact"
    assert events[0]["message"] == "Artifact was created."
    assert events[0]["related_resource_type"] == "project_artifact"
    assert events[0]["related_resource_id"] == 42
    assert events[0]["metadata"] == {"title": "Deployment runbook"}
    assert events[0]["created_at"] is not None


def test_list_project_activity_filters_by_category_and_event_type(client, db):
    project = create_project_without_activity(db)
    activity_service.record_event(
        db,
        project_id=project.id,
        event_type="project_created",
        event_category="project",
        message="Project was created.",
    )
    activity_service.record_event(
        db,
        project_id=project.id,
        event_type="artifact_created",
        event_category="artifact",
        message="Artifact was created.",
    )
    activity_service.record_event(
        db,
        project_id=project.id,
        event_type="artifact_archived",
        event_category="artifact",
        message="Artifact was archived.",
    )

    category_response = client.get(f"/api/v1/projects/{project.id}/activity?category=artifact")
    event_type_response = client.get(f"/api/v1/projects/{project.id}/activity?event_type=artifact_created")

    assert category_response.status_code == 200
    assert [event["event_type"] for event in category_response.json()] == ["artifact_archived", "artifact_created"]
    assert event_type_response.status_code == 200
    assert [event["event_type"] for event in event_type_response.json()] == ["artifact_created"]


def test_list_project_activity_supports_limit_offset_and_max_limit(client, db):
    project = create_project_without_activity(db)
    for index in range(3):
        activity_service.record_event(
            db,
            project_id=project.id,
            event_type="artifact_created",
            event_category="artifact",
            message=f"Artifact {index} was created.",
        )

    response = client.get(f"/api/v1/projects/{project.id}/activity?limit=1&offset=1")
    invalid_response = client.get(f"/api/v1/projects/{project.id}/activity?limit=101")

    assert response.status_code == 200
    assert [event["message"] for event in response.json()] == ["Artifact 1 was created."]
    assert invalid_response.status_code == 422


def test_list_project_activity_missing_project_returns_404(client):
    response = client.get("/api/v1/projects/999/activity")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_project_lifecycle_records_activity_events(client):
    project = create_project(client)
    update_response = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "ProjectOps Backend", "status": "staging"},
    )
    assert update_response.status_code == 200
    archive_response = client.delete(f"/api/v1/projects/{project['id']}")
    assert archive_response.status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/activity?category=project")

    assert response.status_code == 200
    events = response.json()
    assert [event["event_type"] for event in events] == [
        "project_archived",
        "project_updated",
        "project_created",
    ]
    assert events[0]["message"] == "Project was archived."
    assert events[0]["related_resource_type"] == "project"
    assert events[0]["related_resource_id"] == project["id"]
    assert events[1]["metadata"]["name"] == "ProjectOps Backend"
    assert events[2]["metadata"]["name"] == "ProjectOps"


def test_artifact_lifecycle_records_activity_events(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/runbook",
        },
    )
    assert create_response.status_code == 201
    artifact = create_response.json()
    update_response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={"title": "Updated deployment runbook"},
    )
    assert update_response.status_code == 200
    archive_response = client.delete(f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}")
    assert archive_response.status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/activity?category=artifact")

    assert response.status_code == 200
    events = response.json()
    assert [event["event_type"] for event in events] == [
        "artifact_archived",
        "artifact_updated",
        "artifact_created",
    ]
    assert events[0]["related_resource_type"] == "project_artifact"
    assert events[0]["related_resource_id"] == artifact["id"]
    assert events[0]["metadata"]["title"] == "Updated deployment runbook"
    assert events[2]["metadata"]["artifact_type"] == "runbook"


def test_repository_lifecycle_records_activity_events(client):
    project = create_project(client)
    attach_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex"},
    )
    assert attach_response.status_code == 201
    replace_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/example/projectops"},
    )
    assert replace_response.status_code == 201
    remove_response = client.delete(f"/api/v1/projects/{project['id']}/repo")
    assert remove_response.status_code == 204

    response = client.get(f"/api/v1/projects/{project['id']}/activity?category=repository")

    assert response.status_code == 200
    events = response.json()
    assert [event["event_type"] for event in events] == [
        "repository_removed",
        "repository_replaced",
        "repository_attached",
    ]
    assert events[0]["message"] == "Repository connection was removed."
    assert events[0]["metadata"]["repo"] == "example/projectops"
    assert events[1]["metadata"]["repo"] == "example/projectops"
    assert events[2]["metadata"]["repo"] == "openai/codex"


def test_codemap_analysis_records_completed_and_failed_activity_events(client, monkeypatch):
    project = create_project(client)
    attach_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex"},
    )
    assert attach_response.status_code == 201
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FakeTreeFetcher())
    completed_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    assert completed_response.status_code == 201
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FailingTreeFetcher())
    failed_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    assert failed_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/activity?category=codemap")

    assert response.status_code == 200
    events = response.json()
    assert [event["event_type"] for event in events] == [
        "codemap_analysis_failed",
        "codemap_analysis_completed",
    ]
    assert events[0]["related_resource_type"] == "repo_analysis"
    assert events[0]["related_resource_id"] == failed_response.json()["id"]
    assert events[0]["metadata"]["status"] == "failed"
    assert events[1]["related_resource_id"] == completed_response.json()["id"]
    assert events[1]["metadata"]["total_files_scanned"] == 3


def test_health_check_records_status_specific_activity_events(client, monkeypatch):
    from app.services import health_checks as health_module

    monkeypatch.setattr(health_module, "_resolve_url_addresses", lambda hostname: ["93.184.216.34"])
    project = create_project(client)

    monkeypatch.setattr(health_check_service, "http_client", FakeHealthClient(FakeHealthResponse(200)))
    healthy_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert healthy_response.status_code == 201
    monkeypatch.setattr(health_check_service, "http_client", FakeHealthClient(FakeHealthResponse(500, "oops")))
    unhealthy_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert unhealthy_response.status_code == 201
    monkeypatch.setattr(
        health_check_service,
        "http_client",
        FakeHealthClient(error=httpx.TimeoutException("Request timed out.")),
    )
    timeout_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert timeout_response.status_code == 201
    monkeypatch.setattr(
        health_check_service,
        "http_client",
        FakeHealthClient(error=httpx.ConnectError("Connection failed.")),
    )
    error_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert error_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/activity?category=health")

    assert response.status_code == 200
    events = response.json()
    assert [event["event_type"] for event in events] == [
        "health_check_error",
        "health_check_timeout",
        "health_check_unhealthy",
        "health_check_healthy",
    ]
    assert events[0]["related_resource_id"] == error_response.json()["id"]
    assert events[1]["related_resource_id"] == timeout_response.json()["id"]
    assert events[2]["related_resource_id"] == unhealthy_response.json()["id"]
    assert events[3]["related_resource_id"] == healthy_response.json()["id"]
    assert events[3]["metadata"]["http_status_code"] == 200


def test_readiness_and_evidence_workflows_record_activity_events(client):
    project = create_project(client)
    artifact_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/runbook",
        },
    )
    assert artifact_response.status_code == 201
    artifact = artifact_response.json()

    evaluate_response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")
    assert evaluate_response.status_code == 201
    manual_response = client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed",
        json={"status": "passed", "notes": "Reviewed deployment runbook."},
    )
    assert manual_response.status_code == 200
    link_response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )
    assert link_response.status_code == 201
    unlink_response = client.delete(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts/{artifact['id']}"
    )
    assert unlink_response.status_code == 204

    readiness_response = client.get(f"/api/v1/projects/{project['id']}/activity?category=readiness")
    evidence_response = client.get(f"/api/v1/projects/{project['id']}/activity?category=evidence")

    assert readiness_response.status_code == 200
    readiness_events = readiness_response.json()
    assert [event["event_type"] for event in readiness_events] == [
        "readiness_manual_item_updated",
        "readiness_evaluated",
    ]
    assert readiness_events[0]["related_resource_type"] == "readiness_item"
    assert readiness_events[0]["metadata"]["item_key"] == "deployment_docs_reviewed"
    assert readiness_events[0]["metadata"]["status"] == "passed"
    assert readiness_events[1]["metadata"]["status"] == evaluate_response.json()["status"]
    assert evidence_response.status_code == 200
    evidence_events = evidence_response.json()
    assert [event["event_type"] for event in evidence_events] == [
        "readiness_artifact_unlinked",
        "readiness_artifact_linked",
    ]
    assert evidence_events[0]["related_resource_type"] == "project_artifact"
    assert evidence_events[0]["related_resource_id"] == artifact["id"]
    assert evidence_events[0]["metadata"]["item_key"] == "deployment_docs_reviewed"
    assert evidence_events[1]["metadata"]["artifact_title"] == "Deployment runbook"

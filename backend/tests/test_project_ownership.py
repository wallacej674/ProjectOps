def _register(client, email: str) -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct horse battery staple", "display_name": email.split("@")[0]},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client, token: str, name: str) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=_headers(token),
        json={
            "name": name,
            "description": "Owned project",
            "repo_url": "https://github.com/example/projectops",
            "production_url": "https://projectops.example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_artifact(client, token: str, project_id: int) -> dict:
    response = client.post(
        f"/api/v1/projects/{project_id}/artifacts",
        headers=_headers(token),
        json={
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/runbook",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_project_routes_reject_unauthenticated_requests(unauthenticated_client):
    response = unauthenticated_client.get("/api/v1/projects")

    assert response.status_code == 401


def test_created_project_is_assigned_to_current_user(unauthenticated_client, db):
    token = _register(unauthenticated_client, "owner@example.com")

    project = _create_project(unauthenticated_client, token, "Owned Project")

    stored_project = db.get(__import__("app.models.project", fromlist=["Project"]).Project, project["id"])
    assert stored_project.owner_user_id is not None


def test_users_only_list_their_own_projects(unauthenticated_client):
    first_token = _register(unauthenticated_client, "first@example.com")
    second_token = _register(unauthenticated_client, "second@example.com")
    _create_project(unauthenticated_client, first_token, "First User Project")
    _create_project(unauthenticated_client, second_token, "Second User Project")

    first_response = unauthenticated_client.get("/api/v1/projects", headers=_headers(first_token))
    second_response = unauthenticated_client.get("/api/v1/projects", headers=_headers(second_token))

    assert [project["name"] for project in first_response.json()] == ["First User Project"]
    assert [project["name"] for project in second_response.json()] == ["Second User Project"]


def test_user_cannot_fetch_update_or_archive_another_users_project(unauthenticated_client):
    owner_token = _register(unauthenticated_client, "owner@example.com")
    other_token = _register(unauthenticated_client, "other@example.com")
    project = _create_project(unauthenticated_client, owner_token, "Private Project")

    get_response = unauthenticated_client.get(f"/api/v1/projects/{project['id']}", headers=_headers(other_token))
    update_response = unauthenticated_client.patch(
        f"/api/v1/projects/{project['id']}",
        headers=_headers(other_token),
        json={"name": "Taken Project"},
    )
    archive_response = unauthenticated_client.delete(f"/api/v1/projects/{project['id']}", headers=_headers(other_token))

    assert get_response.status_code == 404
    assert update_response.status_code == 404
    assert archive_response.status_code == 404


def test_child_project_routes_are_protected_by_project_ownership(unauthenticated_client):
    owner_token = _register(unauthenticated_client, "owner@example.com")
    other_token = _register(unauthenticated_client, "other@example.com")
    project = _create_project(unauthenticated_client, owner_token, "Private Project")
    project_id = project["id"]

    blocked_requests = [
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/dashboard", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/repo", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/analyses", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/health-checks", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/readiness", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/artifacts", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/activity", headers=_headers(other_token)),
        unauthenticated_client.get(
            f"/api/v1/projects/{project_id}/readiness/items/deployment_docs_reviewed/artifacts",
            headers=_headers(other_token),
        ),
    ]

    assert [response.status_code for response in blocked_requests] == [404] * len(blocked_requests)


def test_child_project_mutation_routes_are_protected_by_project_ownership(unauthenticated_client):
    owner_token = _register(unauthenticated_client, "owner@example.com")
    other_token = _register(unauthenticated_client, "other@example.com")
    project = _create_project(unauthenticated_client, owner_token, "Private Project")
    project_id = project["id"]
    artifact = _create_artifact(unauthenticated_client, owner_token, project_id)

    attach_repo_response = unauthenticated_client.post(
        f"/api/v1/projects/{project_id}/repo",
        headers=_headers(owner_token),
        json={"repo_url": "https://github.com/openai/codex"},
    )
    assert attach_repo_response.status_code == 201

    blocked_requests = [
        unauthenticated_client.post(
            f"/api/v1/projects/{project_id}/repo",
            headers=_headers(other_token),
            json={"repo_url": "https://github.com/example/taken"},
        ),
        unauthenticated_client.delete(f"/api/v1/projects/{project_id}/repo", headers=_headers(other_token)),
        unauthenticated_client.post(f"/api/v1/projects/{project_id}/analyses/run", headers=_headers(other_token)),
        unauthenticated_client.post(
            f"/api/v1/projects/{project_id}/health-checks/run",
            headers=_headers(other_token),
            json={"url": "https://example.com/health"},
        ),
        unauthenticated_client.post(f"/api/v1/projects/{project_id}/readiness/evaluate", headers=_headers(other_token)),
        unauthenticated_client.patch(
            f"/api/v1/projects/{project_id}/readiness/items/deployment_docs_reviewed",
            headers=_headers(other_token),
            json={"status": "passed", "notes": "Unauthorized update."},
        ),
        unauthenticated_client.post(
            f"/api/v1/projects/{project_id}/readiness/items/deployment_docs_reviewed/artifacts",
            headers=_headers(other_token),
            json={"artifact_id": artifact["id"]},
        ),
        unauthenticated_client.delete(
            f"/api/v1/projects/{project_id}/readiness/items/deployment_docs_reviewed/artifacts/{artifact['id']}",
            headers=_headers(other_token),
        ),
        unauthenticated_client.post(
            f"/api/v1/projects/{project_id}/artifacts",
            headers=_headers(other_token),
            json={
                "title": "Unauthorized artifact",
                "artifact_type": "note",
                "source_type": "manual",
            },
        ),
        unauthenticated_client.patch(
            f"/api/v1/projects/{project_id}/artifacts/{artifact['id']}",
            headers=_headers(other_token),
            json={"title": "Taken artifact"},
        ),
        unauthenticated_client.delete(
            f"/api/v1/projects/{project_id}/artifacts/{artifact['id']}",
            headers=_headers(other_token),
        ),
    ]

    assert [response.status_code for response in blocked_requests] == [404] * len(blocked_requests)

    repo_response = unauthenticated_client.get(f"/api/v1/projects/{project_id}/repo", headers=_headers(owner_token))
    artifact_response = unauthenticated_client.get(
        f"/api/v1/projects/{project_id}/artifacts/{artifact['id']}",
        headers=_headers(owner_token),
    )

    assert repo_response.status_code == 200
    assert repo_response.json()["repo_url"] == "https://github.com/openai/codex"
    assert artifact_response.status_code == 200
    assert artifact_response.json()["title"] == "Deployment runbook"


def test_child_project_detail_routes_are_protected_even_when_owned_records_exist(unauthenticated_client):
    owner_token = _register(unauthenticated_client, "owner@example.com")
    other_token = _register(unauthenticated_client, "other@example.com")
    project = _create_project(unauthenticated_client, owner_token, "Private Project")
    project_id = project["id"]
    artifact = _create_artifact(unauthenticated_client, owner_token, project_id)

    blocked_requests = [
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/dashboard", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/repo", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/analyses/latest", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/analyses", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/health-checks/latest", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/health-checks", headers=_headers(other_token)),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/readiness", headers=_headers(other_token)),
        unauthenticated_client.get(
            f"/api/v1/projects/{project_id}/readiness/items/deployment_docs_reviewed/artifacts",
            headers=_headers(other_token),
        ),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/artifacts", headers=_headers(other_token)),
        unauthenticated_client.get(
            f"/api/v1/projects/{project_id}/artifacts/{artifact['id']}",
            headers=_headers(other_token),
        ),
        unauthenticated_client.get(f"/api/v1/projects/{project_id}/activity", headers=_headers(other_token)),
    ]

    assert [response.status_code for response in blocked_requests] == [404] * len(blocked_requests)


def test_cross_project_activity_only_returns_current_users_events(unauthenticated_client):
    first_token = _register(unauthenticated_client, "first@example.com")
    second_token = _register(unauthenticated_client, "second@example.com")
    _create_project(unauthenticated_client, first_token, "First User Project")
    _create_project(unauthenticated_client, second_token, "Second User Project")

    response = unauthenticated_client.get("/api/v1/activity", headers=_headers(second_token))

    assert response.status_code == 200
    assert {event["project_name"] for event in response.json()} == {"Second User Project"}


def test_cross_project_activity_project_filter_rejects_another_users_project(unauthenticated_client):
    owner_token = _register(unauthenticated_client, "owner@example.com")
    other_token = _register(unauthenticated_client, "other@example.com")
    project = _create_project(unauthenticated_client, owner_token, "Private Project")

    response = unauthenticated_client.get(
        f"/api/v1/activity?project_id={project['id']}",
        headers=_headers(other_token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Project {project['id']} was not found."

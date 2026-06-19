from app.services.readiness import readiness_service


def create_project(client, production_url="https://example.com"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "TestApp",
            "description": None,
            "repo_url": None,
            "production_url": production_url,
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_evaluate_returns_201_with_score_and_items(client):
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")

    assert response.status_code == 201
    data = response.json()
    assert "score" in data
    assert "status" in data
    assert "passed" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) == 9


def test_evaluate_project_not_found_returns_404(client):
    response = client.post("/api/v1/projects/999/readiness/evaluate")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_get_readiness_before_evaluate_returns_not_started(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/readiness")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_started"
    assert data["score"] is None
    assert data["items"] == []


def test_get_readiness_after_evaluate_returns_assessment(client):
    project = create_project(client)
    client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")

    response = client.get(f"/api/v1/projects/{project['id']}/readiness")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 9
    assert data["status"] != "not_started"


def test_patch_manual_item_updates_status(client):
    project = create_project(client)
    client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")

    response = client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/secrets_management_reviewed",
        json={"status": "passed", "notes": "Reviewed by eng on 2026-06-19."},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "passed"
    assert data["notes"] == "Reviewed by eng on 2026-06-19."


def test_patch_automatic_item_returns_400(client):
    project = create_project(client)

    response = client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/readme_present",
        json={"status": "passed"},
    )

    assert response.status_code == 400


def test_patch_unknown_item_key_returns_404(client):
    project = create_project(client)

    response = client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/does_not_exist",
        json={"status": "passed"},
    )

    assert response.status_code == 404


def test_patch_project_not_found_returns_404(client):
    response = client.patch(
        "/api/v1/projects/999/readiness/items/secrets_management_reviewed",
        json={"status": "passed"},
    )

    assert response.status_code == 404

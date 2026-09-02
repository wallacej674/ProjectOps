from app.services.readiness import readiness_service


def create_project(client, production_url="https://example.com", name="TestApp"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
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


def test_evaluate_items_include_catalog_metadata_for_frontend_checklist(client):
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")

    assert response.status_code == 201
    first_item = response.json()["items"][0]
    assert first_item["item"]["key"] == "readme_present"
    assert first_item["item"]["label"] == "README Present"
    assert first_item["item"]["description"] == "The repository has a README.md at its root."
    assert first_item["item"]["category"] == "documentation"
    assert first_item["item"]["evaluation_type"] == "automatic"


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


def test_readiness_and_dashboard_top_gaps_match(client):
    project = create_project(client, production_url=None)
    client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")

    readiness_response = client.get(f"/api/v1/projects/{project['id']}/readiness")
    dashboard_response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    readiness_gaps = readiness_response.json()["top_gaps"]
    dashboard_gaps = dashboard_response.json()["readiness"]["top_gaps"]
    assert readiness_gaps == dashboard_gaps


def test_patch_invalid_status_returns_422(client):
    project = create_project(client)
    client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")

    response = client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/secrets_management_reviewed",
        json={"status": "approved"},
    )

    assert response.status_code == 422


def test_patch_invalid_status_does_not_modify_db(client):
    project = create_project(client)
    client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")
    good_response = client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/secrets_management_reviewed",
        json={"status": "passed", "notes": "Legitimate update."},
    )
    assert good_response.status_code == 200
    item_id = good_response.json()["id"]

    client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/secrets_management_reviewed",
        json={"status": "approved"},
    )

    response = client.get(f"/api/v1/projects/{project['id']}/readiness")
    stored = next(i for i in response.json()["items"] if i["id"] == item_id)
    assert stored["status"] == "passed"
    assert stored["notes"] == "Legitimate update."


def test_cross_project_readiness_returns_score_per_project(client):
    evaluated_project = create_project(client, name="Evaluated App")
    client.post(f"/api/v1/projects/{evaluated_project['id']}/readiness/evaluate")
    unevaluated_project = create_project(client, name="Unevaluated App")

    response = client.get("/api/v1/readiness")

    assert response.status_code == 200
    by_project_id = {item["project_id"]: item for item in response.json()}
    evaluated = by_project_id[evaluated_project["id"]]
    assert evaluated["project_name"] == "Evaluated App"
    assert evaluated["status"] != "not_started"
    assert evaluated["score"] is not None
    assert evaluated["total_applicable"] == 9

    unevaluated = by_project_id[unevaluated_project["id"]]
    assert unevaluated["status"] == "not_started"
    assert unevaluated["score"] is None


def test_cross_project_readiness_returns_empty_list_with_no_projects(client):
    response = client.get("/api/v1/readiness")

    assert response.status_code == 200
    assert response.json() == []

from datetime import datetime, timedelta, timezone

from app.jobs.run_due_health_checks import run_due_health_checks
from tests.test_health_checks import FakeHttpClient, FakeResponse, create_project


def test_project_owner_can_read_default_disabled_status_page(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/status-page")

    assert response.status_code == 200
    assert response.json() == {
        "project_id": project["id"], "enabled": False, "slug": None, "label": None,
        "created_at": None, "updated_at": None,
    }


def test_project_owner_can_enable_status_page_and_receives_a_slug(client):
    project = create_project(client)

    response = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None})

    assert response.status_code == 200
    page = response.json()
    assert page["enabled"] is True
    assert page["label"] is None
    assert isinstance(page["slug"], str) and len(page["slug"]) >= 16


def test_status_page_cannot_be_enabled_without_production_url(client):
    project = create_project(client, production_url=None)

    response = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None})

    assert response.status_code == 422
    assert response.json()["detail"] == "Add a Project production URL before enabling a public status page."


def test_project_owner_can_set_a_custom_public_label(client):
    project = create_project(client)

    response = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": "  LaunchBudget Status  "})

    assert response.status_code == 200
    assert response.json()["label"] == "LaunchBudget Status"


def test_pausing_status_page_keeps_the_same_slug(client):
    project = create_project(client)
    enabled = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()

    paused = client.delete(f"/api/v1/projects/{project['id']}/status-page")

    assert paused.status_code == 200
    body = paused.json()
    assert body["enabled"] is False
    assert body["slug"] == enabled["slug"]


def test_rotating_slug_requires_a_previously_enabled_page(client):
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/status-page/rotate-slug")

    assert response.status_code == 422
    assert response.json()["detail"] == "Enable a public status page before rotating its link."


def test_rotating_slug_invalidates_the_old_public_link(client, unauthenticated_client):
    project = create_project(client)
    original = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()
    assert unauthenticated_client.get(f"/api/v1/public/status-pages/{original['slug']}").status_code == 200

    rotated = client.post(f"/api/v1/projects/{project['id']}/status-page/rotate-slug")

    assert rotated.status_code == 200
    new_slug = rotated.json()["slug"]
    assert new_slug != original["slug"]
    assert unauthenticated_client.get(f"/api/v1/public/status-pages/{original['slug']}").status_code == 404
    assert unauthenticated_client.get(f"/api/v1/public/status-pages/{new_slug}").status_code == 200


def test_public_status_page_404s_for_unknown_or_disabled_slugs(client, unauthenticated_client):
    project = create_project(client)
    page = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()

    assert unauthenticated_client.get("/api/v1/public/status-pages/does-not-exist").status_code == 404

    client.delete(f"/api/v1/projects/{project['id']}/status-page")
    disabled = unauthenticated_client.get(f"/api/v1/public/status-pages/{page['slug']}")
    assert disabled.status_code == 404


def test_public_status_page_shows_current_status_history_and_no_incident_without_auth(client, unauthenticated_client, monkeypatch):
    project = create_project(client)
    page = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": "Public Name"}).json()
    monkeypatch.setattr("app.services.health_checks.health_check_service.http_client", FakeHttpClient(FakeResponse(200, "ok")))
    assert client.post(f"/api/v1/projects/{project['id']}/health-checks/run").status_code == 201

    response = unauthenticated_client.get(f"/api/v1/public/status-pages/{page['slug']}")

    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "Public Name"
    assert body["target_url"] == "https://launchbudget.example.com"
    assert body["current_status"] == "healthy"
    assert body["active_incident"] is None
    assert len(body["history"]) == 1
    assert body["history"][0]["status"] == "healthy"
    assert "id" not in body["history"][0]
    assert "target_url" not in body["history"][0]


def test_public_status_page_surfaces_an_active_incident_and_bounds_history(client, unauthenticated_client, db):
    project = create_project(client)
    page = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()
    assert client.put(f"/api/v1/projects/{project['id']}/health-monitor", json={"enabled": True, "cadence_minutes": 15}).status_code == 200
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    for index in range(2):
        run_due_health_checks(db, now=start + timedelta(minutes=20 * index), http_client=FakeHttpClient(FakeResponse(500, "bad")))

    response = unauthenticated_client.get(f"/api/v1/public/status-pages/{page['slug']}")

    assert response.status_code == 200
    body = response.json()
    assert body["current_status"] == "unhealthy"
    assert body["active_incident"] is not None
    assert body["active_incident"]["recovered_at"] is None
    assert len(body["history"]) == 2


def test_badge_shows_operational_for_a_healthy_project(client, unauthenticated_client, monkeypatch):
    project = create_project(client)
    page = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()
    monkeypatch.setattr("app.services.health_checks.health_check_service.http_client", FakeHttpClient(FakeResponse(200, "ok")))
    assert client.post(f"/api/v1/projects/{project['id']}/health-checks/run").status_code == 201

    response = unauthenticated_client.get(f"/api/v1/public/status-pages/{page['slug']}/badge.svg")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert ">operational<" in response.text


def test_badge_prioritizes_active_incident_over_a_single_check_result(client, unauthenticated_client, db):
    project = create_project(client)
    page = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()
    assert client.put(f"/api/v1/projects/{project['id']}/health-monitor", json={"enabled": True, "cadence_minutes": 15}).status_code == 200
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    for index in range(2):
        run_due_health_checks(db, now=start + timedelta(minutes=20 * index), http_client=FakeHttpClient(FakeResponse(500, "bad")))

    response = unauthenticated_client.get(f"/api/v1/public/status-pages/{page['slug']}/badge.svg")

    assert response.status_code == 200
    assert ">incident<" in response.text


def test_badge_shows_unavailable_for_unknown_or_disabled_slugs_without_a_404(client, unauthenticated_client):
    project = create_project(client)
    page = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()

    unknown = unauthenticated_client.get("/api/v1/public/status-pages/does-not-exist/badge.svg")
    assert unknown.status_code == 200
    assert ">unavailable<" in unknown.text

    client.delete(f"/api/v1/projects/{project['id']}/status-page")
    disabled = unauthenticated_client.get(f"/api/v1/public/status-pages/{page['slug']}/badge.svg")
    assert disabled.status_code == 200
    assert ">unavailable<" in disabled.text


def test_badge_shows_unknown_when_no_checks_have_run_yet(client, unauthenticated_client):
    project = create_project(client)
    page = client.put(f"/api/v1/projects/{project['id']}/status-page", json={"enabled": True, "label": None}).json()

    response = unauthenticated_client.get(f"/api/v1/public/status-pages/{page['slug']}/badge.svg")

    assert response.status_code == 200
    assert ">unknown<" in response.text

from datetime import datetime, timedelta, timezone

from app.jobs.run_due_health_checks import run_due_health_checks
from app.services.health_checks import health_check_service

from tests.test_health_checks import FakeHttpClient, FakeResponse, create_project


def test_project_owner_can_read_default_disabled_monitor(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/health-monitor")

    assert response.status_code == 200
    assert response.json() == {
        "project_id": project["id"],
        "enabled": False,
        "cadence_minutes": 60,
        "next_run_at": None,
        "last_started_at": None,
        "last_completed_at": None,
        "last_outcome": None,
        "consecutive_failures": 0,
        "consecutive_healthy": 0,
        "active_alert": None,
        "freshness": "disabled",
        "failure_threshold": 2,
        "recovery_threshold": 2,
        "created_at": None,
        "updated_at": None,
    }


def test_project_owner_can_enable_hourly_monitor(client):
    project = create_project(client)

    response = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 60},
    )

    assert response.status_code == 200
    monitor = response.json()
    assert monitor["project_id"] == project["id"]
    assert monitor["enabled"] is True
    assert monitor["cadence_minutes"] == 60
    assert monitor["next_run_at"] is not None


def test_monitor_rejects_unsupported_cadence(client):
    project = create_project(client)

    response = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 10},
    )

    assert response.status_code == 422


def test_monitor_cannot_be_enabled_without_project_production_url(client):
    project = create_project(client, production_url=None)

    response = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 60},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Add a Project production URL before enabling scheduled monitoring."


def test_project_owner_can_pause_monitor(client):
    project = create_project(client)
    enabled = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 60},
    )
    assert enabled.status_code == 200

    response = client.delete(f"/api/v1/projects/{project['id']}/health-monitor")

    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert response.json()["next_run_at"] is None


def test_manual_health_check_exposes_manual_execution_source(client, monkeypatch):
    monkeypatch.setattr(health_check_service, "http_client", FakeHttpClient(FakeResponse(200, "ok")))
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")

    assert response.status_code == 201
    assert response.json()["execution_source"] == "manual"


def test_due_monitor_creates_scheduled_health_check(client, db):
    project = create_project(client)
    enabled = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 15},
    )
    assert enabled.status_code == 200
    fake_client = FakeHttpClient(FakeResponse(200, "scheduled ok"))

    completed = run_due_health_checks(
        db,
        now=datetime.now(timezone.utc) + timedelta(days=1),
        http_client=fake_client,
    )

    assert completed == 1
    history = client.get(f"/api/v1/projects/{project['id']}/health-checks")
    assert history.status_code == 200
    assert history.json()[0]["execution_source"] == "scheduled"
    assert history.json()[0]["status"] == "healthy"
    monitor = client.get(f"/api/v1/projects/{project['id']}/health-monitor").json()
    assert monitor["last_outcome"] == "healthy"
    assert monitor["consecutive_failures"] == 0
    assert monitor["last_completed_at"] is not None


def test_monitor_that_is_not_due_does_not_run(client, db):
    project = create_project(client)
    enabled = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 60},
    )
    assert enabled.status_code == 200
    fake_client = FakeHttpClient(FakeResponse(200, "ok"))

    completed = run_due_health_checks(db, now=datetime.now(timezone.utc), http_client=fake_client)

    assert completed == 0
    assert fake_client.requested_urls == []
    assert client.get(f"/api/v1/projects/{project['id']}/health-checks").json() == []


def test_scheduled_failure_increments_consecutive_failures(client, db):
    project = create_project(client)
    enabled = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 60},
    )
    assert enabled.status_code == 200

    completed = run_due_health_checks(
        db,
        now=datetime.now(timezone.utc) + timedelta(days=1),
        http_client=FakeHttpClient(FakeResponse(503, "unavailable")),
    )

    assert completed == 1
    monitor = client.get(f"/api/v1/projects/{project['id']}/health-monitor").json()
    assert monitor["last_outcome"] == "unhealthy"
    assert monitor["consecutive_failures"] == 1


def test_unsafe_scheduled_target_is_recorded_without_aborting_the_worker(client, db):
    project = create_project(client, production_url="http://127.0.0.1/internal")
    enabled = client.put(
        f"/api/v1/projects/{project['id']}/health-monitor",
        json={"enabled": True, "cadence_minutes": 60},
    )
    assert enabled.status_code == 200
    fake_client = FakeHttpClient(FakeResponse(200, "must not be requested"))

    completed = run_due_health_checks(
        db,
        now=datetime.now(timezone.utc) + timedelta(days=1),
        http_client=fake_client,
    )

    assert completed == 1
    assert fake_client.requested_urls == []
    check = client.get(f"/api/v1/projects/{project['id']}/health-checks").json()[0]
    assert check["status"] == "error"
    assert check["execution_source"] == "scheduled"
    assert "non-public address" in check["error_message"]

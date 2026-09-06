from datetime import datetime, timedelta, timezone

from app.jobs.run_due_health_checks import run_due_health_checks
from tests.test_health_checks import FakeHttpClient, FakeResponse, create_project


def test_scheduled_failures_open_one_alert_and_two_successes_recover(client, db):
    project = create_project(client)
    base = f"/api/v1/projects/{project['id']}"
    assert client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15}).status_code == 200
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    for index, status in enumerate([500, 500, 500, 200, 200]):
        assert run_due_health_checks(db, now=start + timedelta(minutes=20 * index), http_client=FakeHttpClient(FakeResponse(status, "result"))) == 1
        response = client.get(f"{base}/health-alerts")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == (0 if index == 0 else 1)
        if index:
            assert data["items"][0]["status"] == ("recovered" if index == 4 else "active")
        if index == 1:
            alert_id = data["items"][0]["id"]
            first = client.post(f"{base}/health-alerts/{alert_id}/acknowledge")
            assert first.status_code == 200
            assert first.json()["acknowledged_by_user_id"] is not None
            assert client.post(f"{base}/health-alerts/{alert_id}/acknowledge").json() == first.json()
    detail = client.get(f"{base}/health-alerts/{alert_id}").json()
    assert detail["evidence"]["total"] == 5
    assert detail["alert"]["failure_count"] == 3

def test_pause_preserves_alert_and_target_change_closes_without_recovery(client, db):
    project = create_project(client)
    base = f"/api/v1/projects/{project['id']}"
    client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15})
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    for index in range(2):
        run_due_health_checks(db, now=start + timedelta(minutes=20 * index), http_client=FakeHttpClient(FakeResponse(500, "bad")))
    paused = client.delete(f"{base}/health-monitor").json()
    assert paused["freshness"] == "disabled"
    assert paused["active_alert"]["status"] == "active"
    assert paused["consecutive_failures"] == 0
    client.patch(base, json={"production_url": "https://example.org/new"})
    alert = client.get(f"{base}/health-alerts").json()["items"][0]
    assert alert["status"] == "closed"
    assert alert["closure_reason"] == "target_changed"
    assert alert["recovered_at"] is None


def test_enabled_monitor_exposes_freshness_without_old_results(client):
    project = create_project(client)
    base = f"/api/v1/projects/{project['id']}"
    monitor = client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15}).json()
    assert monitor["freshness"] == "awaiting_first_check"
    assert monitor["failure_threshold"] == monitor["recovery_threshold"] == 2

import pytest
from app.core.database import SessionLocal


def enabled_project(client):
    project = create_project(client)
    base = f"/api/v1/projects/{project['id']}"
    assert client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15}).status_code == 200
    return project, base


def observations(client, db, statuses):
    project, base = enabled_project(client)
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    for index, status in enumerate(statuses):
        run_due_health_checks(db, now=start + timedelta(minutes=20 * index), http_client=FakeHttpClient(FakeResponse(status, "result")))
    return project, base, start + timedelta(minutes=20 * len(statuses))


def test_mixed_results_reset_streak_and_recovery_failure_retains_episode(client, db):
    _, base, _ = observations(client, db, [500, 200, 500, 500, 200, 500, 200, 200, 500, 500])
    page = client.get(f"{base}/health-alerts").json()
    assert [item["status"] for item in page["items"]] == ["active", "recovered"]
    assert [item["failure_count"] for item in page["items"]] == [2, 3]
    assert client.get(f"{base}/health-alerts?status=recovered&limit=1").json()["total"] == 1
    assert client.get(f"{base}/health-alerts?limit=1&offset=1").json()["items"][0]["status"] == "recovered"


@pytest.mark.parametrize("action,reason", [("archive", "project_archived"), ("patch_archive", "project_archived"), ("remove", "target_removed")])
def test_monitoring_stop_closes_without_recovery(client, db, action, reason):
    _, base, now = observations(client, db, [500, 500])
    if action == "archive":
        client.delete(base)
    else:
        client.patch(base, json={"status": "archived"} if action == "patch_archive" else {"production_url": None})
    alert = client.get(f"{base}/health-alerts").json()["items"][0]
    assert alert["closure_reason"] == reason
    assert alert["status"] == "closed" and alert["recovered_at"] is None
    assert client.get(f"{base}/health-monitor").json()["enabled"] is False
    assert run_due_health_checks(db, now=now, http_client=FakeHttpClient(FakeResponse(200, "ok"))) == 0
    if action != "remove":
        client.patch(base, json={"status": "development"})
        assert client.get(f"{base}/health-monitor").json()["enabled"] is False


def test_pause_resume_and_cadence_restart_recovery_streak(client, db):
    _, base, now = observations(client, db, [500, 500, 200])
    client.delete(f"{base}/health-monitor")
    client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15})
    run_due_health_checks(db, now=now, http_client=FakeHttpClient(FakeResponse(200, "ok")))
    assert client.get(f"{base}/health-monitor").json()["active_alert"]["status"] == "active"
    client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 60})
    assert client.get(f"{base}/health-monitor").json()["consecutive_healthy"] == 0
    for index in range(2):
        run_due_health_checks(db, now=now + timedelta(hours=index + 1), http_client=FakeHttpClient(FakeResponse(200, "ok")))
    assert client.get(f"{base}/health-alerts").json()["items"][0]["status"] == "recovered"


def test_unrelated_edit_and_same_schedule_preserve_streak(client, db):
    _, base, now = observations(client, db, [500])
    client.patch(base, json={"name": "Renamed"})
    client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15})
    run_due_health_checks(db, now=now, http_client=FakeHttpClient(FakeResponse(500, "bad")))
    assert client.get(f"{base}/health-alerts").json()["total"] == 1


def test_manual_checks_never_recover_alert_or_enter_evidence(client, db, monkeypatch):
    from app.services.health_checks import health_check_service
    _, base, _ = observations(client, db, [500, 500])
    monkeypatch.setattr(health_check_service, "http_client", FakeHttpClient(FakeResponse(200, "ok")))
    for body in ({}, {"url": "https://other.example.com"}):
        assert client.post(f"{base}/health-checks/run", json=body).status_code == 201
    monitor = client.get(f"{base}/health-monitor").json()
    assert monitor["consecutive_healthy"] == 0
    alert = monitor["active_alert"]
    assert client.get(f"{base}/health-alerts/{alert['id']}").json()["evidence"]["total"] == 2


@pytest.mark.parametrize("mutation", ["pause", "url", "archive"])
def test_inflight_results_cannot_change_new_monitoring_state(client, db, mutation):
    _, base = enabled_project(client)
    class MutatingClient:
        def get(self, url):
            if mutation == "pause": client.delete(f"{base}/health-monitor")
            elif mutation == "url": client.patch(base, json={"production_url": "https://new.example.com"})
            else: client.delete(base)
            return FakeResponse(500, "bad")
    assert run_due_health_checks(db, now=datetime.now(timezone.utc) + timedelta(hours=1), http_client=MutatingClient()) == 0
    assert client.get(f"{base}/health-checks").json() == []
    assert client.get(f"{base}/health-alerts").json()["total"] == 0


def test_concurrent_worker_does_not_count_inflight_result_twice(client, db):
    _, base = enabled_project(client)
    now = datetime.now(timezone.utc) + timedelta(hours=1)
    class RacingClient:
        def get(self, url):
            with SessionLocal() as other_db:
                assert run_due_health_checks(other_db, now=now, http_client=FakeHttpClient(FakeResponse(500, "bad"))) == 0
            return FakeResponse(500, "bad")
    assert run_due_health_checks(db, now=now, http_client=RacingClient()) == 1
    assert client.get(f"{base}/health-monitor").json()["consecutive_failures"] == 1
    assert len(client.get(f"{base}/health-checks").json()) == 1


def test_expired_claim_result_discarded_and_later_attempt_succeeds(client, db, monkeypatch):
    import app.services.scheduled_health_checks as worker
    _, base = enabled_project(client)
    current = datetime.now(timezone.utc) + timedelta(hours=1)
    class Clock:
        @staticmethod
        def now(tz): return current
    monkeypatch.setattr(worker, "datetime", Clock)
    class SlowClient:
        def get(self, url):
            nonlocal current
            current += timedelta(minutes=11)
            return FakeResponse(500, "late")
    assert run_due_health_checks(db, http_client=SlowClient()) == 0
    assert client.get(f"{base}/health-checks").json() == []
    current += timedelta(minutes=5)
    assert run_due_health_checks(db, http_client=FakeHttpClient(FakeResponse(500, "bad"))) == 1


def test_processing_failure_does_not_stop_other_project(client, db):
    from app.services.scheduled_health_checks import ScheduledHealthRunError
    first, base1 = enabled_project(client)
    second, base2 = enabled_project(client)
    client.patch(base2, json={"production_url": "https://second.example.com"})
    class BrokenClient:
        def get(self, url):
            if "second" not in url: raise RuntimeError("simulated unexpected transport failure")
            return FakeResponse(200, "ok")
    with pytest.raises(ScheduledHealthRunError):
        run_due_health_checks(db, now=datetime.now(timezone.utc) + timedelta(hours=1), http_client=BrokenClient())
    assert client.get(f"{base1}/health-checks").json() == []
    assert len(client.get(f"{base2}/health-checks").json()) == 1


def test_database_failure_rolls_back_check_alert_schedule_and_activity(client, db):
    from sqlalchemy import text
    from app.services.scheduled_health_checks import ScheduledHealthRunError
    _, base, now = observations(client, db, [500])
    # Inject a database failure at the transaction boundary, not an internal mock.
    db.execute(text("CREATE FUNCTION reject_test_alert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test storage failure'; END $$"))
    db.execute(text("CREATE TRIGGER reject_test_alert BEFORE INSERT ON health_alerts FOR EACH ROW EXECUTE FUNCTION reject_test_alert()"))
    db.commit()
    try:
        with pytest.raises(ScheduledHealthRunError):
            run_due_health_checks(db, now=now, http_client=FakeHttpClient(FakeResponse(500, "bad")))
        assert len(client.get(f"{base}/health-checks").json()) == 1
        assert client.get(f"{base}/health-monitor").json()["consecutive_failures"] == 1
        assert client.get(f"{base}/health-alerts").json()["total"] == 0
        events = client.get(f"{base}/activity").json()
        assert not any(event["event_type"] == "health_alert_opened" for event in events)
    finally:
        db.rollback()
        db.execute(text("DROP TRIGGER reject_test_alert ON health_alerts"))
        db.execute(text("DROP FUNCTION reject_test_alert()"))
        db.commit()


def test_alert_routes_enforce_ownership_and_validation(client, db):
    from tests.test_project_ownership import _register, _headers
    _, base, _ = observations(client, db, [500, 500, 200, 200])
    alert = client.get(f"{base}/health-alerts").json()["items"][0]
    other = _headers(_register(client, "other-alert-owner@example.com"))
    for path in (f"{base}/health-alerts", f"{base}/health-alerts/{alert['id']}"):
        assert client.get(path, headers=other).status_code == 404
        assert client.get(path, headers={"Authorization": ""}).status_code == 401
    assert client.post(f"{base}/health-alerts/{alert['id']}/acknowledge", headers=other).status_code == 404
    assert client.post(f"{base}/health-alerts/{alert['id']}/acknowledge").status_code == 409
    assert client.get(f"{base}/health-alerts?limit=101").status_code == 422
    assert client.get(f"{base}/health-alerts?offset=-1").status_code == 422
    assert client.get(f"{base}/health-alerts?status=wrong").status_code == 422
    detail = client.get(f"{base}/health-alerts/{alert['id']}?limit=1&offset=1").json()
    assert detail["evidence"]["total"] == 4 and len(detail["evidence"]["items"]) == 1

def test_freshness_grace_boundary_and_claim_does_not_hide_overdue(client, db, monkeypatch):
    import app.services.monitor_state as state
    import app.services.health_monitor_schedules as schedules
    current = datetime(2030, 1, 1, tzinfo=timezone.utc)
    class Clock:
        @staticmethod
        def now(tz): return current
    monkeypatch.setattr(state, "datetime", Clock)
    monkeypatch.setattr(schedules, "datetime", Clock)
    _, base = enabled_project(client)
    current += timedelta(minutes=24, seconds=59)
    assert client.get(f"{base}/health-monitor").json()["freshness"] == "awaiting_first_check"
    current += timedelta(seconds=1)
    assert client.get(f"{base}/health-monitor").json()["freshness"] == "overdue"
    class InspectingClient:
        def get(self, url):
            assert client.get(f"{base}/health-monitor").json()["freshness"] == "overdue"
            return FakeResponse(200, "ok")
    run_due_health_checks(db, now=current, http_client=InspectingClient())
    assert client.get(f"{base}/health-monitor").json()["freshness"] == "current"
    current += timedelta(minutes=25)
    assert client.get(f"{base}/health-monitor").json()["freshness"] == "overdue"
    client.delete(f"{base}/health-monitor")
    assert client.get(f"{base}/health-monitor").json()["freshness"] == "disabled"
    client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15})
    assert client.get(f"{base}/health-monitor").json()["freshness"] == "awaiting_first_check"


def test_real_http_client_stream_is_bounded(client, db):
    import httpx
    _, base = enabled_project(client)
    consumed = 0
    class LargeBody(httpx.SyncByteStream):
        def __iter__(self):
            nonlocal consumed
            for _ in range(100):
                consumed += 1024
                yield b"x" * 1024
    with httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200, stream=LargeBody()))) as http_client:
        run_due_health_checks(db, now=datetime.now(timezone.utc) + timedelta(hours=1), http_client=http_client)
    assert consumed == 16384
    assert len(client.get(f"{base}/health-checks").json()[0]["response_preview"]) == 500

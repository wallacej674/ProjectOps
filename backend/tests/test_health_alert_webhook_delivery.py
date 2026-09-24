from datetime import datetime, timedelta, timezone

from app.jobs.run_due_health_checks import run_due_health_checks
from app.services.alert_webhook_client import alert_webhook_client
from tests.test_health_checks import FakeHttpClient, FakeResponse, create_project


class FakeWebhookResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


class FakeWebhookHttpClient:
    def __init__(self, response: FakeWebhookResponse) -> None:
        self.response = response
        self.requests: list[tuple[str, dict]] = []

    def post(self, url: str, json: dict) -> FakeWebhookResponse:
        self.requests.append((url, json))
        return self.response


def enabled_project_with_webhook(client, fake_client):
    project = create_project(client)
    base = f"/api/v1/projects/{project['id']}"
    assert client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15}).status_code == 200
    assert client.put(f"{base}/alert-webhook",
        json={"enabled": True, "url": "https://hooks.slack.com/services/T000/B000/XXXX"}).status_code == 200
    return project, base


def activity_metadata_for(client, base, event_type):
    events = client.get(f"{base}/activity").json()
    return next(event["metadata"] for event in events if event["event_type"] == event_type)


def test_opening_and_recovering_an_alert_each_fire_exactly_one_webhook_post(client, monkeypatch, db):
    fake_client = FakeWebhookHttpClient(FakeWebhookResponse(200))
    monkeypatch.setattr(alert_webhook_client, "http_client", fake_client)
    project, base = enabled_project_with_webhook(client, fake_client)
    start = datetime.now(timezone.utc) + timedelta(hours=1)

    run_due_health_checks(db, now=start, http_client=FakeHttpClient(FakeResponse(500, "bad")))
    run_due_health_checks(db, now=start + timedelta(minutes=20), http_client=FakeHttpClient(FakeResponse(500, "bad")))

    assert len(fake_client.requests) == 1
    url, payload = fake_client.requests[0]
    assert url == "https://hooks.slack.com/services/T000/B000/XXXX"
    assert payload["event"] == "health_alert.opened"
    assert payload["project"] == {"id": project["id"], "name": project["name"]}
    assert payload["alert"]["status"] == "active"
    assert "text" in payload
    metadata = activity_metadata_for(client, base, "health_alert_opened")
    assert metadata["webhook_delivery"] == {"attempted": True, "delivered": True, "http_status": 200, "error": None}

    run_due_health_checks(db, now=start + timedelta(minutes=40), http_client=FakeHttpClient(FakeResponse(200, "ok")))
    run_due_health_checks(db, now=start + timedelta(minutes=60), http_client=FakeHttpClient(FakeResponse(200, "ok")))

    assert len(fake_client.requests) == 2
    _, recovered_payload = fake_client.requests[1]
    assert recovered_payload["event"] == "health_alert.recovered"
    webhook = client.get(f"{base}/alert-webhook").json()
    assert webhook["last_delivery_transition"] == "recovered"
    assert webhook["last_delivery_outcome"] == "delivered"


def test_acknowledge_and_close_do_not_fire_a_webhook(client, monkeypatch, db):
    fake_client = FakeWebhookHttpClient(FakeWebhookResponse(200))
    monkeypatch.setattr(alert_webhook_client, "http_client", fake_client)
    project, base = enabled_project_with_webhook(client, fake_client)
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    run_due_health_checks(db, now=start, http_client=FakeHttpClient(FakeResponse(500, "bad")))
    run_due_health_checks(db, now=start + timedelta(minutes=20), http_client=FakeHttpClient(FakeResponse(500, "bad")))
    assert len(fake_client.requests) == 1
    alert_id = client.get(f"{base}/health-alerts").json()["items"][0]["id"]

    assert client.post(f"{base}/health-alerts/{alert_id}/acknowledge").status_code == 200
    assert len(fake_client.requests) == 1

    client.patch(base, json={"production_url": "https://example.org/new"})
    assert len(fake_client.requests) == 1


def test_a_failed_delivery_does_not_block_the_alert_transition(client, monkeypatch, db):
    fake_client = FakeWebhookHttpClient(FakeWebhookResponse(500))
    monkeypatch.setattr(alert_webhook_client, "http_client", fake_client)
    project, base = enabled_project_with_webhook(client, fake_client)
    start = datetime.now(timezone.utc) + timedelta(hours=1)

    run_due_health_checks(db, now=start, http_client=FakeHttpClient(FakeResponse(500, "bad")))
    run_due_health_checks(db, now=start + timedelta(minutes=20), http_client=FakeHttpClient(FakeResponse(500, "bad")))

    assert len(fake_client.requests) == 1
    alerts = client.get(f"{base}/health-alerts").json()
    assert alerts["total"] == 1
    assert alerts["items"][0]["status"] == "active"
    webhook = client.get(f"{base}/alert-webhook").json()
    assert webhook["last_delivery_outcome"] == "failed"
    assert webhook["last_delivery_http_status"] == 500
    metadata = activity_metadata_for(client, base, "health_alert_opened")
    assert metadata["webhook_delivery"]["delivered"] is False


def test_disabled_webhook_fires_no_requests(client, monkeypatch, db):
    fake_client = FakeWebhookHttpClient(FakeWebhookResponse(200))
    monkeypatch.setattr(alert_webhook_client, "http_client", fake_client)
    project, base = enabled_project_with_webhook(client, fake_client)
    client.delete(f"{base}/alert-webhook")
    start = datetime.now(timezone.utc) + timedelta(hours=1)

    run_due_health_checks(db, now=start, http_client=FakeHttpClient(FakeResponse(500, "bad")))
    run_due_health_checks(db, now=start + timedelta(minutes=20), http_client=FakeHttpClient(FakeResponse(500, "bad")))

    assert fake_client.requests == []


def test_no_webhook_configured_fires_no_requests_and_does_not_error(client, monkeypatch, db):
    fake_client = FakeWebhookHttpClient(FakeWebhookResponse(200))
    monkeypatch.setattr(alert_webhook_client, "http_client", fake_client)
    project = create_project(client)
    base = f"/api/v1/projects/{project['id']}"
    assert client.put(f"{base}/health-monitor", json={"enabled": True, "cadence_minutes": 15}).status_code == 200
    start = datetime.now(timezone.utc) + timedelta(hours=1)

    run_due_health_checks(db, now=start, http_client=FakeHttpClient(FakeResponse(500, "bad")))
    run_due_health_checks(db, now=start + timedelta(minutes=20), http_client=FakeHttpClient(FakeResponse(500, "bad")))

    assert fake_client.requests == []
    assert client.get(f"{base}/health-alerts").json()["total"] == 1

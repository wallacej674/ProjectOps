from app.services.alert_webhook_client import alert_webhook_client
from tests.test_health_checks import create_project


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


def test_project_owner_can_read_default_disabled_webhook(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/alert-webhook")

    assert response.status_code == 200
    assert response.json() == {
        "project_id": project["id"], "enabled": False, "url": "",
        "last_delivery_attempted_at": None, "last_delivery_transition": None, "last_delivery_outcome": None,
        "last_delivery_http_status": None, "last_delivery_error": None, "created_at": None, "updated_at": None,
    }


def test_project_owner_can_enable_webhook_and_url_is_echoed_verbatim(client):
    project = create_project(client)

    response = client.put(f"/api/v1/projects/{project['id']}/alert-webhook",
        json={"enabled": True, "url": "https://hooks.slack.com/services/T000/B000/XXXX"})

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["url"] == "https://hooks.slack.com/services/T000/B000/XXXX"


def test_webhook_cannot_be_enabled_without_a_url(client):
    project = create_project(client)

    response = client.put(f"/api/v1/projects/{project['id']}/alert-webhook", json={"enabled": True, "url": ""})

    assert response.status_code == 422
    assert response.json()["detail"] == "Add a webhook URL before enabling alert delivery."


def test_pausing_webhook_preserves_the_saved_url(client):
    project = create_project(client)
    client.put(f"/api/v1/projects/{project['id']}/alert-webhook",
        json={"enabled": True, "url": "https://hooks.slack.com/services/T000/B000/XXXX"})

    paused = client.delete(f"/api/v1/projects/{project['id']}/alert-webhook")

    assert paused.status_code == 200
    body = paused.json()
    assert body["enabled"] is False
    assert body["url"] == "https://hooks.slack.com/services/T000/B000/XXXX"


def test_test_send_requires_an_enabled_configured_webhook(client):
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/alert-webhook/test")

    assert response.status_code == 422
    assert response.json()["detail"] == "Configure and enable a webhook before sending a test notification."


def test_test_send_records_a_delivered_outcome(client, monkeypatch):
    project = create_project(client)
    client.put(f"/api/v1/projects/{project['id']}/alert-webhook",
        json={"enabled": True, "url": "https://hooks.slack.com/services/T000/B000/XXXX"})
    fake_client = FakeWebhookHttpClient(FakeWebhookResponse(200))
    monkeypatch.setattr(alert_webhook_client, "http_client", fake_client)

    response = client.post(f"/api/v1/projects/{project['id']}/alert-webhook/test")

    assert response.status_code == 200
    body = response.json()
    assert body["last_delivery_outcome"] == "delivered"
    assert body["last_delivery_transition"] == "test"
    assert body["last_delivery_http_status"] == 200
    assert len(fake_client.requests) == 1
    sent_url, sent_payload = fake_client.requests[0]
    assert sent_url == "https://hooks.slack.com/services/T000/B000/XXXX"
    assert sent_payload["event"] == "health_alert.test"
    assert sent_payload["alert"] is None
    assert "text" in sent_payload


def test_test_send_rejects_an_unsafe_url(client):
    project = create_project(client)
    client.put(f"/api/v1/projects/{project['id']}/alert-webhook",
        json={"enabled": True, "url": "http://127.0.0.1/hook"})

    response = client.post(f"/api/v1/projects/{project['id']}/alert-webhook/test")

    assert response.status_code == 422
    detail = client.get(f"/api/v1/projects/{project['id']}/alert-webhook").json()
    assert detail["last_delivery_outcome"] is None

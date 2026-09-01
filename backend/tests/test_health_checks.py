from app.services.health_checks import health_check_service


class FakeResponse:
    def __init__(self, status_code: int, text: str = "") -> None:
        self.status_code = status_code
        self.text = text


class FakeHttpClient:
    def __init__(self, response: FakeResponse) -> None:
        self.response = response
        self.requested_urls: list[str] = []

    def get(self, url: str) -> FakeResponse:
        self.requested_urls.append(url)
        return self.response


def create_project(client, production_url="https://launchbudget.example.com"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "LaunchBudget",
            "description": "A budgeting app for product launches.",
            "repo_url": None,
            "production_url": production_url,
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_run_health_check_uses_project_production_url(client, monkeypatch):
    fake_client = FakeHttpClient(FakeResponse(200, "ok"))
    monkeypatch.setattr(health_check_service, "http_client", fake_client)
    project = create_project(client)

    response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")

    assert response.status_code == 201
    health_check = response.json()
    assert fake_client.requested_urls == ["https://launchbudget.example.com"]
    assert health_check["project_id"] == project["id"]
    assert health_check["target_url"] == "https://launchbudget.example.com"
    assert health_check["status"] == "healthy"
    assert health_check["http_status_code"] == 200
    assert health_check["error_message"] is None
    assert health_check["response_preview"] == "ok"


def test_run_health_check_uses_request_url_when_provided(client, monkeypatch):
    fake_client = FakeHttpClient(FakeResponse(200, "ok"))
    monkeypatch.setattr(health_check_service, "http_client", fake_client)
    project = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/health-checks/run",
        json={"url": "https://status.example.com/health"},
    )

    assert response.status_code == 201
    assert fake_client.requested_urls == ["https://status.example.com/health"]
    assert response.json()["target_url"] == "https://status.example.com/health"


def test_run_health_check_without_url_returns_400(client):
    project = create_project(client, production_url=None)

    response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")

    assert response.status_code == 400
    assert response.json()["detail"] == "Provide a URL or set production_url on the Project."


def test_get_latest_health_check_returns_newest_snapshot(client, monkeypatch):
    fake_client = FakeHttpClient(FakeResponse(200, "ok"))
    monkeypatch.setattr(health_check_service, "http_client", fake_client)
    project = create_project(client)
    first_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert first_response.status_code == 201
    second_response = client.post(
        f"/api/v1/projects/{project['id']}/health-checks/run",
        json={"url": "https://status.example.com/health"},
    )
    assert second_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/health-checks/latest")

    assert response.status_code == 200
    assert response.json()["id"] == second_response.json()["id"]


def test_get_latest_health_check_without_checks_returns_404(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/health-checks/latest")

    assert response.status_code == 404
    assert response.json()["detail"] == f"Project {project['id']} does not have a health check yet."


def test_list_health_checks_returns_newest_first(client, monkeypatch):
    fake_client = FakeHttpClient(FakeResponse(200, "ok"))
    monkeypatch.setattr(health_check_service, "http_client", fake_client)
    project = create_project(client)
    first_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert first_response.status_code == 201
    second_response = client.post(f"/api/v1/projects/{project['id']}/health-checks/run")
    assert second_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/health-checks")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [
        second_response.json()["id"],
        first_response.json()["id"],
    ]

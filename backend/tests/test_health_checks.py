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


def create_project(client, production_url="https://launchbudget.example.com", name="LaunchBudget"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
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


def test_cross_project_health_returns_latest_check_per_project(client, monkeypatch):
    fake_client = FakeHttpClient(FakeResponse(200, "ok"))
    monkeypatch.setattr(health_check_service, "http_client", fake_client)
    checked_project = create_project(client, production_url="https://checked.example.com", name="Checked App")
    unchecked_project = create_project(client, production_url="https://unchecked.example.com", name="Unchecked App")
    first_run = client.post(f"/api/v1/projects/{checked_project['id']}/health-checks/run")
    assert first_run.status_code == 201
    second_run = client.post(f"/api/v1/projects/{checked_project['id']}/health-checks/run")
    assert second_run.status_code == 201

    response = client.get("/api/v1/health-checks")

    assert response.status_code == 200
    by_project_id = {item["project_id"]: item for item in response.json()}
    assert by_project_id[checked_project["id"]]["project_name"] == "Checked App"
    assert by_project_id[checked_project["id"]]["latest_check"]["id"] == second_run.json()["id"]
    assert by_project_id[unchecked_project["id"]]["latest_check"] is None


def test_cross_project_health_returns_empty_list_with_no_projects(client):
    response = client.get("/api/v1/health-checks")

    assert response.status_code == 200
    assert response.json() == []

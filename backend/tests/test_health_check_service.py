import httpx
import pytest

from app.schemas.health_check import HealthCheckRunRequest
from app.schemas.project import ProjectCreate
from app.services.health_checks import HealthCheckTargetUrlMissingError, health_check_service
from app.services.projects import project_service


class FakeResponse:
    def __init__(self, status_code: int, text: str = "") -> None:
        self.status_code = status_code
        self.text = text


class FakeHttpClient:
    def __init__(self, response: FakeResponse) -> None:
        self.response = response

    def get(self, url: str) -> FakeResponse:
        assert url == "https://launchbudget.example.com"
        return self.response


class TimeoutHttpClient:
    def get(self, url: str):
        raise httpx.TimeoutException("Request timed out.")


class ErrorHttpClient:
    def get(self, url: str):
        raise httpx.RequestError("Network is unreachable.")


def create_project(db, production_url="https://launchbudget.example.com"):
    return project_service.create_project(
        db,
        ProjectCreate(
            name="LaunchBudget",
            description="A budgeting app for product launches.",
            repo_url=None,
            production_url=production_url,
            status="development",
        ),
    )


def test_health_check_service_stores_healthy_result(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=FakeHttpClient(FakeResponse(200, "ok")),
    )

    assert health_check.project_id == project.id
    assert health_check.target_url == "https://launchbudget.example.com"
    assert health_check.status == "healthy"
    assert health_check.http_status_code == 200
    assert health_check.response_time_ms >= 0
    assert health_check.error_message is None
    assert health_check.response_preview == "ok"


def test_health_check_service_stores_unhealthy_result_for_http_error_status(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=FakeHttpClient(FakeResponse(500, "server error")),
    )

    assert health_check.status == "unhealthy"
    assert health_check.http_status_code == 500
    assert health_check.error_message is None
    assert health_check.response_preview == "server error"


def test_health_check_service_stores_timeout_result(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=TimeoutHttpClient(),
    )

    assert health_check.status == "timeout"
    assert health_check.http_status_code is None
    assert health_check.error_message == "Request timed out."
    assert health_check.response_preview is None


def test_health_check_service_stores_error_result(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=ErrorHttpClient(),
    )

    assert health_check.status == "error"
    assert health_check.http_status_code is None
    assert health_check.error_message == "Network is unreachable."
    assert health_check.response_preview is None


def test_health_check_service_requires_url_or_project_production_url(db):
    project = create_project(db, production_url=None)

    with pytest.raises(HealthCheckTargetUrlMissingError, match="Provide a URL"):
        health_check_service.run_health_check(db, project.id, HealthCheckRunRequest())


def test_health_check_service_truncates_response_preview(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=FakeHttpClient(FakeResponse(200, "x" * 600)),
    )

    assert len(health_check.response_preview) == 500

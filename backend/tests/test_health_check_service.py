import httpx
import pytest

from app.schemas.health_check import HealthCheckRunRequest
from app.schemas.project import ProjectCreate
from app.services.health_checks import HealthCheckTargetUrlMissingError, health_check_service
from app.services.projects import project_service


@pytest.fixture(autouse=True)
def _patch_dns_resolver(monkeypatch):
    """Prevent real DNS lookups in health check service tests.

    Tests that use FakeHttpClient work with a fake domain (launchbudget.example.com)
    that may not resolve publicly. This fixture makes the module-level resolver
    return a safe public IP for any hostname so SSRF validation passes in normal tests.
    Individual SSRF tests override this to inject private IPs.
    """
    from app.services import health_checks as hc_module
    monkeypatch.setattr(hc_module, "_resolve_url_addresses", lambda hostname: ["93.184.216.34"])


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


def test_health_check_service_stores_healthy_result_for_3xx(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=FakeHttpClient(FakeResponse(302, "")),
    )

    assert health_check.status == "healthy"
    assert health_check.http_status_code == 302


def test_health_check_service_stores_unhealthy_result_for_4xx(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=FakeHttpClient(FakeResponse(404, "not found")),
    )

    assert health_check.status == "unhealthy"
    assert health_check.http_status_code == 404


def test_health_check_service_truncates_response_preview(db):
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=FakeHttpClient(FakeResponse(200, "x" * 600)),
    )

    assert len(health_check.response_preview) == 500


# ---------------------------------------------------------------------------
# SSRF validation integration
# ---------------------------------------------------------------------------

class TrackingHttpClient:
    """HTTP client that records whether it was called."""
    def __init__(self, response: FakeResponse) -> None:
        self.response = response
        self.called = False

    def get(self, url: str) -> FakeResponse:
        self.called = True
        return self.response


def test_response_body_is_bounded_at_max_bytes(db):
    from app.services.health_checks import MAX_RESPONSE_BODY_BYTES, RESPONSE_PREVIEW_MAX_LENGTH

    large_body = "a" * (MAX_RESPONSE_BODY_BYTES + 5_000)
    project = create_project(db)

    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(),
        http_client=FakeHttpClient(FakeResponse(200, large_body)),
    )

    assert health_check.response_preview is not None
    assert len(health_check.response_preview) <= RESPONSE_PREVIEW_MAX_LENGTH


def test_blocked_ssrf_url_raises_error_and_never_calls_http_client(db):
    from app.services.url_validator import HealthCheckUrlSafetyError

    project = create_project(db)
    tracking_client = TrackingHttpClient(FakeResponse(200, "ok"))

    with pytest.raises(HealthCheckUrlSafetyError):
        health_check_service.run_health_check(
            db,
            project.id,
            HealthCheckRunRequest(url="http://127.0.0.1"),
            http_client=tracking_client,
        )

    assert not tracking_client.called


def test_public_url_is_allowed_when_resolver_returns_public_ip(db, monkeypatch):
    from app.services import health_checks as hc_module

    monkeypatch.setattr(hc_module, "_resolve_url_addresses", lambda hostname: ["93.184.216.34"])
    tracking_client = TrackingHttpClient(FakeResponse(200, "ok"))

    project = create_project(db)
    health_check = health_check_service.run_health_check(
        db,
        project.id,
        HealthCheckRunRequest(url="https://public.example.com"),
        http_client=tracking_client,
    )

    assert tracking_client.called
    assert health_check.status == "healthy"


def test_private_url_via_hostname_is_blocked(db, monkeypatch):
    from app.services import health_checks as hc_module
    from app.services.url_validator import HealthCheckUrlSafetyError

    monkeypatch.setattr(hc_module, "_resolve_url_addresses", lambda hostname: ["10.0.0.1"])
    tracking_client = TrackingHttpClient(FakeResponse(200, "ok"))

    project = create_project(db)

    with pytest.raises(HealthCheckUrlSafetyError):
        health_check_service.run_health_check(
            db,
            project.id,
            HealthCheckRunRequest(url="http://internal.corp.example.com"),
            http_client=tracking_client,
        )

    assert not tracking_client.called

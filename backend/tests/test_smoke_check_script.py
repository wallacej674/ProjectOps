from scripts.smoke_check import SmokeCheckResult, check_deployment, normalize_base_url


class FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, object]):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict[str, object]:
        return self._payload


class FakeClient:
    def __init__(self, responses: dict[str, FakeResponse]):
        self.responses = responses
        self.requested_paths: list[str] = []

    def get(self, path: str) -> FakeResponse:
        self.requested_paths.append(path)
        return self.responses[path]


def test_normalize_base_url_removes_trailing_slashes():
    assert normalize_base_url("https://projectops-api.example.com///") == "https://projectops-api.example.com"


def test_check_deployment_passes_health_and_database_health():
    client = FakeClient(
        {
            "/health": FakeResponse(200, {"status": "ok", "environment": "private-beta"}),
            "/health/db": FakeResponse(200, {"status": "ok"}),
        }
    )

    results = check_deployment(client)

    assert client.requested_paths == ["/health", "/health/db"]
    assert results == [
        SmokeCheckResult(name="/health", passed=True, detail="status=ok environment=private-beta"),
        SmokeCheckResult(name="/health/db", passed=True, detail="status=ok"),
    ]


def test_check_deployment_reports_failed_health_without_secrets():
    client = FakeClient(
        {
            "/health": FakeResponse(500, {"detail": "Database URL postgresql://secret should not print"}),
            "/health/db": FakeResponse(503, {"status": "error"}),
        }
    )

    results = check_deployment(client)

    assert results[0] == SmokeCheckResult(name="/health", passed=False, detail="status_code=500")
    assert results[1] == SmokeCheckResult(name="/health/db", passed=False, detail="status_code=503")

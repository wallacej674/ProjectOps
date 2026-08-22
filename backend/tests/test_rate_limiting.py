from app.core.config import Settings, get_settings
from app.core.rate_limit import FixedWindowRateLimiter
from app.main import app


class FakeTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        return ["README.md", "backend/app/main.py", ".github/workflows/ci.yml"]


class FakeHealthResponse:
    status_code = 200
    text = "ok"


class FakeHealthClient:
    def get(self, url: str) -> FakeHealthResponse:
        return FakeHealthResponse()


def _settings(**overrides) -> Settings:
    return Settings(
        rate_limit_auth_login_attempts=overrides.get("login_attempts", 50),
        rate_limit_auth_login_window_seconds=overrides.get("login_window", 300),
        rate_limit_auth_register_attempts=overrides.get("register_attempts", 50),
        rate_limit_auth_register_window_seconds=overrides.get("register_window", 3600),
        rate_limit_demo_seed_attempts=overrides.get("demo_seed_attempts", 50),
        rate_limit_demo_seed_window_seconds=overrides.get("demo_seed_window", 3600),
        rate_limit_codemap_run_attempts=overrides.get("codemap_attempts", 50),
        rate_limit_codemap_run_window_seconds=overrides.get("codemap_window", 300),
        rate_limit_health_check_run_attempts=overrides.get("health_attempts", 50),
        rate_limit_health_check_run_window_seconds=overrides.get("health_window", 300),
    )


def _register(client, email="engineer@example.com") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct horse battery staple", "display_name": "Engineer"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client, token: str) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=_headers(token),
        json={
            "name": "Rate Limited Project",
            "description": "Project used to verify per-project rate limits.",
            "repo_url": "https://github.com/example/projectops",
            "production_url": "https://projectops.example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_fixed_window_rate_limiter_blocks_after_limit():
    limiter = FixedWindowRateLimiter()

    first = limiter.check("auth.login:test", limit=1, window_seconds=60)
    second = limiter.check("auth.login:test", limit=1, window_seconds=60)

    assert first.allowed is True
    assert second.allowed is False
    assert second.retry_after_seconds > 0


def test_login_rate_limit_returns_429_with_retry_after(unauthenticated_client):
    app.dependency_overrides[get_settings] = lambda: _settings(login_attempts=1)
    try:
        _register(unauthenticated_client)
        first_response = unauthenticated_client.post(
            "/api/v1/auth/login",
            json={"email": "engineer@example.com", "password": "wrong-password"},
        )
        second_response = unauthenticated_client.post(
            "/api/v1/auth/login",
            json={"email": "engineer@example.com", "password": "wrong-password"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first_response.status_code == 401
    assert second_response.status_code == 429
    assert second_response.json()["detail"] == "Too many requests. Please try again later."
    assert int(second_response.headers["Retry-After"]) > 0


def test_register_rate_limit_returns_429(unauthenticated_client):
    app.dependency_overrides[get_settings] = lambda: _settings(register_attempts=1)
    try:
        first_response = unauthenticated_client.post(
            "/api/v1/auth/register",
            json={"email": "first@example.com", "password": "correct horse battery staple"},
        )
        second_response = unauthenticated_client.post(
            "/api/v1/auth/register",
            json={"email": "second@example.com", "password": "correct horse battery staple"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first_response.status_code == 201
    assert second_response.status_code == 429


def test_demo_seed_rate_limit_is_per_user(client):
    app.dependency_overrides[get_settings] = lambda: _settings(demo_seed_attempts=1)
    try:
        first_response = client.post("/api/v1/demo-data/seed")
        second_response = client.post("/api/v1/demo-data/seed")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first_response.status_code == 201
    assert second_response.status_code == 429


def test_codemap_run_rate_limit_is_per_user_project(client, monkeypatch):
    from app.services.repo_analyses import repo_analysis_service

    app.dependency_overrides[get_settings] = lambda: _settings(codemap_attempts=1)
    monkeypatch.setattr(repo_analysis_service, "tree_fetcher", FakeTreeFetcher())
    try:
        project = client.post(
            "/api/v1/projects",
            json={
                "name": "CodeMap Project",
                "description": None,
                "repo_url": "https://github.com/example/projectops",
                "production_url": None,
                "status": "development",
            },
        ).json()
        repo_response = client.post(
            f"/api/v1/projects/{project['id']}/repo",
            json={"repo_url": "https://github.com/openai/codex"},
        )
        first_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
        second_response = client.post(f"/api/v1/projects/{project['id']}/analyses/run")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert repo_response.status_code == 201
    assert first_response.status_code == 201
    assert second_response.status_code == 429


def test_health_check_run_rate_limit_is_per_user_project(client, monkeypatch):
    from app.services import health_checks as health_module
    from app.services.health_checks import health_check_service

    app.dependency_overrides[get_settings] = lambda: _settings(health_attempts=1)
    monkeypatch.setattr(health_module, "_resolve_url_addresses", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(health_check_service, "http_client", FakeHealthClient())
    try:
        token = _register(client, "health-checker@example.com")
        project = _create_project(client, token)
        first_response = client.post(
            f"/api/v1/projects/{project['id']}/health-checks/run",
            headers=_headers(token),
        )
        second_response = client.post(
            f"/api/v1/projects/{project['id']}/health-checks/run",
            headers=_headers(token),
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)
        health_check_service.http_client = None

    assert first_response.status_code == 201
    assert second_response.status_code == 429

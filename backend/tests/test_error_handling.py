import sys
from types import ModuleType

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


def test_unhandled_exception_returns_safe_response_with_request_id():
    app = create_app()

    @app.get("/test-only/crash")
    def crash():
        raise RuntimeError("database password leaked in stack")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/test-only/crash", headers={"X-Request-ID": "support-case-123"})

    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "support-case-123"
    assert response.json() == {
        "detail": "ProjectOps hit an unexpected error.",
        "request_id": "support-case-123",
    }
    assert "database password leaked" not in response.text


def test_unhandled_exception_is_captured_with_request_id(monkeypatch):
    captured: dict[str, object] = {"tags": {}, "contexts": {}, "exceptions": []}
    sentry_module = ModuleType("sentry_sdk")
    sentry_module.__path__ = []  # type: ignore[attr-defined]
    sentry_module.init = lambda **kwargs: None  # type: ignore[attr-defined]
    sentry_module.set_tag = lambda key, value: captured["tags"].__setitem__(key, value)  # type: ignore[attr-defined]
    sentry_module.set_context = lambda key, value: captured["contexts"].__setitem__(key, value)  # type: ignore[attr-defined]
    sentry_module.capture_exception = lambda error: captured["exceptions"].append(error)  # type: ignore[attr-defined]
    integrations_module = ModuleType("sentry_sdk.integrations")
    integration_module = ModuleType("sentry_sdk.integrations.starlette")

    class StarletteIntegration:
        pass

    integration_module.StarletteIntegration = StarletteIntegration  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sentry_sdk", sentry_module)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations", integrations_module)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations.starlette", integration_module)
    monkeypatch.setenv("PROJECTOPS_ENABLE_ERROR_MONITORING", "true")
    monkeypatch.setenv("PROJECTOPS_SENTRY_DSN", "https://public@example.invalid/1")
    get_settings.cache_clear()

    app = create_app()

    @app.get("/test-only/crash")
    def crash():
        raise RuntimeError("captured failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/test-only/crash", headers={"X-Request-ID": "monitoring-request-456"})

    get_settings.cache_clear()
    assert response.status_code == 500
    assert captured["tags"] == {"request_id": "monitoring-request-456"}
    assert captured["contexts"] == {
        "projectops": {
            "request_id": "monitoring-request-456",
            "path": "/test-only/crash",
            "method": "GET",
        }
    }
    assert [str(error) for error in captured["exceptions"]] == ["captured failure"]


def test_monitoring_capture_failure_does_not_break_safe_response(monkeypatch):
    sentry_module = ModuleType("sentry_sdk")
    sentry_module.__path__ = []  # type: ignore[attr-defined]
    sentry_module.init = lambda **kwargs: None  # type: ignore[attr-defined]
    sentry_module.set_tag = lambda key, value: None  # type: ignore[attr-defined]
    sentry_module.set_context = lambda key, value: None  # type: ignore[attr-defined]

    def raise_capture_error(error):
        raise RuntimeError("monitoring provider failed")

    sentry_module.capture_exception = raise_capture_error  # type: ignore[attr-defined]
    integrations_module = ModuleType("sentry_sdk.integrations")
    integration_module = ModuleType("sentry_sdk.integrations.starlette")

    class StarletteIntegration:
        pass

    integration_module.StarletteIntegration = StarletteIntegration  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sentry_sdk", sentry_module)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations", integrations_module)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations.starlette", integration_module)
    monkeypatch.setenv("PROJECTOPS_ENABLE_ERROR_MONITORING", "true")
    monkeypatch.setenv("PROJECTOPS_SENTRY_DSN", "https://public@example.invalid/1")
    get_settings.cache_clear()

    app = create_app()

    @app.get("/test-only/crash")
    def crash():
        raise RuntimeError("application failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/test-only/crash", headers={"X-Request-ID": "safe-after-monitoring-failure"})

    get_settings.cache_clear()
    assert response.status_code == 500
    assert response.json()["request_id"] == "safe-after-monitoring-failure"

import os
import sys
from types import ModuleType

from app.core.config import Settings
from app.core.monitoring import configure_error_monitoring, is_error_monitoring_configured, sanitize_monitoring_event


def test_error_monitoring_is_disabled_by_default():
    settings = Settings()

    assert settings.enable_error_monitoring is False
    assert settings.sentry_dsn == ""
    assert is_error_monitoring_configured(settings) is False


def test_error_monitoring_requires_enable_flag_and_dsn():
    disabled = Settings(enable_error_monitoring=False, sentry_dsn="https://public@example.invalid/1")
    missing_dsn = Settings(enable_error_monitoring=True, sentry_dsn="")
    enabled = Settings(
        enable_error_monitoring=True,
        sentry_dsn="https://public@example.invalid/1",
        sentry_environment="private-beta",
    )

    assert is_error_monitoring_configured(disabled) is False
    assert is_error_monitoring_configured(missing_dsn) is False
    assert is_error_monitoring_configured(enabled) is True
    assert enabled.sentry_environment == "private-beta"


def test_check_config_reports_monitoring_without_printing_dsn(capsys, monkeypatch):
    from scripts.check_config import main

    monkeypatch.setenv("PROJECTOPS_ENABLE_ERROR_MONITORING", "true")
    monkeypatch.setenv("PROJECTOPS_SENTRY_DSN", "https://public@example.invalid/1")
    monkeypatch.setenv("PROJECTOPS_SENTRY_ENVIRONMENT", "private-beta")

    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        exit_code = main()
    finally:
        get_settings.cache_clear()
        for key in (
            "PROJECTOPS_ENABLE_ERROR_MONITORING",
            "PROJECTOPS_SENTRY_DSN",
            "PROJECTOPS_SENTRY_ENVIRONMENT",
        ):
            os.environ.pop(key, None)

    output = capsys.readouterr()
    assert exit_code == 0
    assert "Error monitoring is enabled." in output.out
    assert "example.invalid" not in output.out
    assert "public" not in output.out


def test_configure_error_monitoring_is_noop_without_dsn(monkeypatch):
    monkeypatch.setitem(sys.modules, "sentry_sdk", None)

    configured = configure_error_monitoring(Settings(enable_error_monitoring=False, sentry_dsn=""))

    assert configured is False


def test_configure_error_monitoring_initializes_sentry_with_safe_defaults(monkeypatch):
    init_calls: list[dict[str, object]] = []
    sentry_module = ModuleType("sentry_sdk")
    sentry_module.__path__ = []  # type: ignore[attr-defined]
    sentry_module.init = lambda **kwargs: init_calls.append(kwargs)  # type: ignore[attr-defined]
    integrations_module = ModuleType("sentry_sdk.integrations")
    integration_module = ModuleType("sentry_sdk.integrations.starlette")

    class StarletteIntegration:
        pass

    integration_module.StarletteIntegration = StarletteIntegration  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sentry_sdk", sentry_module)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations", integrations_module)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations.starlette", integration_module)

    configured = configure_error_monitoring(
        Settings(
            environment="production",
            enable_error_monitoring=True,
            sentry_dsn="https://public@example.invalid/1",
            sentry_environment="",
        )
    )

    assert configured is True
    assert init_calls[0]["dsn"] == "https://public@example.invalid/1"
    assert init_calls[0]["environment"] == "production"
    assert init_calls[0]["send_default_pii"] is False
    assert callable(init_calls[0]["before_send"])
    assert len(init_calls[0]["integrations"]) == 1
    assert isinstance(init_calls[0]["integrations"][0], StarletteIntegration)


def test_monitoring_event_sanitizer_removes_sensitive_request_data():
    event = {
        "request": {
            "url": "https://api.projectops.example/api/v1/projects?token=secret",
            "query_string": "token=secret",
            "data": {"password": "secret"},
            "cookies": {"session": "secret"},
            "headers": {
                "Authorization": "Bearer secret",
                "Cookie": "session=secret",
                "X-Request-ID": "safe-id",
            },
        }
    }

    sanitized = sanitize_monitoring_event(event)

    assert sanitized["request"] == {
        "url": "https://api.projectops.example/api/v1/projects",
        "query_string": "[Filtered]",
        "headers": {"X-Request-ID": "safe-id"},
    }

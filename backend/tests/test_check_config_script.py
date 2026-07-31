from app.core.config import get_settings
from scripts.check_config import main


def test_check_config_reports_invalid_production_cors_without_traceback(monkeypatch, capsys):
    get_settings.cache_clear()
    monkeypatch.setenv("PROJECTOPS_ENVIRONMENT", "production")
    monkeypatch.setenv("PROJECTOPS_CORS_ALLOWED_ORIGINS", "*")

    assert main() == 1
    captured = capsys.readouterr()
    assert "PROJECTOPS_CORS_ALLOWED_ORIGINS cannot include '*'" in captured.err
    assert "Traceback" not in captured.err

    get_settings.cache_clear()

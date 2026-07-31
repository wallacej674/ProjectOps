import pytest

from app.core.config import Settings


def test_cors_origins_are_trimmed_and_empty_values_are_ignored():
    settings = Settings(cors_allowed_origins=" http://localhost:5173, ,https://projectops.example ")

    assert settings.cors_origins() == ["http://localhost:5173", "https://projectops.example"]


def test_production_cors_rejects_wildcard_origins():
    settings = Settings(environment="production", cors_allowed_origins="*")

    with pytest.raises(ValueError, match="PROJECTOPS_CORS_ALLOWED_ORIGINS"):
        settings.cors_origins()


def test_production_cors_requires_at_least_one_origin():
    settings = Settings(environment="production", cors_allowed_origins="")

    with pytest.raises(ValueError, match="at least one deployed frontend origin"):
        settings.cors_origins()

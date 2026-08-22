import pytest

from app.core.config import Settings


def test_local_auth_secret_uses_documented_development_default():
    settings = Settings(environment="local")

    assert settings.auth_secret_key
    assert settings.auth_secret_key != "change-me"


def test_production_requires_explicit_auth_secret():
    settings = Settings(
        environment="production",
        cors_allowed_origins="https://projectops.example",
        auth_secret_key="",
    )

    with pytest.raises(ValueError, match="PROJECTOPS_AUTH_SECRET_KEY"):
        settings.validate_auth_settings()


def test_production_rejects_development_auth_secret():
    settings = Settings(
        environment="production",
        cors_allowed_origins="https://projectops.example",
        auth_secret_key=Settings.DEVELOPMENT_AUTH_SECRET,
    )

    with pytest.raises(ValueError, match="PROJECTOPS_AUTH_SECRET_KEY"):
        settings.validate_auth_settings()


def test_token_expiration_must_be_positive():
    settings = Settings(access_token_expire_minutes=0)

    with pytest.raises(ValueError, match="PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES"):
        settings.validate_auth_settings()


def test_rate_limit_values_must_be_positive():
    settings = Settings(rate_limit_auth_login_attempts=0)

    with pytest.raises(ValueError, match="PROJECTOPS_RATE_LIMIT_AUTH_LOGIN_ATTEMPTS"):
        settings.validate_rate_limit_settings()


def test_log_level_must_be_valid():
    settings = Settings(log_level="LOUD")

    with pytest.raises(ValueError, match="PROJECTOPS_LOG_LEVEL"):
        settings.validate_logging_settings()

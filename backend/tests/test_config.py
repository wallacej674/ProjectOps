import pytest

from app.core.config import Settings


@pytest.mark.parametrize("scheme", ["postgres://", "postgresql://"])
def test_provider_database_urls_use_installed_psycopg_driver(scheme: str):
    settings = Settings(database_url=f"{scheme}projectops:secret@db.internal:5432/projectops")

    assert settings.database_url == "postgresql+psycopg://projectops:secret@db.internal:5432/projectops"


def test_explicit_sqlalchemy_database_driver_is_preserved():
    database_url = "postgresql+psycopg://projectops:secret@db.internal:5432/projectops"

    assert Settings(database_url=database_url).database_url == database_url


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


def test_openai_key_loads_from_env_and_is_not_serialized(monkeypatch, tmp_path):
    monkeypatch.setenv('OPENAI_API_KEY', 'test-only-env-key')
    settings = Settings(_env_file=None)
    assert settings.openai_api_key.get_secret_value() == 'test-only-env-key'
    assert 'test-only-env-key' not in repr(settings)
    assert 'openai_api_key' not in settings.model_dump()
    monkeypatch.delenv('OPENAI_API_KEY')
    env_file = tmp_path / '.env'
    env_file.write_text('OPENAI_API_KEY=test-only-file-key\n')
    assert Settings(_env_file=env_file).openai_api_key.get_secret_value() == 'test-only-file-key'


def test_invite_only_registration_configuration_fails_closed():
    with pytest.raises(ValueError, match="invitation code"):
        Settings(_env_file=None, registration_mode="invite_only").validate_auth_settings()


@pytest.mark.parametrize("code", ["short", " " * 16])
def test_invite_only_rejects_short_or_blank_configuration(code):
    with pytest.raises(ValueError, match="invitation code"):
        Settings(_env_file=None, registration_mode="invite_only", registration_invite_code=code).validate_auth_settings()


def test_invitation_configuration_is_hidden_and_loads_from_environment(monkeypatch):
    monkeypatch.setenv("PROJECTOPS_REGISTRATION_MODE", "invite_only")
    monkeypatch.setenv("PROJECTOPS_REGISTRATION_INVITE_CODE", "synthetic-beta-invitation")
    settings = Settings(_env_file=None)
    settings.validate_auth_settings()
    assert settings.registration_mode == "invite_only"
    assert settings.registration_invite_code.get_secret_value() == "synthetic-beta-invitation"
    assert "synthetic-beta-invitation" not in repr(settings)
    assert "registration_invite_code" not in settings.model_dump()


def test_invalid_registration_mode_is_rejected():
    with pytest.raises(ValueError):
        Settings(_env_file=None, registration_mode="invites")


def test_api_startup_rejects_unconfigured_invite_only_registration(monkeypatch):
    from app.core.config import get_settings
    from app.main import create_app
    from pydantic import SecretStr

    monkeypatch.setattr(get_settings(), "registration_mode", "invite_only")
    monkeypatch.setattr(get_settings(), "registration_invite_code", SecretStr(""))
    with pytest.raises(ValueError, match="invitation code"):
        create_app()

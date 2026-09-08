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

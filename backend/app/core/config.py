from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ProjectOps Backend"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://projectops:projectops@localhost:55432/projectops"
    health_check_timeout_seconds: float = 5.0
    cors_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_prefix="PROJECTOPS_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

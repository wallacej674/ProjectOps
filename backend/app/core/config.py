from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ProjectOps Backend"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://projectops:projectops@localhost:55432/projectops"
    health_check_timeout_seconds: float = 5.0
    cors_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
        if self.environment.lower() in {"production", "prod"}:
            if not origins:
                raise ValueError("PROJECTOPS_CORS_ALLOWED_ORIGINS must include at least one deployed frontend origin in production.")
            if "*" in origins:
                raise ValueError("PROJECTOPS_CORS_ALLOWED_ORIGINS cannot include '*' in production.")
        return origins

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_prefix="PROJECTOPS_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

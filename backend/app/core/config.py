from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ProjectOps Backend"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://projectops:projectops@localhost:55432/projectops"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_prefix="PROJECTOPS_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

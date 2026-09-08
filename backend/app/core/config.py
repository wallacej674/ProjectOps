from functools import lru_cache
from typing import ClassVar

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DEVELOPMENT_AUTH_SECRET: ClassVar[str] = "projectops-local-development-auth-secret-do-not-use-in-production"

    openai_api_key: SecretStr = Field(default=SecretStr(""), validation_alias="OPENAI_API_KEY", repr=False, exclude=True)
    code_risk_ai_model: str = Field(default="gpt-5.4-mini-2026-03-17", min_length=1, max_length=200, pattern=r"^[a-zA-Z0-9._-]+$")
    app_name: str = "ProjectOps Backend"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://projectops:projectops@localhost:55432/projectops"
    health_check_timeout_seconds: float = 5.0
    cors_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"
    enable_error_monitoring: bool = False
    sentry_dsn: str = ""
    sentry_environment: str = ""
    auth_secret_key: str = DEVELOPMENT_AUTH_SECRET
    access_token_expire_minutes: int = 60
    auth_token_algorithm: str = "HS256"
    rate_limit_auth_login_attempts: int = 5
    rate_limit_auth_login_window_seconds: int = 300
    rate_limit_auth_register_attempts: int = 5
    rate_limit_auth_register_window_seconds: int = 3600
    rate_limit_demo_seed_attempts: int = 3
    rate_limit_demo_seed_window_seconds: int = 3600
    rate_limit_codemap_run_attempts: int = 5
    rate_limit_codemap_run_window_seconds: int = 300
    rate_limit_health_check_run_attempts: int = 10
    rate_limit_health_check_run_window_seconds: int = 300
    github_app_client_id: str = ""
    github_app_client_secret: str = ""
    github_app_id: str = ""
    github_app_slug: str = ""
    github_app_private_key: str = ""
    github_app_callback_url: str = ""

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Select the installed Psycopg 3 driver for provider PostgreSQL URLs."""
        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    def github_app_enabled(self) -> bool:
        return all(
            value.strip()
            for value in (
                self.github_app_client_id,
                self.github_app_client_secret,
                self.github_app_id,
                self.github_app_slug,
                self.github_app_private_key,
                self.github_app_callback_url,
            )
        )

    def validate_github_app_settings(self) -> None:
        configured = [
            self.github_app_client_id,
            self.github_app_client_secret,
            self.github_app_id,
            self.github_app_slug,
            self.github_app_private_key,
            self.github_app_callback_url,
        ]
        if any(value.strip() for value in configured) and not self.github_app_enabled():
            raise ValueError("GitHub App configuration must be complete when any GitHub App setting is provided.")

    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
        if self.environment.lower() in {"production", "prod"}:
            if not origins:
                raise ValueError("PROJECTOPS_CORS_ALLOWED_ORIGINS must include at least one deployed frontend origin in production.")
            if "*" in origins:
                raise ValueError("PROJECTOPS_CORS_ALLOWED_ORIGINS cannot include '*' in production.")
        return origins

    def validate_auth_settings(self) -> None:
        if self.access_token_expire_minutes <= 0:
            raise ValueError("PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero.")
        if self.environment.lower() in {"production", "prod"} and (
            not self.auth_secret_key.strip() or self.auth_secret_key == self.DEVELOPMENT_AUTH_SECRET
        ):
            raise ValueError("PROJECTOPS_AUTH_SECRET_KEY must be set to a production-only secret.")

    def validate_logging_settings(self) -> None:
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if self.log_level.upper() not in valid_levels:
            raise ValueError("PROJECTOPS_LOG_LEVEL must be one of DEBUG, INFO, WARNING, ERROR, or CRITICAL.")

    def validate_error_monitoring_settings(self) -> None:
        if self.enable_error_monitoring and not self.sentry_dsn.strip():
            raise ValueError("PROJECTOPS_SENTRY_DSN must be set when PROJECTOPS_ENABLE_ERROR_MONITORING is true.")

    def validate_rate_limit_settings(self) -> None:
        values = {
            "PROJECTOPS_RATE_LIMIT_AUTH_LOGIN_ATTEMPTS": self.rate_limit_auth_login_attempts,
            "PROJECTOPS_RATE_LIMIT_AUTH_LOGIN_WINDOW_SECONDS": self.rate_limit_auth_login_window_seconds,
            "PROJECTOPS_RATE_LIMIT_AUTH_REGISTER_ATTEMPTS": self.rate_limit_auth_register_attempts,
            "PROJECTOPS_RATE_LIMIT_AUTH_REGISTER_WINDOW_SECONDS": self.rate_limit_auth_register_window_seconds,
            "PROJECTOPS_RATE_LIMIT_DEMO_SEED_ATTEMPTS": self.rate_limit_demo_seed_attempts,
            "PROJECTOPS_RATE_LIMIT_DEMO_SEED_WINDOW_SECONDS": self.rate_limit_demo_seed_window_seconds,
            "PROJECTOPS_RATE_LIMIT_CODEMAP_RUN_ATTEMPTS": self.rate_limit_codemap_run_attempts,
            "PROJECTOPS_RATE_LIMIT_CODEMAP_RUN_WINDOW_SECONDS": self.rate_limit_codemap_run_window_seconds,
            "PROJECTOPS_RATE_LIMIT_HEALTH_CHECK_RUN_ATTEMPTS": self.rate_limit_health_check_run_attempts,
            "PROJECTOPS_RATE_LIMIT_HEALTH_CHECK_RUN_WINDOW_SECONDS": self.rate_limit_health_check_run_window_seconds,
        }
        for name, value in values.items():
            if value <= 0:
                raise ValueError(f"{name} must be greater than zero.")

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_prefix="PROJECTOPS_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

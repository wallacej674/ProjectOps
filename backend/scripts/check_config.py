import sys

from app.core.config import get_settings


def main() -> int:
    try:
        settings = get_settings()
        settings.cors_origins()
        settings.validate_auth_settings()
        settings.validate_logging_settings()
        settings.validate_error_monitoring_settings()
        settings.validate_rate_limit_settings()
        settings.validate_github_app_settings()
    except ValueError as error:
        print(f"ProjectOps backend config error: {error}", file=sys.stderr)
        return 1
    print(f"ProjectOps backend config OK for environment '{settings.environment}'.")
    print("Database URL is configured.")
    print("CORS allowed origins are configured.")
    print("Auth settings are configured.")
    print("Logging settings are configured.")
    if settings.enable_error_monitoring and settings.sentry_dsn.strip():
        print("Error monitoring is enabled.")
    else:
        print("Error monitoring is disabled or not configured.")
    print("Rate limit settings are configured.")
    print("GitHub App integration is enabled." if settings.github_app_enabled() else "GitHub App integration is disabled or not configured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

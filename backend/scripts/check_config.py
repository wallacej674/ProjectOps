import sys

from app.core.config import get_settings


def main() -> int:
    try:
        settings = get_settings()
        settings.cors_origins()
    except ValueError as error:
        print(f"ProjectOps backend config error: {error}", file=sys.stderr)
        return 1
    print(f"ProjectOps backend config OK for environment '{settings.environment}'.")
    print("Database URL is configured.")
    print("CORS allowed origins are configured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

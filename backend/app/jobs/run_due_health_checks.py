from app.core.database import SessionLocal
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.scheduled_health_checks import run_scheduled_checks, ScheduledHealthRunError

# Preserve the public worker entry point.
run_due_health_checks = run_scheduled_checks


def main() -> int:
    configure_logging(get_settings().log_level)
    with SessionLocal() as db:
        try:
            completed = run_due_health_checks(db)
        except ScheduledHealthRunError:
            return 1
    print(f"Scheduled health monitoring completed {completed} due check(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

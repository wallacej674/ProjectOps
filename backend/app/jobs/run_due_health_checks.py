from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.health_check import HealthCheckExecutionSource
from app.repositories.health_monitor_schedules import health_monitor_schedule_repository
from app.services.health_checks import HealthCheckHttpClient, health_check_service
from app.schemas.health_check import HealthCheckRunRequest


def run_due_health_checks(
    db: Session,
    *,
    now: datetime | None = None,
    http_client: HealthCheckHttpClient | None = None,
    limit: int = 25,
) -> int:
    run_at = now or datetime.now(timezone.utc)
    schedules = health_monitor_schedule_repository.claim_due(db, now=run_at, limit=limit)
    completed = 0
    for schedule in schedules:
        health_check = health_check_service.run_health_check(
            db,
            schedule.project_id,
            HealthCheckRunRequest(),
            http_client=http_client,
            execution_source=HealthCheckExecutionSource.scheduled,
        )
        health_monitor_schedule_repository.complete_run(
            db,
            schedule=schedule,
            outcome=health_check.status,
            completed_at=datetime.now(timezone.utc),
        )
        completed += 1
    return completed


def main() -> int:
    with SessionLocal() as db:
        completed = run_due_health_checks(db)
    print(f"Scheduled health monitoring completed {completed} due check(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

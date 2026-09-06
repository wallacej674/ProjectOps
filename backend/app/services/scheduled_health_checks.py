import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.health_check import HealthCheckExecutionSource
from app.repositories.health_monitor_schedules import health_monitor_schedule_repository
from app.models.project_activity import ProjectActivityEvent
from app.schemas.health_check import HealthCheckRunRequest
from app.services.health_checks import health_check_service
from app.services.health_alerts import apply_observation
from app.services.monitor_state import lock_monitor

logger = logging.getLogger("projectops.health_monitor")


@dataclass(frozen=True)
class MonitorClaim:
    project_id: int
    generation: int
    target_url: str
    claim_id: str
    expires_at: datetime


class ScheduledHealthRunError(RuntimeError):
    pass


def claim_next(db: Session, now: datetime, excluded: list[int]) -> MonitorClaim | None:
    # Lock Projects first, matching completion, acknowledgement and user mutations.
    project = health_monitor_schedule_repository.lock_next_due_project(db, now, excluded)
    if project is None:
        db.rollback()
        return None
    _, schedule = lock_monitor(db, project.id)
    claim_id = str(uuid4())
    expires_at = now + timedelta(minutes=10)
    schedule.claim_id = claim_id
    schedule.claim_expires_at = expires_at
    schedule.last_started_at = now
    schedule.next_run_at = now + timedelta(minutes=schedule.cadence_minutes)
    claim = MonitorClaim(project.id, schedule.generation, project.production_url, claim_id, expires_at)
    db.commit()
    logger.info("monitor_claimed", extra={"project_id": claim.project_id, "claim_id": claim.claim_id})
    return claim


def run_scheduled_checks(db: Session, *, now=None, http_client=None, limit=25) -> int:
    # An injected clock keeps worker integration scenarios deterministic.
    clock = (lambda: now) if now is not None else (lambda: datetime.now(timezone.utc))
    attempted = []
    completed = 0
    failures = 0
    for _ in range(limit):
        claim = claim_next(db, clock(), attempted)
        if claim is None:
            break
        attempted.append(claim.project_id)
        try:
            check = health_check_service.run_health_check(
                db, claim.project_id, HealthCheckRunRequest(url=claim.target_url),
                http_client=http_client, execution_source=HealthCheckExecutionSource.scheduled, persist=False,
            )
            # Release the read transaction used to obtain Project metadata.
            db.rollback()
            project, schedule = lock_monitor(db, claim.project_id)
            if (schedule is None or not schedule.enabled or project.status == "archived"
                or project.production_url != claim.target_url or schedule.generation != claim.generation
                or schedule.claim_id != claim.claim_id or clock() >= claim.expires_at):
                db.rollback()
                logger.info("monitor_result_discarded", extra={"project_id": claim.project_id, "claim_id": claim.claim_id})
                continue
            check.checked_at = clock()
            db.add(check)
            db.flush()
            apply_observation(db, schedule, check)
            schedule.last_completed_at = clock()
            schedule.sequence_completed_at = clock()
            schedule.last_outcome = check.status
            schedule.claim_id = None
            schedule.claim_expires_at = None
            db.add(ProjectActivityEvent(
                project_id=project.id, event_type=f"health_check_{check.status}", event_category="health",
                message=f"Scheduled health check returned {check.status}.", related_resource_type="health_check",
                related_resource_id=check.id, metadata_json={"status": check.status, "execution_source": "scheduled",
                    "http_status_code": check.http_status_code, "response_time_ms": check.response_time_ms},
            ))
            db.commit()
            completed += 1
            logger.info("monitor_completed", extra={"project_id": claim.project_id, "claim_id": claim.claim_id})
        except Exception:
            db.rollback()
            failures += 1
            logger.exception("monitor_processing_failed", extra={"project_id": claim.project_id, "claim_id": claim.claim_id})
    if failures:
        raise ScheduledHealthRunError(f"{failures} scheduled check(s) failed to process; {completed} completed.")
    return completed

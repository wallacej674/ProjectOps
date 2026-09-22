import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.repositories.ci_status_monitor_schedules import ci_status_monitor_schedule_repository
from app.services.ci_monitor_state import lock_monitor
from app.services.ci_pipeline_status import (
    CiActionsPermissionMissingError,
    CiGitHubAppRequiredError,
    CiRepoNotConnectedError,
    CiRepositoryAccessRevokedError,
    CiSyncFailedError,
    ci_pipeline_status_service,
)

logger = logging.getLogger("projectops.ci_status_monitor")

# Outcomes sync_project_ci_status already recorded on the schedule row (last_outcome,
# consecutive_sync_failures) before raising — expected steady-state for an un-reauthorized or
# temporarily-unreachable installation, not a scheduler bug. Log and move to the next project
# rather than surfacing a ScheduledCiStatusRunError.
_EXPECTED_SYNC_ERRORS = (
    CiRepoNotConnectedError,
    CiGitHubAppRequiredError,
    CiActionsPermissionMissingError,
    CiRepositoryAccessRevokedError,
    CiSyncFailedError,
)


@dataclass(frozen=True)
class CiMonitorClaim:
    project_id: int
    claim_id: str


class ScheduledCiStatusRunError(RuntimeError):
    pass


def claim_next(db: Session, now: datetime, excluded: list[int]) -> CiMonitorClaim | None:
    row = ci_status_monitor_schedule_repository.lock_next_due_project(db, now, excluded)
    if row is None:
        db.rollback()
        return None
    project, _repo = row
    _, schedule = lock_monitor(db, project.id)
    claim_id = str(uuid4())
    schedule.claim_id = claim_id
    schedule.claim_expires_at = now + timedelta(minutes=10)
    schedule.last_started_at = now
    schedule.next_run_at = now + timedelta(minutes=schedule.cadence_minutes)
    claim = CiMonitorClaim(project_id=project.id, claim_id=claim_id)
    db.commit()
    logger.info("ci_monitor_claimed", extra={"project_id": claim.project_id, "claim_id": claim.claim_id})
    return claim


def run_scheduled_checks(db: Session, *, now=None, limit: int = 25) -> int:
    # An injected clock keeps worker integration scenarios deterministic.
    clock = (lambda: now) if now is not None else (lambda: datetime.now(timezone.utc))
    attempted: list[int] = []
    completed = 0
    failures = 0
    for _ in range(limit):
        claim = claim_next(db, clock(), attempted)
        if claim is None:
            break
        attempted.append(claim.project_id)
        try:
            ci_pipeline_status_service.sync_project_ci_status(db, claim.project_id, execution_source="scheduled")
            completed += 1
            logger.info("ci_monitor_completed", extra={"project_id": claim.project_id, "claim_id": claim.claim_id})
        except _EXPECTED_SYNC_ERRORS as error:
            logger.info(
                "ci_monitor_sync_skipped",
                extra={"project_id": claim.project_id, "claim_id": claim.claim_id, "reason": str(error)},
            )
        except Exception:
            db.rollback()
            failures += 1
            logger.exception("ci_monitor_processing_failed", extra={"project_id": claim.project_id, "claim_id": claim.claim_id})
    if failures:
        raise ScheduledCiStatusRunError(f"{failures} scheduled CI status check(s) failed to process; {completed} completed.")
    return completed

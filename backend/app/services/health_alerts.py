import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.health_alert import HealthAlert, HealthAlertEvidence
from app.models.health_check import HealthCheck
from app.models.health_monitor_schedule import HealthMonitorSchedule
from app.models.project_activity import ProjectActivityEvent

logger = logging.getLogger("projectops.health_monitor")


def active_alert(db: Session, project_id: int) -> HealthAlert | None:
    return db.scalar(select(HealthAlert).where(HealthAlert.project_id == project_id, HealthAlert.status == "active"))


def record_transition(db: Session, alert: HealthAlert, transition: str) -> None:
    db.add(ProjectActivityEvent(
        project_id=alert.project_id, event_type=f"health_alert_{transition}", event_category="health",
        message=f"Health alert {transition}.", related_resource_type="health_alert", related_resource_id=alert.id,
        metadata_json={"alert_id": alert.id, "closure_reason": alert.closure_reason,
                       "acknowledged_by_user_id": alert.acknowledged_by_user_id},
    ))
    logger.info("health_alert_%s project_id=%s alert_id=%s", transition, alert.project_id, alert.id)


def apply_observation(db: Session, schedule: HealthMonitorSchedule, check: HealthCheck) -> None:
    alert = active_alert(db, schedule.project_id)
    healthy = check.status == "healthy"
    if healthy:
        schedule.consecutive_failures = 0
        schedule.first_failure_check_id = None
        schedule.consecutive_healthy = min(2, schedule.consecutive_healthy + 1)
    else:
        schedule.consecutive_healthy = 0
        schedule.consecutive_failures += 1
        if schedule.consecutive_failures == 1:
            schedule.first_failure_check_id = check.id
    if alert is None and schedule.consecutive_failures >= 2:
        first = db.get(HealthCheck, schedule.first_failure_check_id)
        alert = HealthAlert(
            project_id=check.project_id, target_url=check.target_url, status="active",
            first_failure_at=first.checked_at, opened_at=check.checked_at, last_observed_at=check.checked_at,
            first_check_id=first.id, opening_check_id=check.id, latest_check_id=check.id, failure_count=2,
        )
        db.add(alert)
        db.flush()
        db.add(HealthAlertEvidence(alert_id=alert.id, health_check_id=first.id))
        record_transition(db, alert, "opened")
    elif alert is not None and not healthy:
        alert.failure_count += 1
    if alert is not None:
        alert.latest_check_id = check.id
        alert.last_observed_at = check.checked_at
        db.add(HealthAlertEvidence(alert_id=alert.id, health_check_id=check.id))
        if healthy and schedule.consecutive_healthy >= 2:
            alert.status = "recovered"
            alert.recovered_at = check.checked_at
            alert.recovery_check_id = check.id
            record_transition(db, alert, "recovered")


def close_alert(db: Session, project_id: int, reason: str) -> None:
    alert = active_alert(db, project_id)
    if alert is not None:
        alert.status = "closed"
        alert.closed_at = datetime.now(timezone.utc)
        alert.closure_reason = reason
        record_transition(db, alert, "closed")

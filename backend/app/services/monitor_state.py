from datetime import datetime, timedelta, timezone
from app.models.health_monitor_schedule import HealthMonitorSchedule
from app.repositories.health_monitor_schedules import health_monitor_schedule_repository

lock_monitor = health_monitor_schedule_repository.lock_project_and_schedule


def reset_sequence(schedule: HealthMonitorSchedule, now: datetime) -> None:
    schedule.generation = (schedule.generation or 0) + 1
    schedule.sequence_started_at = now
    schedule.sequence_completed_at = None
    schedule.consecutive_failures = 0
    schedule.consecutive_healthy = 0
    schedule.first_failure_check_id = None
    schedule.claim_id = None
    schedule.claim_expires_at = None
    schedule.next_run_at = now + timedelta(minutes=schedule.cadence_minutes) if schedule.enabled else None


def freshness(schedule: HealthMonitorSchedule | None, now: datetime | None = None) -> str:
    if schedule is None or not schedule.enabled:
        return "disabled"
    anchor = schedule.sequence_completed_at or schedule.sequence_started_at
    if anchor and (now or datetime.now(timezone.utc)) >= anchor + timedelta(minutes=schedule.cadence_minutes + 10):
        return "overdue"
    return "current" if schedule.sequence_completed_at else "awaiting_first_check"

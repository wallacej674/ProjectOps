from datetime import datetime, timedelta, timezone

from app.models.ci_status_monitor_schedule import CiStatusMonitorSchedule
from app.repositories.ci_status_monitor_schedules import ci_status_monitor_schedule_repository

lock_monitor = ci_status_monitor_schedule_repository.lock_project_and_schedule


def reset_sequence(schedule: CiStatusMonitorSchedule, now: datetime) -> None:
    schedule.generation = (schedule.generation or 0) + 1
    schedule.consecutive_sync_failures = 0
    schedule.claim_id = None
    schedule.claim_expires_at = None
    schedule.next_run_at = now + timedelta(minutes=schedule.cadence_minutes) if schedule.enabled else None


def freshness(schedule: CiStatusMonitorSchedule | None, now: datetime | None = None) -> str:
    if schedule is None or not schedule.enabled:
        return "disabled"
    if schedule.last_completed_at is None:
        return "awaiting_first_check"
    anchor = schedule.last_completed_at
    if (now or datetime.now(timezone.utc)) >= anchor + timedelta(minutes=schedule.cadence_minutes + 10):
        return "overdue"
    return "current"

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.health_alert import HealthAlert
from app.models.project import Project
from app.models.project_activity import ProjectActivityEvent
from app.models.project_alert_webhook import ProjectAlertWebhook
from app.repositories.project_alert_webhooks import project_alert_webhook_repository
from app.schemas.project_alert_webhook import ProjectAlertWebhookRead, ProjectAlertWebhookUpdate
from app.services.alert_webhook_client import alert_webhook_client
from app.services.projects import project_service


class ProjectAlertWebhookValidationError(Exception):
    pass


def _dashboard_url(project_id: int) -> str | None:
    base = get_settings().app_base_url.strip()
    if not base:
        return None
    return f"{base.rstrip('/')}/app/projects/{project_id}?view=monitoring#health"


def _build_payload(project: Project, alert: HealthAlert | None, transition: str) -> dict:
    if transition == "test":
        text = f"ProjectOps: This is a test notification from {project.name}'s Health Alert Webhook."
    elif transition == "opened":
        text = f"ProjectOps: Health Alert opened for {project.name} ({alert.target_url})."
    else:
        text = f"ProjectOps: Health Alert recovered for {project.name} ({alert.target_url})."
    payload = {
        "text": text,
        "event": f"health_alert.{transition}",
        "project": {"id": project.id, "name": project.name},
        "alert": None if alert is None else {
            "id": alert.id,
            "status": alert.status,
            "target_url": alert.target_url,
            "opened_at": alert.opened_at.isoformat(),
            "last_observed_at": alert.last_observed_at.isoformat(),
            "recovered_at": alert.recovered_at.isoformat() if alert.recovered_at else None,
            "failure_count": alert.failure_count,
        },
        "dashboard_url": _dashboard_url(project.id),
    }
    return payload


class AlertWebhookService:
    def get_for_project(self, db: Session, project_id: int) -> ProjectAlertWebhookRead:
        project_service.get_project(db, project_id)
        row = project_alert_webhook_repository.get_by_project_id(db, project_id)
        if row is None:
            return ProjectAlertWebhookRead(
                project_id=project_id, enabled=False, url="",
                last_delivery_attempted_at=None, last_delivery_transition=None, last_delivery_outcome=None,
                last_delivery_http_status=None, last_delivery_error=None, created_at=None, updated_at=None,
            )
        return ProjectAlertWebhookRead.model_validate(row)

    def update_for_project(self, db: Session, project_id: int, update: ProjectAlertWebhookUpdate) -> ProjectAlertWebhookRead:
        project_service.get_project(db, project_id)
        url = update.url.strip()
        if update.enabled and not url:
            raise ProjectAlertWebhookValidationError("Add a webhook URL before enabling alert delivery.")
        row = project_alert_webhook_repository.get_by_project_id(db, project_id)
        if row is None:
            row = ProjectAlertWebhook(project_id=project_id)
            db.add(row)
        row.enabled = update.enabled
        row.url = url
        db.commit()
        return self.get_for_project(db, project_id)

    def pause_for_project(self, db: Session, project_id: int) -> ProjectAlertWebhookRead:
        current = self.get_for_project(db, project_id)
        return self.update_for_project(db, project_id, ProjectAlertWebhookUpdate(enabled=False, url=current.url))

    def send_test(self, db: Session, project_id: int) -> ProjectAlertWebhookRead:
        project = project_service.get_project(db, project_id)
        row = project_alert_webhook_repository.get_by_project_id(db, project_id)
        if row is None or not row.enabled or not row.url:
            raise ProjectAlertWebhookValidationError("Configure and enable a webhook before sending a test notification.")
        payload = _build_payload(project, None, "test")
        outcome = alert_webhook_client.post(row.url, payload, swallow_url_errors=False)
        row.last_delivery_attempted_at = datetime.now(timezone.utc)
        row.last_delivery_transition = "test"
        row.last_delivery_outcome = "delivered" if outcome.delivered else "failed"
        row.last_delivery_http_status = outcome.http_status
        row.last_delivery_error = outcome.error_message
        db.commit()
        return self.get_for_project(db, project_id)


def deliver_alert_transition(db: Session, alert: HealthAlert, transition: str, event: ProjectActivityEvent) -> None:
    row = project_alert_webhook_repository.get_by_project_id(db, alert.project_id)
    if row is None or not row.enabled or not row.url:
        return
    project = db.get(Project, alert.project_id)
    payload = _build_payload(project, alert, transition)
    outcome = alert_webhook_client.post(row.url, payload, swallow_url_errors=True)
    row.last_delivery_attempted_at = datetime.now(timezone.utc)
    row.last_delivery_transition = transition
    row.last_delivery_outcome = "delivered" if outcome.delivered else "failed"
    row.last_delivery_http_status = outcome.http_status
    row.last_delivery_error = outcome.error_message
    event.metadata_json = {**(event.metadata_json or {}), "webhook_delivery": {
        "attempted": True, "delivered": outcome.delivered,
        "http_status": outcome.http_status, "error": outcome.error_message,
    }}


alert_webhook_service = AlertWebhookService()

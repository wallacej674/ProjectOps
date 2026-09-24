from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project_alert_webhook import ProjectAlertWebhook


class ProjectAlertWebhookRepository:
    def get_by_project_id(self, db: Session, project_id: int) -> ProjectAlertWebhook | None:
        return db.scalar(select(ProjectAlertWebhook).where(ProjectAlertWebhook.project_id == project_id))


project_alert_webhook_repository = ProjectAlertWebhookRepository()

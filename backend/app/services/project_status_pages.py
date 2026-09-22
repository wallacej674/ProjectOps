from datetime import datetime, timezone
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from app.models.project_status_page import ProjectStatusPage
from app.repositories.health_checks import health_check_repository
from app.repositories.project_status_pages import project_status_page_repository
from app.schemas.project_status_page import (
    ProjectStatusPageRead,
    ProjectStatusPageUpdate,
    PublicStatusCheckRead,
    PublicStatusIncidentRead,
    PublicStatusPageRead,
)
from app.services.health_alerts import active_alert
from app.services.projects import project_service
from app.services.svg_badge import render_flat_badge

PUBLIC_HISTORY_LIMIT = 60

_UNAVAILABLE_COLOR = '#9f9f9f'
_INCIDENT_COLOR = '#e05d44'
_BADGE_VALUE = {'healthy': 'operational', 'unhealthy': 'unhealthy', 'timeout': 'degraded', 'error': 'degraded'}
_BADGE_COLOR = {'healthy': '#3fb950', 'unhealthy': '#e05d44', 'timeout': '#dfb317', 'error': '#dfb317'}


class ProjectStatusPageValidationError(Exception):
    pass


class PublicStatusPageNotFoundError(Exception):
    pass


def _generate_slug() -> str:
    return token_urlsafe(18)


class ProjectStatusPageService:
    def get_for_project(self, db: Session, project_id: int) -> ProjectStatusPageRead:
        project_service.get_project(db, project_id)
        page = project_status_page_repository.get_by_project_id(db, project_id)
        if page is None:
            return ProjectStatusPageRead(
                project_id=project_id, enabled=False, slug=None, label=None,
                created_at=None, updated_at=None,
            )
        return ProjectStatusPageRead.model_validate(page)

    def update_for_project(self, db: Session, project_id: int, update: ProjectStatusPageUpdate) -> ProjectStatusPageRead:
        project = project_service.get_project(db, project_id)
        if update.enabled and not project.production_url:
            raise ProjectStatusPageValidationError("Add a Project production URL before enabling a public status page.")
        page = project_status_page_repository.get_by_project_id(db, project_id)
        if page is None:
            page = ProjectStatusPage(project_id=project_id, slug=_generate_slug())
            db.add(page)
        page.enabled = update.enabled
        page.label = update.label.strip() if update.label and update.label.strip() else None
        db.commit()
        return self.get_for_project(db, project_id)

    def pause_for_project(self, db: Session, project_id: int) -> ProjectStatusPageRead:
        current = self.get_for_project(db, project_id)
        return self.update_for_project(db, project_id, ProjectStatusPageUpdate(enabled=False, label=current.label))

    def rotate_slug_for_project(self, db: Session, project_id: int) -> ProjectStatusPageRead:
        project_service.get_project(db, project_id)
        page = project_status_page_repository.get_by_project_id(db, project_id)
        if page is None:
            raise ProjectStatusPageValidationError("Enable a public status page before rotating its link.")
        page.slug = _generate_slug()
        db.commit()
        return self.get_for_project(db, project_id)

    def get_public_status(self, db: Session, slug: str) -> PublicStatusPageRead:
        page = project_status_page_repository.get_by_slug(db, slug)
        if page is None or not page.enabled:
            raise PublicStatusPageNotFoundError("No public status page is published at this link.")
        project = project_service.get_project(db, page.project_id)
        history = health_check_repository.list_recent_by_project_id(db, page.project_id, PUBLIC_HISTORY_LIMIT)
        latest = history[0] if history else None
        alert = active_alert(db, page.project_id)
        return PublicStatusPageRead(
            label=page.label or project.name,
            target_url=project.production_url,
            current_status=latest.status if latest else None,
            last_checked_at=latest.checked_at if latest else None,
            active_incident=PublicStatusIncidentRead(
                opened_at=alert.opened_at, last_observed_at=alert.last_observed_at, recovered_at=alert.recovered_at,
            ) if alert else None,
            history=[PublicStatusCheckRead.model_validate(check) for check in history],
            generated_at=datetime.now(timezone.utc),
        )

    def get_public_status_badge(self, db: Session, slug: str) -> str:
        try:
            page = self.get_public_status(db, slug)
        except PublicStatusPageNotFoundError:
            return render_flat_badge('status', 'unavailable', _UNAVAILABLE_COLOR)
        if page.active_incident:
            return render_flat_badge('status', 'incident', _INCIDENT_COLOR)
        if page.current_status:
            return render_flat_badge('status', _BADGE_VALUE[page.current_status], _BADGE_COLOR[page.current_status])
        return render_flat_badge('status', 'unknown', _UNAVAILABLE_COLOR)


project_status_page_service = ProjectStatusPageService()

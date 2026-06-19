from datetime import datetime, timezone
from time import perf_counter
from typing import Protocol

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.health_check import HealthCheck, HealthCheckStatus
from app.repositories.health_checks import health_check_repository
from app.schemas.health_check import HealthCheckRunRequest
from app.services.projects import project_service

RESPONSE_PREVIEW_MAX_LENGTH = 500


class HealthCheckNotFoundError(Exception):
    pass


class HealthCheckTargetUrlMissingError(Exception):
    pass


class HealthCheckHttpClient(Protocol):
    def get(self, url: str) -> httpx.Response:
        pass


class HealthCheckService:
    def __init__(self, http_client: HealthCheckHttpClient | None = None) -> None:
        self.http_client = http_client

    def run_health_check(
        self,
        db: Session,
        project_id: int,
        health_check_in: HealthCheckRunRequest,
        http_client: HealthCheckHttpClient | None = None,
    ) -> HealthCheck:
        project = project_service.get_project(db, project_id)
        target_url = health_check_in.url or project.production_url
        if not target_url:
            raise HealthCheckTargetUrlMissingError("Provide a URL or set production_url on the Project.")

        active_http_client = http_client or self.http_client
        if active_http_client is not None:
            return self._run_with_client(db, project_id, target_url, active_http_client)

        settings = get_settings()
        with httpx.Client(timeout=settings.health_check_timeout_seconds) as client:
            return self._run_with_client(db, project_id, target_url, client)

    def get_latest_project_health_check(self, db: Session, project_id: int) -> HealthCheck:
        project_service.get_project(db, project_id)
        health_check = health_check_repository.get_latest_by_project_id(db, project_id)
        if health_check is None:
            raise HealthCheckNotFoundError(f"Project {project_id} does not have a health check yet.")
        return health_check

    def list_project_health_checks(self, db: Session, project_id: int) -> list[HealthCheck]:
        project_service.get_project(db, project_id)
        return health_check_repository.list_by_project_id(db, project_id)

    def _run_with_client(
        self,
        db: Session,
        project_id: int,
        target_url: str,
        http_client: HealthCheckHttpClient,
    ) -> HealthCheck:
        checked_at = datetime.now(timezone.utc)
        start = perf_counter()

        try:
            response = http_client.get(target_url)
            response_time_ms = _elapsed_ms(start)
            status = _classify_http_status(response.status_code)
            return self._store_health_check(
                db=db,
                project_id=project_id,
                target_url=target_url,
                status=status,
                http_status_code=response.status_code,
                response_time_ms=response_time_ms,
                checked_at=checked_at,
                error_message=None,
                response_preview=_preview_response(response.text),
            )
        except httpx.TimeoutException as error:
            return self._store_health_check(
                db=db,
                project_id=project_id,
                target_url=target_url,
                status=HealthCheckStatus.timeout.value,
                http_status_code=None,
                response_time_ms=_elapsed_ms(start),
                checked_at=checked_at,
                error_message=str(error) or "Health check timed out.",
                response_preview=None,
            )
        except httpx.HTTPError as error:
            return self._store_health_check(
                db=db,
                project_id=project_id,
                target_url=target_url,
                status=HealthCheckStatus.error.value,
                http_status_code=None,
                response_time_ms=_elapsed_ms(start),
                checked_at=checked_at,
                error_message=str(error) or "Health check request failed.",
                response_preview=None,
            )

    def _store_health_check(
        self,
        db: Session,
        project_id: int,
        target_url: str,
        status: str,
        http_status_code: int | None,
        response_time_ms: int | None,
        checked_at: datetime,
        error_message: str | None,
        response_preview: str | None,
    ) -> HealthCheck:
        return health_check_repository.create(
            db,
            HealthCheck(
                project_id=project_id,
                target_url=target_url,
                status=status,
                http_status_code=http_status_code,
                response_time_ms=response_time_ms,
                checked_at=checked_at,
                error_message=error_message,
                response_preview=response_preview,
            ),
        )


def _classify_http_status(status_code: int) -> str:
    if 200 <= status_code < 400:
        return HealthCheckStatus.healthy.value
    return HealthCheckStatus.unhealthy.value


def _elapsed_ms(start: float) -> int:
    return max(0, round((perf_counter() - start) * 1000))


def _preview_response(response_text: str) -> str:
    return response_text[:RESPONSE_PREVIEW_MAX_LENGTH]


health_check_service = HealthCheckService()

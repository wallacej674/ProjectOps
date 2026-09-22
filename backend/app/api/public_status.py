from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.dependencies import client_rate_limit_identifier, enforce_rate_limit
from app.schemas.project_status_page import PublicStatusPageRead
from app.services.project_status_pages import PublicStatusPageNotFoundError, project_status_page_service

router = APIRouter(prefix="/public/status-pages", tags=["Public Status Pages"])


@router.get("/{slug}", response_model=PublicStatusPageRead)
def get_public_status_page(
    slug: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PublicStatusPageRead:
    enforce_rate_limit(
        scope="public_status.view.ip",
        identifier=client_rate_limit_identifier(request),
        limit=settings.rate_limit_public_status_view_attempts,
        window_seconds=settings.rate_limit_public_status_view_window_seconds,
    )
    try:
        return project_status_page_service.get_public_status(db, slug)
    except PublicStatusPageNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/{slug}/badge.svg")
def get_public_status_page_badge(
    slug: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    enforce_rate_limit(
        scope="public_status.badge.ip",
        identifier=client_rate_limit_identifier(request),
        limit=settings.rate_limit_public_status_badge_attempts,
        window_seconds=settings.rate_limit_public_status_badge_window_seconds,
    )
    svg = project_status_page_service.get_public_status_badge(db, slug)
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "max-age=60"})

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.dependencies import bearer_scheme, enforce_rate_limit, get_optional_current_user
from app.models.user import User
from app.schemas.demo_data import DemoDataSeedRead, DemoDataStatusRead
from app.services.demo_data import DemoDataDisabledError, demo_data_service

router = APIRouter(prefix="/demo-data", tags=["Demo Data"])


@router.get("/status", response_model=DemoDataStatusRead)
def get_demo_data_status(settings: Annotated[Settings, Depends(get_settings)]) -> DemoDataStatusRead:
    return DemoDataStatusRead(
        enabled=demo_data_service.is_enabled(settings.environment),
        reason=demo_data_service.disabled_reason(settings.environment),
    )


@router.post("/seed", response_model=DemoDataSeedRead, status_code=status.HTTP_201_CREATED)
def seed_demo_data(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> DemoDataSeedRead:
    try:
        if not demo_data_service.is_enabled(settings.environment):
            raise DemoDataDisabledError("Demo data seeding is disabled in production environments.")
        current_user: User | None = get_optional_current_user(credentials, db, settings)
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
        enforce_rate_limit(
            scope="demo.seed.user",
            identifier=str(current_user.id),
            limit=settings.rate_limit_demo_seed_attempts,
            window_seconds=settings.rate_limit_demo_seed_window_seconds,
        )
        project, created = demo_data_service.seed_demo_workspace(
            db,
            settings.environment,
            owner_user_id=current_user.id,
        )
    except DemoDataDisabledError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error

    return DemoDataSeedRead(
        created=created,
        project=project,
        message="Demo workspace was created." if created else "Demo workspace already exists.",
    )

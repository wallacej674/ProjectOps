from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import Settings, get_settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
    }


@router.get("/health/db")
def database_health_check(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    try:
        db.execute(text("select 1"))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not reachable.",
        ) from error
    return {"status": "ok", "database": "reachable"}

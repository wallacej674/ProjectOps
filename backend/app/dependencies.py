from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.rate_limit import rate_limiter
from app.core.security import InvalidTokenError, decode_access_token
from app.models.user import User, UserStatus
from app.repositories.users import user_repository

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    user = get_optional_current_user(credentials, db, settings)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
    settings: Settings,
) -> User | None:
    if credentials is None:
        return None
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    try:
        user_id = decode_access_token(credentials.credentials, settings)
    except InvalidTokenError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.") from error

    user = user_repository.get(db, user_id)
    if user is None or user.status != UserStatus.active.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user


def client_rate_limit_identifier(request: Request) -> str:
    if request.client is None or not request.client.host:
        return "unknown-client"
    return request.client.host


def enforce_rate_limit(
    *,
    scope: str,
    identifier: str,
    limit: int,
    window_seconds: int,
) -> None:
    result = rate_limiter.check(
        f"{scope}:{identifier}",
        limit=limit,
        window_seconds=window_seconds,
    )
    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(result.retry_after_seconds)},
        )

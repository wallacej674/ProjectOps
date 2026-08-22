from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.dependencies import client_rate_limit_identifier, enforce_rate_limit, get_current_user
from app.models.user import User
from app.schemas.auth import AuthLoginRequest, AuthMessageRead, AuthRegisterRequest, AuthTokenRead, UserRead
from app.services.auth import DuplicateEmailError, InvalidCredentialsError, auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _token_response(user: User, settings: Settings) -> AuthTokenRead:
    token, expires_in = auth_service.issue_token(user, settings)
    return AuthTokenRead(access_token=token, expires_in=expires_in, user=UserRead.model_validate(user))


@router.post("/register", response_model=AuthTokenRead, status_code=status.HTTP_201_CREATED)
def register(
    register_in: AuthRegisterRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthTokenRead:
    enforce_rate_limit(
        scope="auth.register.ip",
        identifier=client_rate_limit_identifier(request),
        limit=settings.rate_limit_auth_register_attempts,
        window_seconds=settings.rate_limit_auth_register_window_seconds,
    )
    enforce_rate_limit(
        scope="auth.register.email",
        identifier=register_in.email,
        limit=settings.rate_limit_auth_register_attempts,
        window_seconds=settings.rate_limit_auth_register_window_seconds,
    )
    try:
        user = auth_service.register_user(
            db,
            email=register_in.email,
            password=register_in.password,
            display_name=register_in.display_name,
        )
    except DuplicateEmailError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    return _token_response(user, settings)


@router.post("/login", response_model=AuthTokenRead)
def login(
    login_in: AuthLoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthTokenRead:
    enforce_rate_limit(
        scope="auth.login.ip",
        identifier=client_rate_limit_identifier(request),
        limit=settings.rate_limit_auth_login_attempts,
        window_seconds=settings.rate_limit_auth_login_window_seconds,
    )
    enforce_rate_limit(
        scope="auth.login.email",
        identifier=login_in.email,
        limit=settings.rate_limit_auth_login_attempts,
        window_seconds=settings.rate_limit_auth_login_window_seconds,
    )
    try:
        user = auth_service.authenticate_user(db, email=login_in.email, password=login_in.password)
    except InvalidCredentialsError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error
    return _token_response(user, settings)


@router.get("/me", response_model=UserRead)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post("/logout", response_model=AuthMessageRead)
def logout(current_user: Annotated[User, Depends(get_current_user)]) -> AuthMessageRead:
    return AuthMessageRead(message="You have been signed out.")

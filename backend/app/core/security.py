from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import Settings

password_hash = PasswordHash.recommended()


class InvalidTokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(*, user_id: int, settings: Settings) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expires_at = datetime.now(UTC) + expires_delta
    payload: dict[str, Any] = {"sub": str(user_id), "exp": expires_at}
    token = jwt.encode(payload, settings.auth_secret_key, algorithm=settings.auth_token_algorithm)
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str, settings: Settings) -> int:
    try:
        payload = jwt.decode(token, settings.auth_secret_key, algorithms=[settings.auth_token_algorithm])
        subject = payload.get("sub")
        if not isinstance(subject, str):
            raise InvalidTokenError
        return int(subject)
    except (jwt.PyJWTError, ValueError) as error:
        raise InvalidTokenError from error

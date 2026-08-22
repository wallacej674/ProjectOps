from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserStatus
from app.repositories.users import user_repository


class DuplicateEmailError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class AuthService:
    def register_user(
        self,
        db: Session,
        *,
        email: str,
        password: str,
        display_name: str | None,
    ) -> User:
        if user_repository.get_by_email(db, email) is not None:
            raise DuplicateEmailError("An account with that email already exists.")
        return user_repository.create(
            db,
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
        )

    def authenticate_user(self, db: Session, *, email: str, password: str) -> User:
        user = user_repository.get_by_email(db, email)
        if user is None or user.status != UserStatus.active.value or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError("Invalid email or password.")
        return user

    def issue_token(self, user: User, settings: Settings) -> tuple[str, int]:
        return create_access_token(user_id=user.id, settings=settings)


auth_service = AuthService()

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User, UserStatus


class UserRepository:
    def create(
        self,
        db: Session,
        *,
        email: str,
        password_hash: str,
        display_name: str | None = None,
    ) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            display_name=display_name,
            status=UserStatus.active.value,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(User.email == email).limit(1))

    def get(self, db: Session, user_id: int) -> User | None:
        return db.get(User, user_id)


user_repository = UserRepository()

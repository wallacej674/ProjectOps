import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

TEST_DATABASE_URL = os.getenv(
    "PROJECTOPS_TEST_DATABASE_URL",
    "postgresql+psycopg://projectops:projectops@localhost:55432/projectops_test",
)

os.environ["PROJECTOPS_DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("PROJECTOPS_ENVIRONMENT", "test")

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Project  # noqa: F401, E402
from app.models import ReadinessItem, ProjectReadinessItem  # noqa: F401, E402
from app.repositories.readiness import seed_default_readiness_items  # noqa: E402


@pytest.fixture(autouse=True)
def reset_database(request: pytest.FixtureRequest) -> Generator[None, None, None]:
    if "client" not in request.fixturenames and "db" not in request.fixturenames:
        yield
        return

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_readiness_items(db)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db() -> Generator[Session, None, None]:
    database = SessionLocal()
    try:
        yield database
    finally:
        database.close()

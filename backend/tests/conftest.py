import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

TEST_DATABASE_URL = os.getenv(
    "PROJECTOPS_TEST_DATABASE_URL",
    "postgresql+psycopg://projectops:projectops@localhost:55432/projectops_test",
)

os.environ["PROJECTOPS_DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("PROJECTOPS_ENVIRONMENT", "test")

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Project  # noqa: F401, E402


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client

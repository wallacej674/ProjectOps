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
from app.core.config import get_settings  # noqa: E402
from app.core.rate_limit import rate_limiter  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Project  # noqa: F401, E402
from app.models import ProjectActivityEvent  # noqa: F401, E402
from app.models import ProjectArtifact  # noqa: F401, E402
from app.models import ReadinessItem, ProjectReadinessArtifactEvidence, ProjectReadinessItem  # noqa: F401, E402
from app.models import User  # noqa: F401, E402
from app.repositories.readiness import seed_default_readiness_items  # noqa: E402
from app.services import health_checks as health_checks_module  # noqa: E402


@pytest.fixture(autouse=True)
def patch_health_check_dns_resolver(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep outbound Health Check tests deterministic and off the real network."""
    monkeypatch.setattr(
        health_checks_module,
        "_resolve_url_addresses",
        lambda hostname: ["93.184.216.34"],
    )


@pytest.fixture(autouse=True)
def reset_database(request: pytest.FixtureRequest) -> Generator[None, None, None]:
    rate_limiter.reset()
    if (
        "client" not in request.fixturenames
        and "unauthenticated_client" not in request.fixturenames
        and "db" not in request.fixturenames
    ):
        yield
        rate_limiter.reset()
        return

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_readiness_items(db)
    yield
    Base.metadata.drop_all(bind=engine)
    rate_limiter.reset()


@pytest.fixture
def unauthenticated_client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client(unauthenticated_client: TestClient) -> TestClient:
    with SessionLocal() as db:
        user = User(
            email="test-user@example.com",
            password_hash="test-only-unused-password-hash",
            display_name="Test User",
            status="active",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token, _ = create_access_token(user_id=user.id, settings=get_settings())
    original_request = unauthenticated_client.request

    def request_with_auth(method: str, url, **kwargs):
        headers = dict(kwargs.pop("headers", {}) or {})
        path = str(url)
        if (
            "Authorization" not in headers
            and not path.startswith("/api/v1/auth")
            and not path.startswith("/health")
        ):
            headers["Authorization"] = f"Bearer {token}"
        return original_request(method, url, headers=headers, **kwargs)

    unauthenticated_client.request = request_with_auth  # type: ignore[method-assign]
    return unauthenticated_client


@pytest.fixture
def db() -> Generator[Session, None, None]:
    database = SessionLocal()
    try:
        yield database
    finally:
        database.close()

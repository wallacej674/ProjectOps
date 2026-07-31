from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.activity import router as activity_router
from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.readiness import router as readiness_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    app.include_router(health_router)
    app.include_router(activity_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(readiness_router)

    return app


app = create_app()

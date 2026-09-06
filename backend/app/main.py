from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.activity import router as activity_router
from app.api.auth import router as auth_router
from app.api.demo_data import router as demo_data_router
from app.api.health_alerts import router as health_alerts_router
from app.api.health import router as health_router
from app.api.health_checks import router as health_checks_router
from app.api.project_artifacts_overview import router as project_artifacts_overview_router
from app.api.projects import router as projects_router
from app.api.readiness import cross_project_router as readiness_cross_project_router
from app.api.readiness import router as readiness_router
from app.api.repo_analyses_overview import router as repo_analyses_overview_router
from app.core.logging import configure_logging
from app.core.config import get_settings
from app.core.monitoring import ERROR_MONITORING_ENABLED_STATE_KEY, configure_error_monitoring
from app.middleware.request_logging import REQUEST_ID_HEADER, RequestLoggingMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(title=settings.app_name)
    setattr(app.state, ERROR_MONITORING_ENABLED_STATE_KEY, configure_error_monitoring(settings))
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER, "Retry-After"],
    )

    app.include_router(health_alerts_router, prefix="/api/v1")
    app.include_router(health_router)
    app.include_router(activity_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(demo_data_router, prefix="/api/v1")
    app.include_router(health_checks_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(readiness_router)
    app.include_router(readiness_cross_project_router, prefix="/api/v1")
    app.include_router(repo_analyses_overview_router, prefix="/api/v1")
    app.include_router(project_artifacts_overview_router, prefix="/api/v1")

    return app


app = create_app()

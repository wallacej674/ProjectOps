import logging

from app.core.config import Settings

ERROR_MONITORING_ENABLED_STATE_KEY = "error_monitoring_enabled"
monitoring_logger = logging.getLogger("projectops.monitoring")


def is_error_monitoring_configured(settings: Settings) -> bool:
    return settings.enable_error_monitoring and bool(settings.sentry_dsn.strip())


def configure_error_monitoring(settings: Settings) -> bool:
    if not is_error_monitoring_configured(settings):
        return False

    import sentry_sdk
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment.strip() or settings.environment,
        integrations=[StarletteIntegration()],
        send_default_pii=False,
        before_send=sanitize_monitoring_event,
    )
    return True


def capture_unhandled_exception(request, error: Exception) -> None:
    if not getattr(request.app.state, ERROR_MONITORING_ENABLED_STATE_KEY, False):
        return

    try:
        import sentry_sdk

        request_id = getattr(request.state, "request_id", None)
        if request_id:
            sentry_sdk.set_tag("request_id", request_id)
            sentry_sdk.set_context(
                "projectops",
                {
                    "request_id": request_id,
                    "path": request.url.path,
                    "method": request.method,
                },
            )
        sentry_sdk.capture_exception(error)
    except Exception:
        monitoring_logger.warning("error_monitoring_capture_failed", exc_info=True)


def sanitize_monitoring_event(event: dict, hint: dict | None = None) -> dict:
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("data", None)
        request.pop("cookies", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {
                key: value
                for key, value in headers.items()
                if key.lower() not in {"authorization", "cookie", "set-cookie"}
            }
        url = request.get("url")
        if isinstance(url, str):
            request["url"] = url.split("?", 1)[0]
        query_string = request.get("query_string")
        if query_string:
            request["query_string"] = "[Filtered]"
    return event

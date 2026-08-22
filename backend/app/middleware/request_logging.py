import logging
import re
from time import perf_counter
from uuid import uuid4

from app.core.monitoring import capture_unhandled_exception
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 128
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]+$")

request_logger = logging.getLogger("projectops.request")


def normalize_request_id(value: str | None) -> str:
    if not value:
        return uuid4().hex
    cleaned = value.strip()
    if not cleaned or len(cleaned) > MAX_REQUEST_ID_LENGTH:
        return uuid4().hex
    if not REQUEST_ID_PATTERN.fullmatch(cleaned):
        return uuid4().hex
    return cleaned


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id
        started_at = perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as error:
            duration_ms = round((perf_counter() - started_at) * 1000, 2)
            request_logger.exception(
                "request_failed",
                extra=_log_extra(request, request_id, status_code, duration_ms),
            )
            capture_unhandled_exception(request, error)
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "ProjectOps hit an unexpected error.",
                    "request_id": request_id,
                },
                headers={REQUEST_ID_HEADER: request_id},
            )

        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        response.headers[REQUEST_ID_HEADER] = request_id
        request_logger.log(
            logging.WARNING if status_code >= 400 else logging.INFO,
            "request_completed",
            extra=_log_extra(request, request_id, status_code, duration_ms),
        )
        return response


def _log_extra(request: Request, request_id: str, status_code: int, duration_ms: float) -> dict[str, object]:
    return {
        "request_id": request_id,
        "http_method": request.method,
        "path": request.url.path,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "client_host": request.client.host if request.client else None,
    }
